import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import {doc, updateDoc} from 'firebase/firestore';
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {
  checkProfileUsername,
  updateProfile,
  refreshMemberProfile,
} = require('../functions/lib/profile/edit');
const request = (uid, data = {}) => ({
  auth: uid ? {uid, token: {}} : undefined,
  data,
});
const code = expected => error => error.code === expected;
describe('Profile identity transactions', () => {
  let environment;
  before(async () => {
    assert.ok(
      process.env.FIRESTORE_EMULATOR_HOST,
      'Only run against the emulator',
    );
    environment = await initializeTestEnvironment({
      projectId: process.env.GCLOUD_PROJECT || 'demo-hoyst-profile',
      firestore: {
        rules: readFileSync(
          new URL('../firestore.rules', import.meta.url),
          'utf8',
        ),
      },
    });
  });
  after(async () => {
    await environment.cleanup();
    await db.terminate();
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    for (const uid of ['alice', 'bobby']) {
      await db
        .doc('users/' + uid)
        .set({
          displayName: uid,
          handle: uid,
          onboardingStatus: 'complete',
          timezone: 'UTC',
          bio: 'Original',
          avatarUrl: 'https://example.com/old.jpg',
        });
      await db.doc('handles/' + uid).set({uid, handle: uid});
      await db
        .doc('circles/shared/members/' + uid)
        .set({
          uid,
          displayName: uid,
          handle: uid,
          status: 'active',
          joinedAt: 123,
        });
    }
    await db
      .doc('circles/shared/events/historical')
      .set({actor: {uid: 'alice', handle: 'alice', displayName: 'alice'}});
    await db
      .doc('userPrivate/alice/progress/current')
      .set({totalXP: 100, milestones: {streak_7: true}});
  });
  it('authenticates and validates identity, tint, timezone, and payload ownership', async () => {
    await assert.rejects(
      updateProfile.run(request(undefined, {handle: 'new'})),
      code('unauthenticated'),
    );
    await assert.rejects(
      checkProfileUsername.run(request(undefined, {handle: 'new'})),
      code('unauthenticated'),
    );
    for (const data of [
      {handle: 'ab'},
      {handle: 'a'.repeat(21)},
      {handle: 'bad!'},
      {displayName: ' '},
      {profileTint: 'red'},
      {timezone: 'not/a-zone'},
      {uid: 'bobby', handle: 'newname'},
      {},
    ])
      await assert.rejects(
        updateProfile.run(request('alice', data)),
        code('invalid-argument'),
      );
    await db.doc('users/alice').update({onboardingStatus: 'incomplete'});
    await assert.rejects(
      updateProfile.run(request('alice', {handle: 'newname'})),
      code('failed-precondition'),
    );
  });
  it('normalizes availability and rechecks a claimed name during saving without partial changes', async () => {
    assert.deepEqual(
      await checkProfileUsername.run(
        request('alice', {handle: ' @Free_Name '}),
      ),
      {handle: 'free_name', available: true},
    );
    assert.equal(
      (await checkProfileUsername.run(request('alice', {handle: 'ALICE'})))
        .available,
      true,
    );
    await updateProfile.run(request('bobby', {handle: 'free_name'}));
    await assert.rejects(
      updateProfile.run(
        request('alice', {
          handle: 'free_name',
          displayName: 'Changed',
          profileTint: 'purple',
          avatarUrl: 'https://example.com/new.jpg',
        }),
      ),
      code('already-exists'),
    );
    const alice = (await db.doc('users/alice').get()).data();
    assert.equal(alice.displayName, 'alice');
    assert.equal(alice.avatarUrl, 'https://example.com/old.jpg');
    assert.equal(alice.profileTint, undefined);
    assert.equal((await db.doc('handles/alice').get()).data().uid, 'alice');
  });
  it('serializes simultaneous claims into exactly one owner', async () => {
    const results = await Promise.allSettled(
      ['alice', 'bobby'].map(uid =>
        updateProfile.run(request(uid, {handle: 'same_name'})),
      ),
    );
    assert.equal(
      results.filter(result => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter(
        result =>
          result.status === 'rejected' &&
          result.reason.code === 'already-exists',
      ).length,
      1,
    );
    const winner = (await db.doc('handles/same_name').get()).data().uid;
    assert.equal(
      (await db.doc('users/' + winner).get()).data().handle,
      'same_name',
    );
    assert.equal((await db.doc('handles/' + winner).get()).exists, false);
    const loser = winner === 'alice' ? 'bobby' : 'alice';
    assert.equal((await db.doc('handles/' + loser).get()).data().uid, loser);
  });
  it('releases the previous username, keeps the same UID and history, and persists all five tints', async () => {
    const result = await updateProfile.run(
      request('alice', {
        handle: ' @New_ALICE ',
        displayName: ' Alice North ',
        bio: ' Updated bio ',
        profileTint: 'blue',
        timezone: 'America/New_York',
        avatarUrl: 'https://example.com/new.jpg',
        idToken: 'transport-token',
      }),
    );
    assert.equal(result.profile.id, 'alice');
    assert.equal(result.profile.handle, 'new_alice');
    assert.equal(result.profile.name, 'Alice North');
    assert.equal((await db.doc('handles/alice').get()).exists, false);
    await updateProfile.run(request('bobby', {handle: 'alice'}));
    assert.equal((await db.doc('handles/alice').get()).data().uid, 'bobby');
    assert.equal(
      (await db.doc('circles/shared/members/alice').get()).data().uid,
      'alice',
    );
    assert.equal(
      (await db.doc('userPrivate/alice/progress/current').get()).data().totalXP,
      100,
    );
    for (const profileTint of ['green', 'blue', 'purple', 'orange', 'gold']) {
      await updateProfile.run(request('alice', {profileTint}));
      assert.equal(
        (await db.doc('users/alice').get()).data().profileTint,
        profileTint,
      );
    }
    const saved = (await db.doc('users/alice').get()).data();
    assert.equal(saved.timezone, 'America/New_York');
    assert.equal(saved.avatarUrl, 'https://example.com/new.jpg');
    assert.equal(
      (await db.doc('circles/shared/events/historical').get()).data().actor
        .handle,
      'alice',
    );
  });
  it('projects the latest current identity on replay while preserving membership and historical snapshots', async () => {
    const before = await db.doc('users/alice').get();
    await updateProfile.run(
      request('alice', {handle: 'renamed', displayName: 'Current Name'}),
    );
    const after = await db.doc('users/alice').get();
    await updateProfile.run(request('alice', {displayName: 'Newest Name'}));
    await refreshMemberProfile.run({
      params: {uid: 'alice'},
      data: {before, after},
    });
    const member = (await db.doc('circles/shared/members/alice').get()).data();
    assert.equal(member.displayName, 'Newest Name');
    assert.equal(member.handle, 'renamed');
    assert.equal(member.joinedAt, 123);
    assert.equal(member.uid, 'alice');
    assert.equal(
      (await db.doc('circles/shared/events/historical').get()).data().actor
        .displayName,
      'alice',
    );
  });
  it('defaults missing tint without a backfill and protects username ownership from client writes', async () => {
    const result = await updateProfile.run(request('alice', {bio: null}));
    assert.equal(result.profile.profileTint, 'green');
    assert.equal(
      (await db.doc('users/alice').get()).data().profileTint,
      undefined,
    );
    const client = environment.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(client, 'users/alice'), {handle: 'bobby'}));
    await assertFails(
      updateDoc(doc(client, 'users/alice'), {profileTint: 'purple'}),
    );
    await assertFails(updateDoc(doc(client, 'handles/bobby'), {uid: 'alice'}));
  });
});
