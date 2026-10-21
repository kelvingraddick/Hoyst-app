const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockOptIn = jest.fn();
const mockOptOut = jest.fn();
const mockStorage = new Map<string, string>();
let mockOptions: Record<string, any>;
jest.mock('../src/config/env', () => ({
  env: {
    posthogKey: 'phc_test',
    posthogHost: 'https://us.i.posthog.com',
    analyticsDebug: true,
    analyticsInternal: false,
    appEnv: 'beta',
  },
}));
jest.mock('../src/features/settings/services/app-info', () => ({
  getInstalledAppInfo: () => ({version: '1.0', build: '51'}),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));
jest.mock('posthog-react-native', () => ({
  PostHogPersistedProperty: {Queue: 'queue'},
  PostHog: class {
    constructor(_key: string, options: Record<string, any>) {
      mockOptions = options;
    }
    identify = mockIdentify;
    capture = mockCapture;
    reset = mockReset;
    optIn = mockOptIn;
    optOut = mockOptOut;
    fetch = jest.fn();
    setPersistedProperty = jest.fn();
  },
}));
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockStorage.clear();
});

it('deduplicates confirmed saves and strips SDK-added content before transmission', async () => {
  const analytics = require('../src/lib/analytics');
  analytics.identifyAnalytics('uid-1');
  await Promise.all([
    analytics.trackEventOnce(
      'tap_in_saved',
      {outcome: 'partial', mode: 'personal', cadence: 'daily'},
      'save-1',
    ),
    analytics.trackEventOnce('tap_in_saved', {outcome: 'partial'}, 'save-1'),
  ]);
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledWith(
    'tap_in_saved',
    expect.objectContaining({outcome: 'partial', app_build: '51'}),
  );
  const event = mockOptions.before_send({
    event: 'tap_in_saved',
    properties: {
      $geoip_disable: false,
      outcome: 'partial',
      note: 'private note',
      $current_url: 'https://hoyst.app/join/private',
      email: 'private@example.invalid',
      $set: {name: 'Private'},
      distinct_id: 'uid-1',
    },
  });
  expect(event.properties).toEqual({
    $geoip_disable: true,
    outcome: 'partial',
    distinct_id: 'uid-1',
  });
  expect(
    mockOptions.before_send({event: '$autocapture', properties: {}}),
  ).toBeNull();
  expect(mockOptions.enableSessionReplay).toBe(false);
  expect(mockOptions.captureAppLifecycleEvents).toBe(false);
});

it('resets identity on logout and does not attach pending account events to another account', async () => {
  const analytics = require('../src/lib/analytics');
  analytics.identifyAnalytics('uid-1');
  await settle();
  analytics.identifyAnalytics(undefined);
  await settle();
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockIdentify).toHaveBeenCalledWith('uid-1');
  analytics.identifyAnalytics('uid-2');
  const pending = analytics.trackEventOnce(
    'onboarding_completed',
    {},
    'onboard-2',
  );
  analytics.identifyAnalytics('uid-3');
  await pending;
  expect(mockCapture).not.toHaveBeenCalledWith(
    'onboarding_completed',
    expect.anything(),
  );
});

it('honors a stored opt-out before initializing the SDK and survives unavailable telemetry', async () => {
  mockStorage.set('hoyst-analytics-enabled', 'false');
  const analytics = require('../src/lib/analytics');
  await analytics.trackEventOnce('onboarding_completed', {}, 'onboard-1');
  expect(mockCapture).not.toHaveBeenCalled();
  await analytics.setAnalyticsEnabled(true);
  mockCapture.mockImplementationOnce(() => {
    throw new Error('telemetry unavailable');
  });
  expect(() =>
    analytics.trackEvent('app_opened', {entry: 'launch'}),
  ).not.toThrow();
  await settle();
  await analytics.setAnalyticsEnabled(false);
  analytics.trackEvent('app_opened', {entry: 'foreground'});
  await settle();
  expect(mockOptOut).toHaveBeenCalled();
  expect(mockStorage.get('hoyst-analytics-enabled')).toBe('false');
});

it('clears a persisted SDK account before capturing a cold signed-out launch', async () => {
  const analytics = require('../src/lib/analytics');
  analytics.identifyAnalytics(undefined);
  analytics.trackEvent('app_opened', {entry: 'launch'});
  await settle();
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledWith(
    'app_opened',
    expect.objectContaining({entry: 'launch'}),
  );
  expect(mockReset.mock.invocationCallOrder[0]).toBeLessThan(
    mockCapture.mock.invocationCallOrder[0],
  );
});
