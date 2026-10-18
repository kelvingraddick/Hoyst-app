import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {before, after, beforeEach, describe, it} from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Firestore emulator required.');
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {acceptLegalTerms} = require('../functions/lib/auth/legal');
const {completeProfile} = require('../functions/lib/auth');
const {updateProfile} = require('../functions/lib/profile/edit');
const {syncPublicProfile} = require('../functions/lib/profile/public');
const {
  deleteProviderAccounts,
} = require('../functions/lib/auth/provider-deletion');
const {
  deleteGreetingData,
  expireGreetingData,
} = require('../functions/lib/auth/greeting-data');
const {generateHomeGreeting} = require('../functions/lib/homeGreeting');
const {LEGAL_VERSION} = require('../functions/lib/shared/legal');
const acknowledgment = {
  adult: true,
  termsVersion: LEGAL_VERSION,
  privacyVersion: LEGAL_VERSION,
};
const request = (uid, data = {}) => ({
  auth: uid
    ? {uid, token: {firebase: {identities: {password: ['test@example.com']}}}}
    : undefined,
  data,
});
const profile = {
  displayName: 'Alice',
  handle: 'alice',
  avatarUrl: null,
  bio: 'Hello',
  timezone: 'America/New_York',
  providerIds: ['password'],
  onboardingStatus: 'complete',
  createdAt: new Date(),
};
let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT,
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
  await db.doc('users/alice').set(profile);
});

describe('Private account and public profile boundary', () => {
  it('allows exactly the four public fields and keeps account/acceptance/handle records private', async () => {
    await syncPublicProfile('alice');
    await acceptLegalTerms.run(request('alice', acknowledgment));
    await db.doc('handles/alice').set({uid: 'alice', createdAt: new Date()});
    assert.deepEqual((await db.doc('publicProfiles/alice').get()).data(), {
      displayName: 'Alice',
      handle: 'alice',
      avatarUrl: null,
      bio: 'Hello',
    });
    for (const context of [
      environment.unauthenticatedContext(),
      environment.authenticatedContext('bobby'),
    ]) {
      await assertSucceeds(
        getDoc(doc(context.firestore(), 'publicProfiles/alice')),
      );
      for (const path of ['users/alice', 'userPrivate/alice', 'handles/alice'])
        await assertFails(getDoc(doc(context.firestore(), path)));
    }
    const owner = environment.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(owner, 'users/alice')));
    await assertSucceeds(getDoc(doc(owner, 'userPrivate/alice')));
    await assertFails(
      setDoc(doc(owner, 'publicProfiles/alice'), {displayName: 'Fake'}),
    );
    await assertFails(
      setDoc(doc(owner, 'userPrivate/alice'), {
        legalAcceptance: acknowledgment,
      }),
    );
  });
  it('fails closed if a malformed public projection contains an internal field', async () => {
    await syncPublicProfile('alice');
    await db.doc('publicProfiles/alice').update({timezone: profile.timezone});
    await assertFails(
      getDoc(
        doc(
          environment.unauthenticatedContext().firestore(),
          'publicProfiles/alice',
        ),
      ),
    );
    await syncPublicProfile('alice');
    await assertSucceeds(
      getDoc(
        doc(
          environment.unauthenticatedContext().firestore(),
          'publicProfiles/alice',
        ),
      ),
    );
  });
  it('projects edits synchronously and does not republish after deletion or an old event', async () => {
    await updateProfile.run(
      request('alice', {displayName: 'Updated', timezone: 'UTC', bio: 'New'}),
    );
    assert.equal(
      (await db.doc('publicProfiles/alice').get()).data().displayName,
      'Updated',
    );
    assert.equal(
      Object.keys((await db.doc('publicProfiles/alice').get()).data()).length,
      4,
    );
    await db.doc('users/alice').update({accountDeletionStartedAt: new Date()});
    await syncPublicProfile('alice');
    assert.equal((await db.doc('publicProfiles/alice').get()).exists, false);
    await db.doc('users/alice').delete();
    await syncPublicProfile('alice');
    assert.equal((await db.doc('publicProfiles/alice').get()).exists, false);
  });
});

describe('Adult acknowledgment', () => {
  it('rejects anonymous, unchecked, and outdated acknowledgments', async () => {
    await assert.rejects(
      acceptLegalTerms.run(request(undefined, acknowledgment)),
      {code: 'unauthenticated'},
    );
    for (const data of [
      {},
      {...acknowledgment, adult: false},
      {...acknowledgment, termsVersion: 'old'},
      {...acknowledgment, privacyVersion: 'old'},
    ])
      await assert.rejects(acceptLegalTerms.run(request('alice', data)), {
        code: 'invalid-argument',
      });
    assert.equal((await db.doc('userPrivate/alice').get()).exists, false);
  });
  it('saves a server timestamp privately and requires it to complete signup', async () => {
    const input = {displayName: 'Alice', handle: 'alice', timezone: 'UTC'};
    await assert.rejects(completeProfile.run(request('alice', input)), {
      code: 'failed-precondition',
    });
    await acceptLegalTerms.run(
      request('alice', {...acknowledgment, acceptedAt: 'forged'}),
    );
    const saved = (await db.doc('userPrivate/alice').get()).data()
      .legalAcceptance;
    assert.equal(saved.adult, true);
    assert.equal(saved.termsVersion, LEGAL_VERSION);
    assert.equal(typeof saved.acceptedAt.toMillis(), 'number');
    await completeProfile.run(request('alice', input));
    assert.equal(
      (await db.doc('publicProfiles/alice').get()).data().handle,
      'alice',
    );
  });
  it('does not recreate private records for an account being deleted', async () => {
    await db.doc('users/alice').update({accountDeletionStartedAt: new Date()});
    await assert.rejects(
      acceptLegalTerms.run(request('alice', acknowledgment)),
      {code: 'failed-precondition'},
    );
    assert.equal((await db.doc('userPrivate/alice').get()).exists, false);
  });
  it('returns built-in greetings without any external requests before acknowledgment', async () => {
    const previous = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error('Unexpected external request');
    };
    try {
      const result = await generateHomeGreeting.run(
        request('alice', {
          dateKey: '2026-10-17',
          firstName: 'Alice',
          timeWindow: 'morning',
          circleSummary: {
            circleCount: 1,
            atRiskCount: 0,
            doneCount: 0,
            needsYouCount: 1,
            pendingCount: 0,
          },
        }),
      );
      assert.equal(result.source, 'fallback');
      assert.equal(calls, 0);
    } finally {
      global.fetch = previous;
    }
  });
});

describe('Provider deletion', () => {
  it('deletes the matching provider identities and accepts absent users on retries', async () => {
    const calls = [];
    await deleteProviderAccounts(
      'alice/test',
      {
        oneSignalAppId: 'app',
        oneSignalKey: 'test-key',
        revenueCatKey: 'test-secret',
      },
      async (url, options) => {
        calls.push({url, options});
        return {ok: false, status: 404};
      },
    );
    assert.equal(calls.length, 2);
    assert.ok(
      calls.every(
        call =>
          call.options.method === 'DELETE' && call.url.endsWith('alice%2Ftest'),
      ),
    );
    assert.equal(calls[0].options.headers.Authorization, 'Key test-key');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-secret');
  });
  it('propagates transient/configuration failures for retry and never sends an unconfigured request', async () => {
    let calls = 0;
    await assert.rejects(
      deleteProviderAccounts('alice', {oneSignalAppId: 'app'}, async () => {
        calls++;
      }),
      {code: 'unavailable'},
    );
    assert.equal(calls, 0);
    for (const status of [401, 429, 503])
      await assert.rejects(
        deleteProviderAccounts(
          'alice',
          {oneSignalAppId: 'app', oneSignalKey: 'test'},
          async () => ({ok: false, status}),
        ),
        {code: 'unavailable'},
      );
    await deleteProviderAccounts('alice', {}, async () => {
      throw new Error('No providers configured');
    });
  });
});

it('deletes only the selected account’s greeting records and expires legacy caches', async () => {
  const functionsRequire = createRequire(
    new URL('../functions/package.json', import.meta.url),
  );
  const {Timestamp} = functionsRequire('firebase-admin/firestore');
  const now = Date.now();
  await db
    .doc('homeGreetingCache/alice-new')
    .set({ownerUid: 'alice', updatedAt: Timestamp.fromMillis(now)});
  await db
    .doc('homeGreetingCache/bobby-new')
    .set({ownerUid: 'bobby', updatedAt: Timestamp.fromMillis(now)});
  await db.doc('homeGreetingCache/legacy').set({
    firstName: 'Legacy',
    updatedAt: Timestamp.fromMillis(now - 49 * 60 * 60 * 1000),
  });
  await db.doc('homeGreetingUsage/current/users/alice').set({uid: 'alice'});
  await db.doc('homeGreetingUsage/current/users/bobby').set({uid: 'bobby'});
  await db.doc('users/alice').set({uid: 'alice'}, {merge: true});
  await deleteGreetingData('alice');
  assert.equal(
    (await db.doc('homeGreetingCache/alice-new').get()).exists,
    false,
  );
  assert.equal(
    (await db.doc('homeGreetingUsage/current/users/alice').get()).exists,
    false,
  );
  assert.equal(
    (await db.doc('homeGreetingUsage/current/users/bobby').get()).exists,
    true,
  );
  assert.equal((await db.doc('users/alice').get()).exists, true);
  await expireGreetingData(now);
  assert.equal((await db.doc('homeGreetingCache/legacy').get()).exists, false);
  assert.equal(
    (await db.doc('homeGreetingCache/bobby-new').get()).exists,
    true,
  );
});

it('rejects late acknowledgment and profile recreation after account records have been deleted', async () => {
  await acceptLegalTerms.run(request('alice', acknowledgment));
  await db.doc('accountDeletions/alice').set({startedAt: new Date()});
  await db.doc('users/alice').delete();
  await assert.rejects(acceptLegalTerms.run(request('alice', acknowledgment)), {
    code: 'failed-precondition',
  });
  await assert.rejects(
    completeProfile.run(
      request('alice', {
        displayName: 'Alice',
        handle: 'alice',
        timezone: 'UTC',
      }),
    ),
    {code: 'failed-precondition'},
  );
  assert.equal((await db.doc('users/alice').get()).exists, false);
});

it('backfills public profiles with a dry run by default and repairs orphan/extra fields', async () => {
  await db
    .doc('publicProfiles/alice')
    .set({...profile, secret: 'must not be public'});
  await db
    .doc('publicProfiles/orphan')
    .set({displayName: 'Old', handle: 'old', avatarUrl: null, bio: null});
  const args = [
    'scripts/migrate-public-profiles.mjs',
    '--project=' + process.env.GCLOUD_PROJECT,
  ];
  const dry = JSON.parse(
    execFileSync(process.execPath, args, {encoding: 'utf8'}).trim(),
  );
  assert.equal(dry.mode, 'dry-run');
  assert.equal(dry.changed, 2);
  assert.equal(
    (await db.doc('publicProfiles/alice').get()).data().secret,
    'must not be public',
  );
  execFileSync(process.execPath, [...args, '--commit'], {encoding: 'utf8'});
  const verified = JSON.parse(
    execFileSync(process.execPath, args, {encoding: 'utf8'}).trim(),
  );
  assert.equal(verified.changed, 0);
  assert.equal((await db.doc('publicProfiles/orphan').get()).exists, false);
  assert.deepEqual(
    Object.keys((await db.doc('publicProfiles/alice').get()).data()).sort(),
    ['avatarUrl', 'bio', 'displayName', 'handle'],
  );
});
