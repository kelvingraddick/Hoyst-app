import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createResendProvider} = require('../functions/lib/updates/resend');
const {renderInvitePage} = require('../functions/lib/invites/page');
const {
  handleLaunchSignup,
  handleUpdatesConfirmation,
} = require('../functions/lib/updates');
const config = {
  enabled: true,
  apiKey: 'test-not-a-real-key',
  from: 'Hoyst <updates@hoyst.app>',
  domainId: 'domain',
  segmentId: 'updates',
  topicId: 'news',
};
test('the checkbox label matches the consent text retained by the server', () => {
  const {readFileSync} = require('node:fs');
  const {CONSENT_TEXT} = require('../functions/lib/updates/service');
  const html = readFileSync(
    new URL('../hosting/index.html', import.meta.url),
    'utf8',
  );
  assert.ok(html.replace(/\s+/g, ' ').includes(CONSENT_TEXT));
  const checkbox = html.match(/<input[^>]*id="updates-consent"[^>]*>/)?.[0];
  assert.ok(checkbox);
  assert.match(checkbox, /required/);
  assert.doesNotMatch(checkbox, /\bchecked(?:\s|=|\/|>)/);
});
function providerWith(routes) {
  const calls = [];
  return {
    calls,
    provider: createResendProvider(config, async (url, options) => {
      calls.push({path: new URL(url).pathname, ...options});
      const result = routes[new URL(url).pathname];
      return new Response(JSON.stringify(result?.body || result || {}), {
        status: typeof result?.status === 'number' ? result.status : 200,
      });
    }),
  };
}
test('requires a verified sender domain matching the configured from address', async () => {
  for (const domain of [
    {status: 'pending', name: 'hoyst.app'},
    {status: 'verified', name: 'other.example'},
  ])
    await assert.rejects(
      providerWith({'/domains/domain': domain}).provider.ready(),
      e => e.status === 503,
    );
  await providerWith({
    '/domains/domain': {status: 'verified', name: 'hoyst.app'},
  }).provider.ready();
  const disabled = createResendProvider({...config, enabled: false}, () => {
    throw Error('must not call provider');
  });
  await assert.rejects(disabled.ready(), e => e.status === 503);
});
test('confirmation sends an idempotent email with an expiring link and no automatic subscription', async () => {
  const {provider, calls} = providerWith({'/emails': {id: 'email'}});
  await provider.sendConfirmation(
    'demo@example.invalid',
    'https://hoyst.app/updates/confirm?token=test',
    'stable-key',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/emails');
  assert.equal(calls[0].headers['Idempotency-Key'], 'stable-key');
  const body = JSON.parse(calls[0].body);
  assert.match(body.text, /24 hours/);
  assert.match(body.html, /Confirm my email/);
});
test('subscribed contacts enter the intended segment and topic; opt-out preferences are preserved', async () => {
  const fresh = providerWith({
    '/contacts/demo%40example.invalid': {status: 404},
  });
  assert.equal(
    await fresh.provider.subscribe('demo@example.invalid'),
    'subscribed',
  );
  const body = JSON.parse(fresh.calls.find(c => c.path === '/contacts').body);
  assert.deepEqual(body.topics, [{id: 'news', subscription: 'opt_in'}]);
  assert.deepEqual(body.segments, [{id: 'updates'}]);
  for (const routes of [
    {'/contacts/demo%40example.invalid': {unsubscribed: true}},
    {
      '/contacts/demo%40example.invalid': {unsubscribed: false},
      '/contacts/demo%40example.invalid/topics': {
        data: [{id: 'news', subscription: 'opt_out'}],
      },
      '/contacts/demo%40example.invalid/segments': {
        data: [{id: 'updates'}],
        has_more: false,
      },
    },
  ]) {
    const {provider, calls} = providerWith(routes);
    assert.equal(
      await provider.subscribe('demo@example.invalid'),
      'unsubscribed',
    );
    assert.ok(calls.every(c => c.method === 'GET'));
  }
});
test('provider failures propagate instead of reporting subscription success', async () => {
  const {provider} = providerWith({
    '/contacts/demo%40example.invalid': {status: 404},
    '/contacts': {status: 500},
  });
  await assert.rejects(
    provider.subscribe('demo@example.invalid'),
    e => e.status === 503,
  );
});
const sample = {
  circleId: 'test',
  title: 'Workout Crew',
  commitment: 'Three workouts a week. In it together.',
  category: 'Fitness',
  cadenceLabel: 'Weekly',
  commitmentCadence: 'weekly',
  commitmentFrequency: {tapInsPerWeek: 3},
  memberCount: 4,
  maxSize: 8,
  isFull: false,
  joinMode: 'open',
};
function invite(preview = sample) {
  return renderInvitePage({
    description: 'Group accountability',
    inviteCode: 'abc123def456',
    preview,
    statusCode: preview ? 200 : 404,
    title: preview ? 'Join Workout Crew' : 'Invite no longer available',
  });
}
test('invite states preserve explicit deep links, beta instrumentation and privacy boundaries', () => {
  for (const [overrides, expected] of [
    [{}, 'Open to join'],
    [{joinMode: 'invite_only'}, 'Invite only'],
    [{joinMode: 'request_to_join'}, 'Approval required'],
    [{isFull: true}, 'Circle full'],
  ]) {
    const html = invite({...sample, ...overrides});
    assert.match(html, new RegExp(expected));
    assert.match(html, /href="hoyst:\/\/join\/abc123def456"/);
    assert.match(html, /data-beta-action="testflight"/);
    assert.match(html, /3 Tap Ins per week/);
    assert.match(html, /noindex,nofollow,noarchive/);
    assert.doesNotMatch(html, /updates-form|type="email"/);
  }
  const unavailable = renderInvitePage({
    statusCode: 404,
    title: 'Invite no longer available',
    description: 'Ask for a fresh link.',
  });
  assert.doesNotMatch(unavailable, /hoyst:\/\/join/);
  assert.match(unavailable, /Ask for a fresh link/);
  const hostile = invite({
    ...sample,
    title: '<script>alert("x")</script>',
    commitment: '<img src=x onerror=alert(1)>',
  });
  assert.doesNotMatch(hostile, /<script>alert|<img src=x/);
  assert.match(hostile, /&lt;script&gt;/);
  const duplicate = invite({
    ...sample,
    title: 'Same title',
    commitment: 'Same title',
  });
  assert.equal((duplicate.match(/Same title/g) || []).length, 1);
});
function response() {
  return {
    code: 200,
    headers: {},
    body: '',
    set(k, v) {
      if (typeof k === 'object') Object.assign(this.headers, k);
      else this.headers[k] = v;
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
const request = (method, body = {}, headers = {}, query = {}) => ({
  method,
  body,
  query,
  ip: 'test',
  get: key => headers[key.toLowerCase()],
});
test('GET confirmation is read-only and protected from token or email analytics disclosure', async () => {
  const deps = {
    db: new Proxy(
      {},
      {
        get() {
          throw Error('GET must not access a datastore');
        },
      },
    ),
    origin: 'https://hoyst.app',
  };
  const res = response();
  await handleUpdatesConfirmation(
    request('GET', {}, {}, {token: 'a'.repeat(43)}),
    res,
    deps,
  );
  assert.equal(res.code, 200);
  assert.match(res.body, /method="post"/);
  assert.match(res.body, /Confirm my email/);
  assert.doesNotMatch(res.body, /beta.js|beta-config.js|posthogProjectKey/);
  assert.equal(res.headers['Referrer-Policy'], 'strict-origin');
  const invalid = response();
  await handleUpdatesConfirmation(
    request('GET', {}, {}, {token: '<script>'}),
    invalid,
    deps,
  );
  assert.equal(invalid.code, 400);
  assert.doesNotMatch(invalid.body, /<script>/);
});
test('signup rejects cross-origin submissions, wrong methods, invalid addresses and oversized requests', async () => {
  const deps = {
    origin: 'https://hoyst.app',
    secret: 'a'.repeat(32),
    provider: {
      ready() {
        throw Error('must not reach provider');
      },
    },
  };
  for (const [req, code] of [
    [request('GET'), 405],
    [request('POST', {}, {origin: 'https://evil.invalid'}), 403],
    [request('POST', {email: 'wrong'}, {accept: 'application/json'}), 400],
    [
      request(
        'POST',
        {email: 'demo@example.invalid'},
        {accept: 'application/json'},
      ),
      400,
    ],
    [request('POST', {email: 'demo@example.invalid', consent: false}), 400],
    [
      request(
        'POST',
        {email: 'demo@example.invalid', consent: 'yes'},
        {'content-type': 'application/json'},
      ),
      400,
    ],
    [request('POST', {}, {'content-length': '3000'}), 413],
  ]) {
    const res = response();
    await handleLaunchSignup(req, res, deps);
    assert.equal(res.code, code);
  }
});

test('Resend rate limits use bounded retry and respect Retry-After', async () => {
  let requests = 0;
  const delays = [];
  const provider = createResendProvider(
    config,
    async () => {
      requests++;
      return requests === 1
        ? new Response('{}', {status: 429, headers: {'Retry-After': '2'}})
        : new Response(JSON.stringify({status: 'verified', name: 'hoyst.app'}));
    },
    {
      sleep: async ms => {
        delays.push(ms);
      },
      random: () => 0,
    },
  );
  await provider.ready();
  assert.equal(requests, 2);
  assert.deepEqual(delays, [2000]);
  let attempts = 0;
  const failed = createResendProvider(
    config,
    async () => {
      attempts++;
      return new Response('{}', {status: 429});
    },
    {sleep: async () => {}, random: () => 0},
  );
  await assert.rejects(failed.ready(), e => e.status === 503);
  assert.equal(attempts, 4);
});

test('fragment confirmation landing never reads storage or subscribes before a click', async () => {
  const res = response();
  await handleUpdatesConfirmation(request('GET'), res, {
    db: new Proxy(
      {},
      {
        get() {
          throw Error('must not access storage');
        },
      },
    ),
    origin: 'https://hoyst.app',
  });
  assert.equal(res.code, 200);
  assert.match(res.body, /id="confirmation-button"[^>]*disabled/);
  assert.match(res.body, /updates-confirmation.js/);
  assert.doesNotMatch(res.body, /beta.js/);
});

test('an existing other-product contact may explicitly confirm Hoyst without clearing global preferences', async () => {
  const {provider, calls} = providerWith({
    '/contacts/demo%40example.invalid': {id: 'existing', unsubscribed: false},
    '/contacts/demo%40example.invalid/topics': {
      data: [{id: 'news', subscription: 'opt_out'}],
      has_more: false,
    },
    '/contacts/demo%40example.invalid/segments': {
      data: [{id: 'other-product'}],
      has_more: false,
    },
  });
  assert.equal(await provider.subscribe('demo@example.invalid'), 'subscribed');
  const changed = calls.filter(c => c.method === 'PATCH');
  assert.equal(changed.length, 1);
  assert.ok(changed[0].path.endsWith('/topics'));
  // Resend's raw REST contract requires an array; a topics object returns 422.
  assert.deepEqual(JSON.parse(changed[0].body), [
    {id: 'news', subscription: 'opt_in'},
  ]);
  const fresh = providerWith({
    '/contacts/demo%40example.invalid': {status: 404},
  });
  await fresh.provider.subscribe('demo@example.invalid');
  assert.equal(
    JSON.parse(fresh.calls.find(c => c.path === '/contacts').body).unsubscribed,
    undefined,
  );
});
