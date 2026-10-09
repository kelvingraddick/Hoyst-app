import {createRequire} from 'node:module';
import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('These disposable fixtures require the Firestore emulator.');
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {
  createCircle,
  updateCircle,
  joinCircle,
} = require('../functions/lib/circles');
const {completeProfile} = require('../functions/lib/auth');
const {checkProfileUsername} = require('../functions/lib/profile/edit');
const {suggestPublicCircles} = require('../functions/lib/discovery');
const {resolveCircleInvite} = require('../functions/lib/invites');
const {
  recalculateMomentumSummaryForUser,
} = require('../functions/lib/momentum');
const {searchTokens} = require('../functions/lib/discovery/model');
const owner = 'onboarding-test-owner';
const other = 'onboarding-test-other';
const fresh = 'onboarding-test-fresh';
const refs = [];
const call = (fn, data, uid = owner) =>
  fn.run({
    auth: uid
      ? {uid, token: {firebase: {sign_in_provider: 'password'}}}
      : undefined,
    data,
  });
const payload = {
  category: 'Fitness',
  circleMode: 'group',
  title: 'Small steps club',
  commitment: 'Walk for 20 minutes',
  commitmentCadence: 'weekly',
  commitmentFrequency: {tapInsPerWeek: 4},
  commitmentType: 'build',
  buildTrackingMode: 'quantity',
  targetValue: 20,
  unitLabel: 'minutes',
  maxSize: 10,
  joinMode: 'open',
  privacy: 'public',
  timezone: 'UTC',
};
before(async () => {
  for (const [uid, handle] of [
    [owner, 'onboarding_owner'],
    [other, 'onboarding_other'],
  ]) {
    await db.doc(`users/${uid}`).set({
      onboardingStatus: 'complete',
      displayName: 'Setup test',
      handle,
      timezone: 'UTC',
    });
    await db.doc(`handles/${handle}`).set({uid});
  }
});
after(async () => {
  for (const ref of refs) {
    await db.recursiveDelete(ref);
    await db.doc(`publicCircleIndex/${ref.id}`).delete();
  }
  for (const uid of [owner, other, fresh, 'onboarding-profile-size']) {
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db.recursiveDelete(db.doc(`userPrivate/${uid}`));
  }
  for (const handle of [
    'onboarding_owner',
    'onboarding_other',
    'onboarding_fresh',
    'onboarding_size',
  ])
    await db.doc(`handles/${handle}`).delete();
});
test('late momentum recalculations do not recreate a deleted or deleting account', async () => {
  const uid = 'onboarding-deletion-race';
  const profile = db.doc(`users/${uid}`);
  const privateRef = db.doc(`userPrivate/${uid}`);
  const momentum = privateRef.collection('momentum').doc('current');
  try {
    await profile.set({onboardingStatus: 'complete'});
    await recalculateMomentumSummaryForUser(uid);
    assert.equal((await momentum.get()).exists, true);
    await Promise.all([
      ...Array.from({length: 12}, () => recalculateMomentumSummaryForUser(uid)),
      (async () => {
        await profile.update({accountDeletionStartedAt: new Date()});
        await db.recursiveDelete(privateRef);
      })(),
    ]);
    await recalculateMomentumSummaryForUser(uid);
    assert.equal((await momentum.get()).exists, false);
    await profile.delete();
    await recalculateMomentumSummaryForUser(uid);
    assert.equal((await momentum.get()).exists, false);
  } finally {
    await profile.delete();
    await db.recursiveDelete(privateRef);
  }
});
test('full invite preview recognizes the authenticated active member without exposing membership to guests', async () => {
  const created = await call(createCircle, {
    ...payload,
    privacy: 'private',
    maxSize: 2,
  });
  refs.push(db.doc(`circles/${created.circleId}`));
  await call(
    joinCircle,
    {circleId: created.circleId, inviteCode: created.inviteCode},
    other,
  );
  const member = await call(
    resolveCircleInvite,
    {inviteCode: created.inviteCode},
    other,
  );
  assert.equal(member.isFull, true);
  assert.equal(member.viewerMembershipStatus, 'active');
  assert.equal(member.viewerUid, other);
  const guest = await call(
    resolveCircleInvite,
    {inviteCode: created.inviteCode},
    null,
  );
  assert.equal(guest.isFull, true);
  assert.equal(guest.viewerMembershipStatus, undefined);
  assert.equal(guest.viewerUid, undefined);
});
test('creation is idempotent under concurrent retries and rejects changing a submitted intent', async () => {
  const requestId = 'onboarding-retry';
  const [a, b] = await Promise.all([
    call(createCircle, {...payload, requestId}),
    call(createCircle, {...payload, requestId}),
  ]);
  assert.equal(a.circleId, b.circleId);
  refs.push(db.doc(`circles/${a.circleId}`));
  assert.equal(
    (await db.doc(`circles/${a.circleId}`).get()).data().memberCount,
    1,
  );
  assert.equal(
    (
      await db
        .doc(`userPrivate/${owner}/createCircleRequests/${requestId}`)
        .get()
    ).data().circleId,
    a.circleId,
  );
  await assert.rejects(
    call(createCircle, {...payload, requestId, title: 'Changed after timeout'}),
    error => error.code === 'failed-precondition',
  );
});
test('a quantity goal of one stays numeric in storage and updates clear inactive mode fields', async () => {
  const created = await call(createCircle, {
    ...payload,
    title: 'Read one page',
    targetValue: 1,
    unitLabel: 'pages',
    requestId: 'numeric-one',
  });
  const ref = db.doc(`circles/${created.circleId}`);
  refs.push(ref);
  assert.equal((await ref.get()).data().buildTrackingMode, 'quantity');
  await call(updateCircle, {
    ...payload,
    circleId: created.circleId,
    commitmentType: 'limit',
    buildTrackingMode: undefined,
    minimumValue: 0,
    maximumValue: 30,
  });
  const updated = (await ref.get()).data();
  assert.equal(updated.commitmentType, 'limit');
  assert.equal(updated.buildTrackingMode, undefined);
  assert.equal(updated.targetValue, undefined);
  await assert.rejects(
    call(createCircle, {
      ...payload,
      buildTrackingMode: 'quantity',
      targetValue: 0,
    }),
    error => error.code === 'invalid-argument',
  );
});
test('personal names remain independent through creation and editing and stay out of discovery', async () => {
  const created = await call(createCircle, {
    ...payload,
    circleMode: 'personal',
    title: 'My morning movement',
    commitment: 'Take a short walk',
    buildTrackingMode: 'confirmation',
    targetValue: 1,
    unitLabel: 'Tap In',
    requestId: 'personal-name',
  });
  const ref = db.doc(`circles/${created.circleId}`);
  refs.push(ref);
  assert.equal((await ref.get()).data().title, 'My morning movement');
  assert.equal((await ref.get()).data().privacy, 'private');
  assert.equal(
    (await db.doc(`publicCircleIndex/${created.circleId}`).get()).exists,
    false,
  );
  await call(updateCircle, {
    ...payload,
    circleId: created.circleId,
    circleMode: 'personal',
    title: 'My evening movement',
    commitment: 'Take a longer walk',
    buildTrackingMode: 'confirmation',
    targetValue: 1,
    unitLabel: 'Tap In',
  });
  const updated = (await ref.get()).data();
  assert.equal(updated.title, 'My evening movement');
  assert.equal(updated.commitment, 'Take a longer walk');
});
test('profile setup honors chosen capacity and reuses its setupId result', async () => {
  const data = {
    displayName: 'New owner',
    handle: 'onboarding_size',
    timezone: 'UTC',
    starterCircle: {...payload, maxSize: 25, setupId: 'profile-capacity'},
  };
  const first = await call(completeProfile, data, 'onboarding-profile-size');
  const second = await call(completeProfile, data, 'onboarding-profile-size');
  assert.equal(first.starterCircle.circleId, second.starterCircle.circleId);
  const ref = db.doc(`circles/${first.starterCircle.circleId}`);
  refs.push(ref);
  assert.equal((await ref.get()).data().maxSize, 25);
  assert.equal((await ref.get()).data().memberCount, 1);
});
test('username availability works before a profile exists and reservation remains authoritative', async () => {
  assert.equal(
    (await call(checkProfileUsername, {handle: 'onboarding_fresh'}, fresh))
      .available,
    true,
  );
  assert.equal(
    (await call(checkProfileUsername, {handle: 'onboarding_owner'}, fresh))
      .available,
    false,
  );
  await assert.rejects(
    call(checkProfileUsername, {handle: 'onboarding_fresh'}, null),
  );
  await assert.rejects(
    call(
      completeProfile,
      {displayName: 'Conflict', handle: 'onboarding_owner', timezone: 'UTC'},
      fresh,
    ),
  );
  await call(
    completeProfile,
    {displayName: 'Fresh', handle: 'onboarding_fresh', timezone: 'UTC'},
    fresh,
  );
  assert.equal(
    (await db.doc(`handles/onboarding_fresh`).get()).data().uid,
    fresh,
  );
});
test('guest suggestions rank matching Circles, validate current authority, and expose only setup metadata', async () => {
  for (const [id, override] of [
    ['walk-good', {}],
    ['walk-full', {memberCount: 10}],
    ['walk-private', {privacy: 'private'}],
    ['walk-archived', {lifecycleStatus: 'archived'}],
    [
      'work-other',
      {
        category: 'Work',
        title: 'Focus club',
        commitment: 'Focus for 25 minutes',
      },
    ],
  ]) {
    const data = {
      ...payload,
      memberCount: 4,
      lifecycleStatus: 'active',
      ownerId: owner,
      updatedAt: new Date(),
      ...override,
    };
    const ref = db.doc(`circles/onboarding-${id}`);
    refs.push(ref);
    await ref.set(data);
    // Deliberately leave a stale public projection to exercise live authority checks.
    await db.doc(`publicCircleIndex/${ref.id}`).set({
      ...data,
      privacy: 'public',
      circleMode: 'group',
      lifecycleStatus: 'active',
      searchTokens: searchTokens(data),
      note: 'PRIVATE NOTE',
      photoUrl: 'https://example.invalid/private-photo',
    });
  }
  const result = await suggestPublicCircles.run({
    data: {query: 'walk for 15 minutes', categories: ['Fitness']},
  });
  assert.ok(result.circles.length <= 3);
  assert.ok(
    result.circles.some(circle => circle.id === 'onboarding-walk-good'),
  );
  assert.equal(
    result.circles.some(circle =>
      [
        'onboarding-walk-full',
        'onboarding-walk-private',
        'onboarding-walk-archived',
      ].includes(circle.id),
    ),
    false,
  );
  for (const circle of result.circles) {
    assert.equal('note' in circle, false);
    assert.equal('photoUrl' in circle, false);
    assert.equal('members' in circle, false);
    assert.ok(circle.timezone);
    assert.ok(circle.commitmentFrequency);
  }
  const empty = await suggestPublicCircles.run({
    data: {query: 'nothingmatchingxyz', categories: []},
  });
  assert.ok(Array.isArray(empty.circles));
});
test('join requests remain pending and a seat taken between preview and joining is rejected', async () => {
  const requested = await call(createCircle, {
    ...payload,
    joinMode: 'request_to_join',
    requestId: 'pending-circle',
  });
  refs.push(db.doc(`circles/${requested.circleId}`));
  assert.equal(
    (await call(joinCircle, {circleId: requested.circleId}, other)).status,
    'pending',
  );
  const full = await call(createCircle, {
    ...payload,
    maxSize: 2,
    requestId: 'full-circle',
  });
  const ref = db.doc(`circles/${full.circleId}`);
  refs.push(ref);
  await ref.update({memberCount: 2});
  await assert.rejects(
    call(joinCircle, {circleId: full.circleId}, other),
    error => error.code === 'resource-exhausted',
  );
});

test('an older personal-edit payload cannot collapse an independent name back into its commitment', async () => {
  const result = await call(createCircle, {
    ...payload,
    circleMode: 'personal',
    independentTitle: true,
    title: 'My named habit',
    commitment: 'Take a short walk',
    requestId: 'independent-name-compat',
  });
  const ref = db.doc(`circles/${result.circleId}`);
  refs.push(ref);
  await call(updateCircle, {
    ...payload,
    circleMode: 'personal',
    circleId: result.circleId,
    title: 'Take a longer walk',
    commitment: 'Take a longer walk',
  });
  assert.equal((await ref.get()).data().title, 'My named habit');
  await call(updateCircle, {
    ...payload,
    circleMode: 'personal',
    circleId: result.circleId,
    independentTitle: true,
    title: 'Take a longer walk',
    commitment: 'Take a longer walk',
  });
  assert.equal((await ref.get()).data().title, 'Take a longer walk');
});
test('an explicit no-photo choice overrides the authentication photo', async () => {
  const uid = 'onboarding-no-photo';
  await completeProfile.run({
    auth: {
      uid,
      token: {
        picture: 'https://example.invalid/provider-photo.jpg',
        firebase: {sign_in_provider: 'google.com'},
      },
    },
    data: {
      displayName: 'No photo',
      handle: 'onboarding_nophoto',
      timezone: 'UTC',
      avatarUrl: null,
    },
  });
  assert.equal((await db.doc(`users/${uid}`).get()).data().avatarUrl, null);
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.recursiveDelete(db.doc(`userPrivate/${uid}`));
  await db.doc('handles/onboarding_nophoto').delete();
});

test('numeric-one Tap Ins keep partial progress and persist the quantity mode snapshot', async () => {
  const {submitTapIn} = require('../functions/lib/checkins');
  const result = await call(createCircle, {
    ...payload,
    targetValue: 1,
    unitLabel: 'pages',
    requestId: 'numeric-one-submission',
  });
  const ref = db.doc(`circles/${result.circleId}`);
  refs.push(ref);
  await call(submitTapIn, {
    circleId: result.circleId,
    status: 'done',
    currentValue: 0,
  });
  const days = await ref.collection('days').get();
  let first;
  for (const day of days.docs) {
    const check = await day.ref.collection('checkIns').doc(owner).get();
    if (check.exists) first = check;
  }
  assert.ok(first);
  assert.equal(first.data().coverageStatus, 'partial');
  assert.equal(first.data().buildTrackingMode, 'quantity');
  await call(submitTapIn, {
    circleId: result.circleId,
    status: 'done',
    currentValue: 1,
  });
  const updated = await first.ref.get();
  assert.equal(updated.data().coverageStatus, 'covered');
  assert.equal(updated.data().targetValue, 1);
  assert.equal(updated.data().unitLabel, 'pages');
});
