import {Platform} from 'react-native';
import type {PostHog} from 'posthog-react-native';
import {env} from '../../config/env';
import {getInstalledAppInfo} from '../../features/settings/services/app-info';

export type AcquisitionSource =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'threads'
  | 'x'
  | 'youtube'
  | 'email'
  | 'friend'
  | 'other';
type CommitmentProperties = {
  mode?: 'personal' | 'group';
  cadence?: 'daily' | 'weekly' | 'monthly';
};
export type AnalyticsEvents = {
  app_opened: {entry: 'launch' | 'foreground'};
  onboarding_started: {entry: 'standard' | 'invite'};
  onboarding_completed: Record<string, never>;
  commitment_created: CommitmentProperties;
  circle_joined: {mode: 'group'};
  circle_join_requested: {mode: 'group'};
  circle_join_reviewed: {outcome: 'approved' | 'declined'};
  tap_in_saved: CommitmentProperties & {
    outcome: 'done' | 'partial' | 'failed' | 'skip';
  };
  invite_opened: Record<string, never>;
  feedback_contact_opened: {
    intent: 'support' | 'feature';
    channel: 'instagram' | 'email';
  };
  acquisition_source_selected: {source: AcquisitionSource};
  acquisition_source_skipped: Record<string, never>;
  screen_viewed: {screen: string};
};
const eventNames = new Set([
  ...Object.keys({
    app_opened: 1,
    onboarding_started: 1,
    onboarding_completed: 1,
    commitment_created: 1,
    circle_joined: 1,
    circle_join_requested: 1,
    circle_join_reviewed: 1,
    tap_in_saved: 1,
    invite_opened: 1,
    feedback_contact_opened: 1,
    acquisition_source_selected: 1,
    acquisition_source_skipped: 1,
    screen_viewed: 1,
  }),
  '$identify',
]);
const allowedProperties = new Set([
  'entry',
  'mode',
  'cadence',
  'outcome',
  'intent',
  'channel',
  'source',
  'screen',
  'app_version',
  'app_build',
  'environment',
  'is_internal',
  'platform',
  'distinct_id',
  '$anon_distinct_id',
  '$device_id',
  '$session_id',
  '$lib',
  '$lib_version',
]);

// Also filters SDK-added metadata. Never send route params, URLs or user content.
export function sanitizeAnalyticsEvent<
  T extends {event: string; properties?: Record<string, unknown>},
>(event: T): T | null {
  if (!eventNames.has(event.event)) {
    return null;
  }
  return {
    ...event,
    properties: {
      $geoip_disable: true,
      ...Object.fromEntries(
        Object.entries(event.properties ?? {}).filter(
          ([key, value]) =>
            allowedProperties.has(key) &&
            (typeof value === 'string' || typeof value === 'boolean'),
        ),
      ),
    },
  };
}

let client: PostHog | undefined;
let attempted = false;
let identity: string | undefined;
let enabled = true;
let preferenceRevision = 0;
let initialization = Promise.resolve();
let onceQueue = Promise.resolve();
const recentKeys = new Set<string>();
const onceStorageKey = 'hoyst-analytics-once-v1';
const preferenceStorageKey = 'hoyst-analytics-enabled';
function storage() {
  return require('@react-native-async-storage/async-storage')
    .default as typeof import('@react-native-async-storage/async-storage').default;
}
function createClient() {
  if (
    client ||
    !enabled ||
    !env.posthogKey.startsWith('phc_') ||
    !['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(
      env.posthogHost,
    ) ||
    (__DEV__ && !env.analyticsDebug)
  ) {
    return;
  }
  try {
    const {PostHog: PostHogClient} =
      require('posthog-react-native') as typeof import('posthog-react-native');
    class PrivatePostHog extends PostHogClient {
      fetch(
        url: Parameters<PostHog['fetch']>[0],
        options: Parameters<PostHog['fetch']>[1],
      ) {
        if (!enabled) {
          return Promise.resolve({
            status: 200,
            text: async () => '',
            json: async () => ({}),
          });
        }
        return super.fetch(url, options);
      }
    }
    client = new PrivatePostHog(env.posthogKey, {
      host: env.posthogHost,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      capturePushNotificationOpened: false,
      capturePushNotificationSubscriptions: false,
      setDefaultPersonProperties: false,
      preloadFeatureFlags: false,
      disableRemoteFeatureFlags: true,
      disableSurveys: true,
      disableRemoteConfig: true,
      customAppProperties: {},
      before_send: event => (enabled ? sanitizeAnalyticsEvent(event) : null),
    });
    if (identity) {
      client.identify(identity);
    } else {
      // A cold signed-out launch must not reuse an account restored by the SDK.
      client.reset();
    }
  } catch {
    client = undefined;
  }
}
export function initializeAnalytics(): void {
  if (attempted) {
    return;
  }
  attempted = true;
  if (!env.posthogKey.startsWith('phc_') || (__DEV__ && !env.analyticsDebug)) {
    return;
  }
  const revision = preferenceRevision;
  initialization = getAnalyticsEnabled()
    .then(value => {
      if (revision === preferenceRevision) {
        enabled = value;
      }
      createClient();
    })
    .catch(() => undefined);
}
export async function getAnalyticsEnabled(): Promise<boolean> {
  try {
    return (await storage().getItem(preferenceStorageKey)) !== 'false';
  } catch {
    return false;
  }
}
export async function setAnalyticsEnabled(value: boolean): Promise<void> {
  preferenceRevision += 1;
  enabled = value;
  try {
    if (value) {
      createClient();
      await client?.optIn();
    } else {
      await client?.optOut();
      if (client) {
        const {PostHogPersistedProperty} =
          require('posthog-react-native') as typeof import('posthog-react-native');
        client.setPersistedProperty(PostHogPersistedProperty.Queue, []);
      }
    }
    await storage().setItem(preferenceStorageKey, String(value));
  } catch {
    /* The in-memory preference still applies if persistence fails. */
  }
}
export function identifyAnalytics(uid?: string): void {
  initializeAnalytics();
  if (uid === identity) {
    return;
  }
  const previous = identity;
  identity = uid;
  void initialization
    .then(() => {
      if (uid !== identity) {
        return;
      }
      try {
        if (previous) {
          client?.reset();
        }
        if (uid) {
          client?.identify(uid);
        }
      } catch {
        /* best effort */
      }
    })
    .catch(() => undefined);
}
function capture<K extends keyof AnalyticsEvents>(
  event: K,
  properties: AnalyticsEvents[K],
  timestamp?: Date,
) {
  try {
    if (!enabled) {
      return;
    }
    const info = getInstalledAppInfo();
    const payload = {
      ...properties,
      app_version: info.version ?? 'unknown',
      app_build: info.build ?? 'unknown',
      environment: env.appEnv,
      is_internal: env.analyticsInternal || __DEV__,
      platform: Platform.OS,
    };
    if (timestamp) {
      client?.capture(event, payload, {timestamp});
    } else {
      client?.capture(event, payload);
    }
  } catch {
    /* Telemetry must never block a product action. */
  }
}
export function trackEvent<K extends keyof AnalyticsEvents>(
  event: K,
  properties: AnalyticsEvents[K],
): void {
  initializeAnalytics();
  const uid = identity;
  void initialization
    .then(() => {
      if (uid === identity) {
        capture(event, properties);
      }
    })
    .catch(() => undefined);
}
// Serialized persistent deduplication survives remounts, save retries and app restarts.
// Keys stay on the device; they are never sent as event properties.
export function trackEventOnce<K extends keyof AnalyticsEvents>(
  event: K,
  properties: AnalyticsEvents[K],
  key: string,
  timestamp?: Date,
): Promise<void> {
  initializeAnalytics();
  const uid = identity;
  onceQueue = onceQueue
    .then(async () => {
      await initialization;
      if (!client || !enabled || recentKeys.has(key) || uid !== identity) {
        return;
      }
      try {
        const raw = await storage().getItem(onceStorageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const keys = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
        if (keys.includes(key) || uid !== identity) {
          return;
        }
        capture(event, properties, timestamp);
        recentKeys.add(key);
        await storage().setItem(
          onceStorageKey,
          JSON.stringify([...keys, key].slice(-2000)),
        );
      } catch {
        recentKeys.delete(key);
      }
    })
    .catch(() => undefined);
  return onceQueue;
}
export function flushAnalytics(): void {
  try {
    if (enabled) {
      void client?.flush().catch(() => undefined);
    }
  } catch {
    /* best effort */
  }
}
