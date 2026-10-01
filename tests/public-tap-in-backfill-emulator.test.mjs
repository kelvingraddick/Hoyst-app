import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {after as afterTests, beforeEach, it} from 'node:test';
import {
  backfillRecord,
  backfillWindow,
  rollbackRecord,
} from '../scripts/backfill-public-tap-ins.mjs';

const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase.js');
const {Timestamp, FieldValue} =
  require('../functions/node_modules/firebase-admin').firestore;
const discovery = require('../functions/lib/discovery/index.js');
const checkins = require('../functions/lib/checkins/index.js');
const end = Timestamp.fromMillis(Date.parse('2026-09-30T01:34:27.726Z'));
const window = backfillWindow(end);
const stamp = time => Timestamp.fromMillis(end.toMillis() - time);
const path = uid => `circles/circle/days/2026-09-29/checkIns/${uid}`;
const event = uid => ({
  params: {circleId: 'circle', dateKey: '2026-09-29', uid},
});

beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`,
    {method: 'DELETE'},
  );
  await db.doc('serverConfig/publicDiscovery').set({activityActivatedAt: end});
  const circle = {
    privacy: 'public',
    circleMode: 'group',
    lifecycleStatus: 'active',
    createdAt: window.start,
    title: 'Builders',
    commitment: 'Focus daily',
    category: 'Deep Work',
  };
  await db.doc('circles/circle').set(circle);
  await db
    .doc('publicCircleIndex/circle')
    .set({...circle, updatedAt: end, searchTokens: []});
  for (const [uid, offset] of [
    ['ava', 2000],
    ['kai', 1000],
  ]) {
    await db
      .doc(`users/${uid}`)
      .set({displayName: uid, avatarUrl: `avatar-${uid}`});
    await db
      .doc(`circles/circle/members/${uid}`)
      .set({status: 'active', joinedAt: window.start});
    await db.doc(path(uid)).set({
      status: 'done',
      coverageStatus: 'covered',
      coverageRevision: 1,
      createdAt: stamp(offset),
      updatedAt: stamp(offset),
      note: 'PRIVATE',
      photoUrl: 'PRIVATE',
    });
  }
});
afterTests(() => db.terminate());

it('dry-runs without writes, then publishes latest original event and reruns safely', async () => {
  assert.equal(
    (await backfillRecord({db, path: path('ava'), window})).status,
    'eligible',
  );
  assert.equal((await db.doc(path('ava')).get()).data().publicTapIn, undefined);
  for (const uid of ['ava', 'kai']) {
    const before = (await db.doc(path(uid)).get()).data();
    const entry = await backfillRecord({
      db,
      path: path(uid),
      window,
      commit: true,
    });
    assert.equal(entry.status, 'written');
    const after = (await db.doc(path(uid)).get()).data();
    const {publicTapIn, ...unchanged} = after;
    assert.deepEqual(unchanged, before);
    await checkins.processTapInSideEffects.run({
      ...event(uid),
      data: {
        before: {data: () => before},
        after: {data: () => after},
      },
    });
    await discovery.projectPublicTapIn.run(event(uid));
    assert.equal(
      (await backfillRecord({db, path: path(uid), window, commit: true}))
        .reason,
      'existing_marker',
    );
  }
  const result = await discovery.searchPublicCircles.run({data: {}});
  assert.equal(result.circles[0].latestPublicTapIn.uid, 'kai');
  assert.equal(
    result.circles[0].latestPublicTapIn.occurredAt,
    stamp(1000).toDate().toISOString(),
  );
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal((await db.collection('circles/circle/feedItems').get()).size, 0);
  assert.equal(
    (await db.collection('circles/circle/checkInEffects').get()).size,
    0,
  );
});

it('publication-only handler does not access Firestore, and normal detail edits still run', async () => {
  const before = (await db.doc(path('ava')).get()).data();
  const after = {
    ...before,
    publicTapIn: {eventId: 'new', occurredAt: before.createdAt, epoch: 1},
  };
  const original = db.collection;
  db.collection = () => {
    throw new Error('ordinary side effects reached');
  };
  try {
    await checkins.processTapInSideEffects.run({
      ...event('ava'),
      data: {
        before: {data: () => before},
        after: {data: () => after},
      },
    });
    await checkins.processTapInSideEffects.run({
      ...event('ava'),
      data: {
        before: {data: () => after},
        after: {data: () => before},
      },
    });
    await assert.rejects(
      checkins.processTapInSideEffects.run({
        ...event('ava'),
        data: {
          before: {data: () => before},
          after: {data: () => ({...after, note: 'edited'})},
        },
      }),
      /ordinary side effects reached/,
    );
  } finally {
    db.collection = original;
  }
});

it('transaction rereads reject edits after a dry-run scan', async () => {
  const preview = await backfillRecord({db, path: path('ava'), window});
  assert.equal(preview.status, 'eligible');
  await db
    .doc(path('ava'))
    .update({updatedAt: end, note: 'edited concurrently'});
  const result = await backfillRecord({
    db,
    path: path('ava'),
    window,
    commit: true,
  });
  assert.equal(result.reason, 'ambiguous_timestamp');
  assert.equal((await db.doc(path('ava')).get()).data().publicTapIn, undefined);
});

it('rolls back matching markers, falls back to older activity, and preserves replacements', async () => {
  const entries = [];
  for (const uid of ['ava', 'kai']) {
    entries.push(
      await backfillRecord({db, path: path(uid), window, commit: true}),
    );
    await discovery.projectPublicTapIn.run(event(uid));
  }
  assert.equal(
    (await rollbackRecord({db, entry: entries[1]})).status,
    'rollback_eligible',
  );
  await rollbackRecord({db, entry: entries[1], commit: true});
  await discovery.projectPublicTapIn.run(event('kai'));
  assert.equal(
    (await discovery.searchPublicCircles.run({data: {}})).circles[0]
      .latestPublicTapIn.uid,
    'ava',
  );
  await db.doc(path('ava')).update({'publicTapIn.eventId': 'new-live-event'});
  assert.equal(
    (await rollbackRecord({db, entry: entries[0], commit: true})).reason,
    'marker_changed_or_missing',
  );
});

it('withdraws historical activity after departure and privacy changes', async () => {
  await backfillRecord({db, path: path('ava'), window, commit: true});
  await discovery.projectPublicTapIn.run(event('ava'));
  await db.doc('circles/circle/members/ava').update({status: 'left'});
  assert.equal(
    (await discovery.searchPublicCircles.run({data: {}})).circles[0]
      .latestPublicTapIn,
    undefined,
  );
  await discovery.refreshPublicActivityMembership.run(event('ava'));
  assert.equal(
    (await db.collection('circles/circle/publicTapInCandidates').get()).size,
    0,
  );
  await db
    .doc('circles/circle')
    .update({privacy: 'private', publicActivityEpoch: end});
  assert.equal(
    (await backfillRecord({db, path: path('kai'), window, commit: true}))
      .reason,
    'circle_not_public_active',
  );
  await discovery.refreshPublicActivityCircle.run(event('ava'));
  assert.equal(
    (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn,
    undefined,
  );
});

it('stops if the frozen activation boundary changes', async () => {
  await db
    .doc('serverConfig/publicDiscovery')
    .update({activityActivatedAt: FieldValue.delete()});
  await assert.rejects(
    backfillRecord({db, path: path('ava'), window, commit: true}),
    /Activation changed/,
  );
});
