import Config from 'react-native-config';

export const env = {
  appEnv: Config.APP_ENV ?? 'development',
  googleIosClientId: Config.GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: Config.GOOGLE_WEB_CLIENT_ID ?? '',
  instagramAppId: Config.INSTAGRAM_APP_ID ?? '',
  oneSignalAppId: Config.ONESIGNAL_APP_ID ?? '',
  posthogKey: Config.POSTHOG_PROJECT_KEY ?? '',
  posthogHost: Config.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  analyticsDebug: Config.ANALYTICS_DEBUG === 'true',
  analyticsInternal: Config.ANALYTICS_INTERNAL === 'true',
  sentryDsn: Config.SENTRY_DSN ?? '',
} as const;

export function isEnvConfigured(): boolean {
  return Boolean(env.appEnv);
}
