import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(
  new URL('../hosting/beta.js', import.meta.url),
  'utf8',
);
function run({
  path = '/',
  query = '',
  configured = true,
  session = new Map(),
  local = new Map(),
  dnt = false,
} = {}) {
  const events = [],
    handlers = {},
    toggle = {};
  const context = {
    window: {
      HOYST_BETA_CONFIG: {
        posthogProjectKey: configured ? 'phc_test' : '',
        posthogHost: 'https://us.i.posthog.com',
      },
    },
    location: {hostname: 'hoyst.app', pathname: path, search: query},
    navigator: {doNotTrack: dnt ? '1' : '0'},
    URLSearchParams,
    Date,
    JSON,
    crypto: {randomUUID: () => 'anonymous-random-session'},
    localStorage: {
      getItem: key => local.get(key),
      setItem: (key, value) => local.set(key, value),
    },
    sessionStorage: {
      getItem: key => session.get(key),
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key),
    },
    document: {
      querySelector: selector =>
        selector === '[data-analytics-toggle]' ? toggle : null,
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
    },
    fetch: (url, options) => {
      events.push({
        url,
        ...JSON.parse(options.body),
        referrerPolicy: options.referrerPolicy,
      });
      return Promise.resolve({});
    },
  };
  toggle.addEventListener = (_, fn) => {
    handlers.toggle = fn;
  };
  runInNewContext(source, context);
  return {events, handlers, session, local};
}
test('captures safe campaign fields without full URL, invite code, unknown UTM values or referrer', () => {
  const {events} = run({
    path: '/join/private-invite-token',
    query:
      '?utm_source=instagram&utm_medium=organic_social&utm_campaign=ios_beta_20261101&utm_content=kgcodes_demo&email=private@example.invalid',
  });
  assert.equal(events.length, 2);
  assert.equal(events[1].properties.page_type, 'invite');
  assert.equal(events[1].properties.utm_source, 'instagram');
  assert.equal(events[1].referrerPolicy, 'no-referrer');
  assert.doesNotMatch(
    JSON.stringify(events),
    /private-invite-token|private@example|current_url|referrer_url/,
  );
  assert.equal(
    run({
      query:
        '?utm_source=private@example.invalid&utm_content=secret_commitment',
    }).events[0].properties.utm_content,
    undefined,
  );
});
test('counts one session across pages and records clicks separately from installations', () => {
  const first = run();
  const second = run({session: first.session});
  assert.equal(
    second.events.filter(event => event.event === 'website_session_started')
      .length,
    0,
  );
  second.handlers.click({
    target: {closest: () => ({getAttribute: () => 'testflight'})},
  });
  assert.equal(second.events.at(-1).event, 'testflight_clicked');
  assert.equal(
    second.events.at(-1).properties.distinct_id,
    'anonymous-random-session',
  );
});
test('does nothing without configuration, respects privacy signals, and stops after opt-out', () => {
  assert.equal(run({configured: false}).events.length, 0);
  assert.equal(run({dnt: true}).events.length, 0);
  const configured = run();
  configured.handlers.toggle();
  configured.handlers.click({
    target: {closest: () => ({getAttribute: () => 'testflight'})},
  });
  assert.equal(configured.events.length, 2);
  assert.equal(run({local: configured.local}).events.length, 0);
});
