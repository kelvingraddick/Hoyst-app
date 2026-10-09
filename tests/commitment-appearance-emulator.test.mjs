import {createRequire} from 'node:module';
import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const circles = require('../functions/lib/circles');
const {searchPublicCircles} = require('../functions/lib/discovery');
const {searchTokens} = require('../functions/lib/discovery/model');
const requireFunctions = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const {Timestamp} = requireFunctions('firebase-admin/firestore');
const owner = 'appearance-owner';
const payload = {
  category: 'Deep Work',
  circleMode: 'group',
  commitment: 'Focus daily',
  title: 'Appearance test',
  commitmentFrequency: {tapInsPerWeek: 7},
  joinMode: 'open',
  privacy: 'public',
  maxSize: 10,
};
const call = (fn, data, uid = owner) => fn.run({auth: {uid}, data});
const refs = [];
before(async () => {
  await db.doc(`users/${owner}`).set({
    onboardingStatus: 'complete',
    displayName: 'Owner',
    handle: 'appearanceowner',
    avatarUrl: '',
  });
  await db.doc('users/appearance-other').set({onboardingStatus: 'complete'});
});
after(async () => {
  for (const ref of refs) {
    await db.recursiveDelete(ref);
    await db.doc(`publicCircleIndex/${ref.id}`).delete();
  }
  await db.doc(`users/${owner}`).delete();
  await db.doc('users/appearance-other').delete();
});
test('create/update validates, canonicalizes, preserves omission and replaces/reset overrides in both projections', async () => {
  const result = await call(circles.createCircle, {
    ...payload,
    appearance: {emoji: '🌱', palette: 'pink'},
  });
  const ref = db.doc(`circles/${result.circleId}`);
  refs.push(ref);
  const index = db.doc(`publicCircleIndex/${ref.id}`);
  assert.equal((await ref.get()).data().category, 'Work');
  assert.deepEqual((await index.get()).data().appearance, {
    emoji: '🌱',
    palette: 'pink',
  });
  await call(circles.updateCircle, {...payload, circleId: ref.id});
  assert.deepEqual((await ref.get()).data().appearance, {
    emoji: '🌱',
    palette: 'pink',
  });
  await call(circles.updateCircle, {
    ...payload,
    circleId: ref.id,
    appearance: {palette: 'teal'},
  });
  assert.deepEqual((await index.get()).data().appearance, {palette: 'teal'});
  await call(circles.updateCircle, {
    ...payload,
    circleId: ref.id,
    appearance: {},
  });
  assert.deepEqual((await ref.get()).data().appearance, {});
  assert.deepEqual((await index.get()).data().appearance, {});
  await assert.rejects(
    call(circles.updateCircle, {
      ...payload,
      circleId: ref.id,
      appearance: {emoji: 'invalid'},
    }),
  );
  await assert.rejects(
    call(circles.updateCircle, {
      ...payload,
      circleId: ref.id,
      appearance: {palette: 'invalid'},
    }),
  );
  await assert.rejects(
    call(
      circles.updateCircle,
      {...payload, circleId: ref.id, appearance: {}},
      'appearance-other',
    ),
  );
});
test('canonical/legacy Explore filters include both names and retain nanosecond pagination', async () => {
  for (let i = 0; i < 23; i++) {
    const ref = db.doc(`publicCircleIndex/appearance-filter-${i}`);
    refs.push(ref);
    const data = {
      title: 'Appearance test',
      commitment: 'Focus daily',
      category: i % 2 ? 'Deep Work' : 'Work',
      appearance: {emoji: '🎯', palette: 'gold'},
      circleMode: 'group',
      lifecycleStatus: 'active',
      updatedAt: new Timestamp(100, i),
    };
    await ref.set({...data, searchTokens: searchTokens(data)});
  }
  for (const category of ['Work', 'Deep Work']) {
    const page = await searchPublicCircles.run({
      data: {category, query: 'appearance'},
    });
    assert.equal(page.circles.length, 20);
    assert.ok(page.circles.every(item => item.category === 'Work'));
    const next = await searchPublicCircles.run({
      data: {category, query: 'appearance', cursor: page.nextCursor},
    });
    assert.equal(
      new Set([...page.circles, ...next.circles].map(item => item.id)).size,
      page.total,
    );
    assert.deepEqual(
      page.circles.find(item => item.id.startsWith('appearance-filter'))
        .appearance,
      {emoji: '🎯', palette: 'gold'},
    );
  }
});

test('conversion and restoration carry stored appearance into rebuilt public indexes', async () => {
  const appearance = {emoji: '📚', palette: 'red'};
  const created = await call(circles.createCircle, {
    ...payload,
    circleMode: 'personal',
    appearance,
  });
  const ref = db.doc(`circles/${created.circleId}`);
  refs.push(ref);
  await call(circles.convertPersonalCircle, {
    circleId: ref.id,
    privacy: 'public',
    joinMode: 'open',
    maxSize: 10,
    title: 'Converted appearance',
  });
  assert.deepEqual(
    (await db.doc(`publicCircleIndex/${ref.id}`).get()).data().appearance,
    appearance,
  );
  // Seed a completed archive transition without invoking notification or schedule work.
  await ref.update({
    lifecycleStatus: 'archived',
    archiveReconciliationStatus: 'complete',
    archivedAt: Timestamp.now(),
  });
  await db.doc(`publicCircleIndex/${ref.id}`).delete();
  await call(circles.unarchiveCircle, {circleId: ref.id});
  assert.deepEqual(
    (await db.doc(`publicCircleIndex/${ref.id}`).get()).data().appearance,
    appearance,
  );
});
