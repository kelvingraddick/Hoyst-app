import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
const require = createRequire(import.meta.url);
const requireFunctions = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const {db} = require('../functions/lib/firebase.js');
const {Timestamp} = requireFunctions('firebase-admin/firestore');
const discovery = require('../functions/lib/discovery/index.js');
const {searchTokens} = require('../functions/lib/discovery/model.js');
const projectId = 'demo-hoyst-explore';
let environment;
const call = data => discovery.searchPublicCircles.run({data});
const event = (circleId = 'circle', uid = 'ava') => ({
  params: {circleId, uid, dateKey: '2026-09-26'},
});
async function seedActivity() {
  const circle = {
    privacy: 'public',
    circleMode: 'group',
    lifecycleStatus: 'active',
    createdAt: Timestamp.fromMillis(10),
    title: 'Builders',
  };
  await db.doc('circles/circle').set(circle);
  await db.doc('publicCircleIndex/circle').set({
    ...circle,
    commitment: 'Focus daily',
    category: 'Deep Work',
    updatedAt: Timestamp.fromMillis(100),
    searchTokens: searchTokens({
      ...circle,
      commitment: 'Focus daily',
      category: 'Deep Work',
    }),
  });
  for (const [uid, time] of [
    ['ava', 120],
    ['kai', 130],
  ]) {
    await db
      .doc(`users/${uid}`)
      .set({displayName: uid, avatarUrl: `profile-${uid}`, bio: 'PRIVATE BIO'});
    await db
      .doc(`circles/circle/members/${uid}`)
      .set({uid, status: 'active', joinedAt: Timestamp.fromMillis(20)});
    await db.doc(`circles/circle/days/2026-09-26/checkIns/${uid}`).set({
      status: 'done',
      uid,
      note: 'PRIVATE NOTE',
      photoUrl: 'PRIVATE PHOTO',
      publicTapIn: {
        eventId: uid,
        epoch: 10,
        occurredAt: Timestamp.fromMillis(time),
      },
    });
    await discovery.projectPublicTapIn.run(event('circle', uid));
  }
}
describe('public discovery backend', () => {
  before(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(
          new URL('../firestore.rules', import.meta.url),
          'utf8',
        ),
      },
    });
  });
  beforeEach(async () => environment.clearFirestore());
  after(async () => {
    await environment.cleanup();
    await db.terminate();
  });

  it('records eligibility inside the real submit transaction and preserves its time on details edits', async () => {
    const checkins = require('../functions/lib/checkins/index.js');
    const {FieldValue} = requireFunctions('firebase-admin/firestore');
    await db.doc('users/ava').set({
      displayName: 'Ava',
      handle: 'ava',
      onboardingStatus: 'complete',
      timezone: 'UTC',
    });
    for (const id of ['disabled', 'enabled', 'private']) {
      await db.doc(`circles/${id}`).set({
        privacy: id === 'private' ? 'private' : 'public',
        circleMode: 'group',
        lifecycleStatus: 'active',
        createdAt: Timestamp.fromMillis(10),
        title: 'Builders',
        category: 'Deep Work',
        commitment: 'Focus',
        commitmentCadence: 'daily',
        commitmentFrequency: {tapInsPerWeek: 7},
        commitmentType: 'build',
        targetValue: 2,
        stepValue: 1,
        unitLabel: 'hours',
        memberCount: 1,
        timezone: 'UTC',
      });
      await db.doc(`circles/${id}/members/ava`).set({
        uid: 'ava',
        status: 'active',
        role: 'owner',
        joinedAt: Timestamp.fromMillis(20),
      });
    }
    const disabled = await checkins.submitTapIn.run({
      auth: {uid: 'ava'},
      data: {circleId: 'disabled', currentValue: 2, status: 'done'},
    });
    assert.equal(
      (
        await db
          .doc(`circles/disabled/days/${disabled.dateKey}/checkIns/ava`)
          .get()
      ).data().publicTapIn,
      undefined,
    );
    await db
      .doc('serverConfig/publicDiscovery')
      .set({activityActivatedAt: Timestamp.fromMillis(100)});
    const partial = await checkins.submitTapIn.run({
      auth: {uid: 'ava'},
      data: {circleId: 'enabled', currentValue: 1, status: 'done'},
    });
    const checkIn = db.doc(
      `circles/enabled/days/${partial.dateKey}/checkIns/ava`,
    );
    assert.equal((await checkIn.get()).data().publicTapIn, undefined);
    await checkins.submitTapIn.run({
      auth: {uid: 'ava'},
      data: {circleId: 'enabled', currentValue: 2, status: 'done'},
    });
    const marker = (await checkIn.get()).data().publicTapIn;
    assert.ok(marker.eventId);
    assert.equal(marker.epoch, 10);
    assert.ok(marker.occurredAt.toMillis() > 100);
    await checkins.updateTapInDetails.run({
      auth: {uid: 'ava'},
      data: {circleId: 'enabled', note: 'Private details', photoUrl: null},
    });
    assert.deepEqual((await checkIn.get()).data().publicTapIn, marker);
    const privateResult = await checkins.submitTapIn.run({
      auth: {uid: 'ava'},
      data: {circleId: 'private', currentValue: 2, status: 'done'},
    });
    assert.equal(
      (
        await db
          .doc(`circles/private/days/${privateResult.dateKey}/checkIns/ava`)
          .get()
      ).data().publicTapIn,
      undefined,
    );
    await db
      .doc('serverConfig/publicDiscovery')
      .update({activityActivatedAt: FieldValue.delete()});
  });
  it('searches past 50 records, AND matches words, paginates and counts exact matches', async () => {
    const batch = db.batch();
    for (let i = 0; i < 65; i++) {
      const data = {
        title: `Circle ${i}`,
        category: i % 2 ? 'Fitness' : 'Deep Work',
        commitment: 'One focused hour',
        circleMode: 'group',
        lifecycleStatus: 'active',
        updatedAt: Timestamp.fromMillis(1000 + i),
      };
      batch.set(db.doc(`publicCircleIndex/c${String(i).padStart(2, '0')}`), {
        ...data,
        searchTokens: searchTokens(data),
      });
    }
    batch.set(db.doc('publicCircleIndex/personal'), {
      circleMode: 'personal',
      lifecycleStatus: 'active',
      updatedAt: Timestamp.now(),
    });
    batch.set(db.doc('publicCircleIndex/archived'), {
      circleMode: 'group',
      lifecycleStatus: 'archived',
      updatedAt: Timestamp.now(),
    });
    await batch.commit();
    const first = await call({query: '', category: 'All'});
    assert.equal(first.total, 65);
    assert.equal(first.circles.length, 20);
    const second = await call({
      query: '',
      category: 'All',
      cursor: first.nextCursor,
    });
    assert.equal(second.circles.length, 20);
    assert.ok(
      !first.circles.some(a => second.circles.some(b => a.id === b.id)),
    );
    const third = await call({
      query: '',
      category: 'All',
      cursor: second.nextCursor,
    });
    const fourth = await call({
      query: '',
      category: 'All',
      cursor: third.nextCursor,
    });
    assert.equal(fourth.circles.length, 5);
    assert.equal(fourth.nextCursor, undefined);
    const filtered = await call({query: 'foc deep', category: 'All'});
    assert.equal(filtered.total, 33);
    assert.deepEqual(filtered.categories, ['Deep Work', 'Fitness']);
    const exact = await call({query: 'Circle 0', category: 'All'});
    assert.equal(exact.total, 1); // oldest record, beyond the old limit
    await assert.rejects(() =>
      call({query: 'different', category: 'All', cursor: first.nextCursor}),
    );
  });
  it('maintains search tokens idempotently after title and category edits', async () => {
    const ref = db.doc('publicCircleIndex/circle');
    await ref.set({
      title: 'Old name',
      commitment: 'Read daily',
      category: 'Writing',
    });
    await discovery.maintainPublicCircleSearch.run(event());
    await ref.update({title: 'New name', category: 'Deep Work'});
    await discovery.maintainPublicCircleSearch.run(event());
    const data = (await ref.get()).data();
    assert.ok(data.searchTokens.includes('new'));
    assert.ok(!data.searchTokens.includes('old'));
    const priorUpdate = (await ref.get()).updateTime.toMillis();
    await discovery.maintainPublicCircleSearch.run(event());
    assert.equal((await ref.get()).updateTime.toMillis(), priorUpdate);
  });
  it('does not publish historical records or detail-only edits without an eligibility marker', async () => {
    await seedActivity();
    await db.doc('circles/circle/days/2026-09-26/checkIns/kai').update({
      publicTapIn: requireFunctions(
        'firebase-admin/firestore',
      ).FieldValue.delete(),
      note: 'edited',
    });
    await discovery.projectPublicTapIn.run(event('circle', 'kai'));
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn
        .uid,
      'ava',
    );
    const data = await call({query: '', category: 'All'});
    assert.ok(!JSON.stringify(data).includes('PRIVATE'));
    assert.deepEqual(Object.keys(data.circles[0].latestPublicTapIn).sort(), [
      'avatarUrl',
      'displayName',
      'eventId',
      'occurredAt',
      'uid',
    ]);
  });
  it('falls back after removal and blocks a stale preview before its cleanup trigger runs', async () => {
    await seedActivity();
    await db.doc('circles/circle/days/2026-09-26/checkIns/kai').delete();
    const pending = await call({query: '', category: 'All'});
    assert.equal(pending.circles[0].latestPublicTapIn, undefined);
    await discovery.projectPublicTapIn.run(event('circle', 'kai'));
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn
        .uid,
      'ava',
    );
    await db.doc('circles/circle/members/ava').delete();
    await discovery.refreshPublicActivityMembership.run(event());
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn,
      undefined,
    );
    // A delayed check-in trigger must not revive the departed actor.
    await discovery.projectPublicTapIn.run(event());
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn,
      undefined,
    );
  });
  it('removes deleted accounts and prevents private or archived history from reappearing', async () => {
    await seedActivity();
    await db.doc('users/kai').delete();
    await discovery.refreshPublicActivityProfile.run(event('circle', 'kai'));
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn
        .uid,
      'ava',
    );
    await db.doc('circles/circle').update({
      privacy: 'private',
      publicActivityEpoch: Timestamp.fromMillis(150),
    });
    await discovery.refreshPublicActivityCircle.run(event());
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn,
      undefined,
    );
    await db.doc('circles/circle').update({
      privacy: 'public',
      publicActivityEpoch: Timestamp.fromMillis(160),
    });
    await discovery.projectPublicTapIn.run(event());
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn,
      undefined,
    );
    await db.doc('circles/circle').update({lifecycleStatus: 'archived'});
    await discovery.refreshPublicActivityCircle.run(event());
    assert.equal(
      (await db.collection('circles/circle/publicTapInCandidates').get()).size,
      0,
    );
  });
  it('preserves newer activity when delayed privacy and departure cleanup runs after rejoin', async () => {
    await seedActivity();
    await db
      .doc('circles/circle')
      .update({publicActivityEpoch: Timestamp.fromMillis(160)});
    await db
      .doc('circles/circle/members/ava')
      .update({joinedAt: Timestamp.fromMillis(165)});
    await db
      .doc('circles/circle/days/2026-09-26/checkIns/ava')
      .update({
        publicTapIn: {
          eventId: 'new-after-rejoin',
          epoch: 160,
          occurredAt: Timestamp.fromMillis(170),
        },
      });
    await discovery.projectPublicTapIn.run(event());
    await discovery.refreshPublicActivityCircle.run({
      ...event(),
      data: {
        before: {data: () => ({privacy: 'public'})},
        after: {data: () => ({privacy: 'private'})},
      },
    });
    await discovery.refreshPublicActivityMembership.run(event());
    assert.equal(
      (await db.doc('publicCircleIndex/circle').get()).data().latestPublicTapIn
        .eventId,
      'new-after-rejoin',
    );
    assert.ok(
      (
        await db
          .doc('circles/circle/publicTapInCandidates/2026-09-26_ava')
          .get()
      ).exists,
    );
  });
  it('keeps candidates server-only and leaves public-circle feeds member-only', async () => {
    await seedActivity();
    const guest = environment.unauthenticatedContext().firestore();
    const member = environment.authenticatedContext('ava').firestore();
    await db.doc('circles/circle/feedItems/private').set({text: 'PRIVATE'});
    for (const client of [guest, member]) {
      await assertFails(
        getDoc(
          doc(client, 'circles/circle/publicTapInCandidates/2026-09-26_ava'),
        ),
      );
      await assertFails(
        setDoc(doc(client, 'circles/circle/publicTapInCandidates/new'), {
          uid: 'ava',
        }),
      );
    }
    await assertFails(getDoc(doc(guest, 'circles/circle/feedItems/private')));
    await assertSucceeds(
      getDoc(doc(member, 'circles/circle/feedItems/private')),
    );
    await assertSucceeds(getDoc(doc(guest, 'publicCircleIndex/circle')));
  });
});
