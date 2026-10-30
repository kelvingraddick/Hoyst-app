import {test, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.GCLOUD_PROJECT?.startsWith('demo-')
)
  throw Error('A demo-project Firestore emulator is required.');
const {db} = require('../functions/lib/firebase');
const {
  requestUpdates,
  subscribeUpdates,
  CONSENT_TEXT,
  CONSENT_VERSION,
  confirmUpdates,
  tokenDigest,
} = require('../functions/lib/updates/service');
const {
  initializeTestEnvironment,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {doc, getDoc, setDoc} = require('firebase/firestore');
const {readFileSync} = require('node:fs');
let now = 1800000000000;
let next = 0;
let sent = [];
let subscribed = [];
let failSend = false;
let failSubscribe = false;
let optedOut = false;
let hold;
const deps = {
  db,
  secret: 'local-test-secret-at-least-32-characters',
  origin: 'https://hoyst.app',
  now: () => now,
  token: () => String(++next).padStart(43, 'a'),
  provider: {
    async ready() {},
    async sendConfirmation(email, url, key) {
      if (failSend) throw Error('provider offline');
      sent.push({email, url, key});
    },
    async subscribe(email) {
      if (hold) await hold;
      if (failSubscribe) throw Error('provider offline');
      subscribed.push(email);
      return optedOut ? 'unsubscribed' : 'subscribed';
    },
  },
};
const email = 'demo@example.invalid';
const token = () => new URL(sent.at(-1).url).hash.slice(1);
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`,
    {method: 'DELETE'},
  );
  now = 1800000000000;
  next = 0;
  sent = [];
  subscribed = [];
  failSend = false;
  failSubscribe = false;
  optedOut = false;
  hold = undefined;
});
after(async () => db.terminate());
test('double opt-in keeps addresses pending, stores only hashed tokens, and confirms once', async () => {
  await requestUpdates(' Demo@Example.Invalid ', 'ip-1', deps);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, email);
  assert.equal(subscribed.length, 0);
  const pending = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(pending.status, 'pending');
  assert.ok(pending.expiresAt);
  assert.equal(pending.token, undefined);
  assert.equal(pending.tokenHash, tokenDigest(token()));
  assert.equal(await confirmUpdates(token(), deps), 'confirmed');
  assert.deepEqual(subscribed, [email]);
  const confirmed = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.expiresAt, undefined);
  assert.ok(confirmed.confirmedAt);
  assert.equal(await confirmUpdates(token(), deps), 'already');
  assert.equal(subscribed.length, 1);
  await requestUpdates(email, 'ip-2', deps);
  assert.equal(sent.length, 1);
});
test('duplicate and concurrent requests share the cooldown; invalid emails and tokens fail', async () => {
  await Promise.all(
    Array.from({length: 4}, () => requestUpdates(email, 'ip-1', deps)),
  );
  assert.equal(sent.length, 1);
  await assert.rejects(
    requestUpdates('bad', 'ip-1', deps),
    e => e.status === 400,
  );
  await assert.rejects(confirmUpdates('bad', deps), e => e.status === 400);
  await assert.rejects(
    confirmUpdates('z'.repeat(43), deps),
    e => e.status === 410,
  );
});
test('confirmation expires and the most recent email replaces older tokens', async () => {
  await requestUpdates(email, 'ip', deps);
  const old = token();
  now += 61000;
  await requestUpdates(email, 'ip', deps);
  const latest = token();
  await assert.rejects(confirmUpdates(old, deps), e => e.status === 410);
  now += 86400001;
  await assert.rejects(confirmUpdates(latest, deps), e => e.status === 410);
  assert.equal(subscribed.length, 0);
});
test('delivery failures allow a retry without a false success or losing hourly limits', async () => {
  failSend = true;
  await assert.rejects(
    requestUpdates(email, 'ip', deps),
    e => e.status === 503,
  );
  assert.equal(sent.length, 0);
  failSend = false;
  await requestUpdates(email, 'ip', deps);
  assert.equal(sent.length, 1);
  now += 61000;
  await requestUpdates(email, 'ip', deps);
  now += 61000;
  await assert.rejects(
    requestUpdates(email, 'ip', deps),
    e => e.status === 429,
  );
});
test('provider confirmation failures release the claim for retry and preserve existing opt-outs', async () => {
  await requestUpdates(email, 'ip', deps);
  failSubscribe = true;
  await assert.rejects(confirmUpdates(token(), deps), e => e.status === 503);
  failSubscribe = false;
  optedOut = true;
  assert.equal(await confirmUpdates(token(), deps), 'unsubscribed');
  assert.equal(await confirmUpdates(token(), deps), 'unsubscribed');
  const record = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(record.status, 'unsubscribed');
  await requestUpdates(email, 'another-ip', deps);
  assert.equal(sent.length, 1);
});
test('concurrent confirmations claim one attempt and IP limits apply across addresses', async () => {
  await requestUpdates(email, 'ip', deps);
  let release;
  hold = new Promise(r => {
    release = r;
  });
  const first = confirmUpdates(token(), deps);
  // Wait for the durable claim rather than relying on a fixed delay.
  for (let i = 0; i < 100; i++) {
    const record = (
      await db.collection('websiteUpdateTokens').doc(tokenDigest(token())).get()
    ).data();
    if (record.processingUntil) break;
    await new Promise(r => setTimeout(r, 10));
  }
  await assert.rejects(confirmUpdates(token(), deps), e => e.status === 409);
  release();
  await first;
  assert.equal(subscribed.length, 1);
  hold = undefined;
  for (let i = 0; i < 9; i++)
    await requestUpdates(`other${i}@example.invalid`, 'ip', deps);
  await assert.rejects(
    requestUpdates('blocked@example.invalid', 'ip', deps),
    e => e.status === 429,
  );
});
test('signup, token and rate records are inaccessible to anonymous and signed-in app clients', async () => {
  const environment = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT,
    firestore: {
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]),
      rules: readFileSync(
        new URL('../firestore.rules', import.meta.url),
        'utf8',
      ),
    },
  });
  await requestUpdates(email, 'ip', deps);
  for (const collection of [
    'websiteUpdateSignups',
    'websiteUpdateTokens',
    'websiteUpdateRateLimits',
  ]) {
    const id = (await db.collection(collection).get()).docs[0].id;
    for (const context of [
      environment.unauthenticatedContext(),
      environment.authenticatedContext('some-member'),
    ]) {
      await assertFails(getDoc(doc(context.firestore(), collection, id)));
      await assertFails(
        setDoc(doc(context.firestore(), collection, id), {status: 'confirmed'}),
      );
    }
  }
  await environment.cleanup();
});

test('global hourly and daily caps stop email delivery across different IP addresses', async () => {
  const hour = db
    .collection('websiteUpdateRateLimits')
    .doc(`global-hour-${Math.floor(now / 3600000)}`);
  const day = db
    .collection('websiteUpdateRateLimits')
    .doc(`global-day-${Math.floor(now / 86400000)}`);
  await hour.set({count: 80});
  await assert.rejects(
    requestUpdates(email, 'new-ip', deps),
    e => e.status === 429,
  );
  assert.equal(sent.length, 0);
  await hour.set({count: 0});
  await day.set({count: 250});
  await assert.rejects(
    requestUpdates(email, 'another-ip', deps),
    e => e.status === 429,
  );
  assert.equal(sent.length, 0);
});

test('disabled signup never stores addresses or contacts the email provider', async () => {
  const disabled = {
    ...deps,
    available: false,
    db: new Proxy(
      {},
      {
        get() {
          throw Error('disabled signup must not access storage');
        },
      },
    ),
    provider: {
      ready() {
        throw Error('disabled signup must not call Resend');
      },
    },
  };
  await assert.rejects(
    requestUpdates(email, 'ip', disabled),
    e => e.status === 503,
  );
  await assert.rejects(
    subscribeUpdates(email, true, 'ip', disabled),
    e => e.status === 503,
  );
  await assert.rejects(
    confirmUpdates('a'.repeat(43), disabled),
    e => e.status === 503,
  );
});

test('checkbox consent subscribes immediately, records its evidence and never sends email or creates tokens', async () => {
  await subscribeUpdates(' Demo@Example.Invalid ', true, 'ip', deps);
  assert.deepEqual(subscribed, [email]);
  assert.equal(sent.length, 0);
  assert.equal((await db.collection('websiteUpdateTokens').get()).size, 0);
  const data = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(data.status, 'subscribed');
  assert.equal(data.emailVerified, false);
  assert.equal(data.consentText, CONSENT_TEXT);
  assert.equal(data.consentVersion, CONSENT_VERSION);
  assert.equal(data.consentMethod, 'website_checkbox');
  assert.equal(data.consentedAt.toMillis(), now);
  assert.equal(data.subscribedAt.toMillis(), now);
  assert.equal(data.expiresAt, undefined);
  await subscribeUpdates(email, true, 'another-ip', deps);
  assert.deepEqual(subscribed, [email]);
  assert.equal(sent.length, 0);
});

test('missing or false checkbox consent never accesses storage or the provider', async () => {
  const guarded = {
    ...deps,
    db: new Proxy(
      {},
      {
        get() {
          throw Error('must not access storage');
        },
      },
    ),
  };
  for (const consent of [undefined, false, 'true', 'yes', 1, null, []]) {
    await assert.rejects(
      subscribeUpdates(email, consent, 'ip', guarded),
      e => e.status === 400,
    );
  }
  assert.equal(subscribed.length, 0);
  assert.equal(sent.length, 0);
});

test('checkbox signup failures release the lease for retry but retain hourly caps', async () => {
  failSubscribe = true;
  await assert.rejects(
    subscribeUpdates(email, true, 'ip', deps),
    e => e.status === 503,
  );
  const failed = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(failed.status, 'pending');
  assert.equal(failed.processingUntil, undefined);
  failSubscribe = false;
  await subscribeUpdates(email, true, 'ip', deps);
  assert.equal(
    (await db.collection('websiteUpdateSignups').get()).docs[0].data().status,
    'subscribed',
  );
  failSubscribe = true;
  for (let i = 0; i < 3; i++) {
    await assert.rejects(
      subscribeUpdates('retry@example.invalid', true, 'retry-ip', deps),
      e => e.status === 503,
    );
  }
  await assert.rejects(
    subscribeUpdates('retry@example.invalid', true, 'retry-ip', deps),
    e => e.status === 429,
  );
  assert.equal(sent.length, 0);
});

test('concurrent checkbox submissions only start one provider subscription', async () => {
  let release;
  hold = new Promise(resolve => {
    release = resolve;
  });
  const first = subscribeUpdates(email, true, 'ip', deps);
  for (let i = 0; i < 100; i++) {
    if (
      (await db.collection('websiteUpdateSignups').get()).docs[0]?.data()
        .processingUntil
    )
      break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  await assert.rejects(
    subscribeUpdates(email, true, 'other-ip', deps),
    e => e.status === 409,
  );
  release();
  await first;
  assert.deepEqual(subscribed, [email]);
  await subscribeUpdates(email, true, 'third-ip', deps);
  assert.deepEqual(subscribed, [email]);
});

test('an expired checkbox lease can retry and a stale completion cannot overwrite it', async () => {
  let release;
  hold = new Promise(resolve => {
    release = resolve;
  });
  const first = subscribeUpdates(email, true, 'ip', deps);
  for (let i = 0; i < 100; i++) {
    if (
      (await db.collection('websiteUpdateSignups').get()).docs[0]?.data()
        .processingUntil
    )
      break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  now += 120001;
  hold = undefined;
  await subscribeUpdates(email, true, 'retry-ip', deps);
  const staleResult = assert.rejects(first, error => error.status === 409);
  release();
  await staleResult;
  const data = (
    await db.collection('websiteUpdateSignups').get()
  ).docs[0].data();
  assert.equal(data.status, 'subscribed');
  assert.equal(data.requests, 2);
  assert.equal(data.processingClaim, undefined);
  assert.equal(data.subscribedAt.toMillis(), now);
  assert.equal(sent.length, 0);
});

test('checkbox signup preserves opt-outs and does not replace legacy confirmed consent', async () => {
  optedOut = true;
  await subscribeUpdates(email, true, 'ip', deps);
  const ref = (await db.collection('websiteUpdateSignups').get()).docs[0].ref;
  assert.equal((await ref.get()).data().status, 'unsubscribed');
  optedOut = false;
  await subscribeUpdates(email, true, 'other-ip', deps);
  assert.deepEqual(subscribed, [email]);
  await ref.update({
    status: 'confirmed',
    consentVersion: 'older-confirmed-consent',
  });
  await subscribeUpdates(email, true, 'third-ip', deps);
  assert.equal(
    (await ref.get()).data().consentVersion,
    'older-confirmed-consent',
  );
  assert.deepEqual(subscribed, [email]);
});

test('an outstanding legacy confirmation becomes a safe replay after checkbox signup', async () => {
  await requestUpdates(email, 'ip', deps);
  const legacyToken = token();
  await subscribeUpdates(email, true, 'ip', deps);
  assert.equal(sent.length, 1);
  assert.deepEqual(subscribed, [email]);
  assert.equal(await confirmUpdates(legacyToken, deps), 'already');
  assert.deepEqual(subscribed, [email]);
});

test('IP and global limits apply to direct checkbox subscriptions before provider access', async () => {
  const hour = db
    .collection('websiteUpdateRateLimits')
    .doc(`global-hour-${Math.floor(now / 3600000)}`);
  await hour.set({count: 80});
  await assert.rejects(
    subscribeUpdates(email, true, 'ip', deps),
    e => e.status === 429,
  );
  assert.equal(subscribed.length, 0);
  await hour.set({count: 0});
  for (let i = 0; i < 10; i++)
    await subscribeUpdates(`person${i}@example.invalid`, true, 'same-ip', deps);
  await assert.rejects(
    subscribeUpdates('blocked@example.invalid', true, 'same-ip', deps),
    e => e.status === 429,
  );
  assert.equal(subscribed.length, 10);
  assert.equal(sent.length, 0);
});

test('JSON and plain HTML form consent both complete the same direct signup handler', async () => {
  const {handleLaunchSignup} = require('../functions/lib/updates');
  for (const [index, body, contentType] of [
    [1, {email: 'json@example.invalid', consent: true}, 'application/json'],
    [
      2,
      {email: 'form@example.invalid', consent: 'yes'},
      'application/x-www-form-urlencoded',
    ],
  ]) {
    const response = {
      code: 200,
      body: undefined,
      set() {
        return this;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
      send(value) {
        this.body = value;
        return this;
      },
    };
    await handleLaunchSignup(
      {
        method: 'POST',
        body,
        ip: `handler-${index}`,
        get: name =>
          ({
            origin: 'https://hoyst.app',
            accept: 'application/json',
            'content-type': contentType,
          }[name]),
      },
      response,
      deps,
    );
    assert.equal(response.code, 202);
    assert.match(response.body.message, /preferences are saved/);
  }
  assert.equal(sent.length, 0);
  assert.deepEqual(subscribed, [
    'json@example.invalid',
    'form@example.invalid',
  ]);
});
