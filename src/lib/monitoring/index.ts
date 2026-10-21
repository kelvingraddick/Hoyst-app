import {sanitizeMonitoringEvent} from './sanitize-event';
import {Platform} from 'react-native';
import {env} from '../../config/env';
import {getInstalledAppInfo} from '../../features/settings/services/app-info';

let initialized = false;
export function initializeMonitoring(): void {
  if (
    initialized ||
    !/^https:\/\/[^@]+@[^/]+\/\d+$/.test(env.sentryDsn) ||
    __DEV__
  ) {
    return;
  }
  try {
    const Sentry =
      require('@sentry/react-native') as typeof import('@sentry/react-native');
    const {version, build} = getInstalledAppInfo();
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.appEnv,
      release: `hoyst@${version ?? 'unknown'}+${build ?? 'unknown'}`,
      dist: build,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      enableAutoSessionTracking: true,
      beforeBreadcrumb: () => null,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableNative: Platform.OS === 'ios',
      autoInitializeNativeSdk: false,
      beforeSend: sanitizeMonitoringEvent,
    });
    initialized = true;
  } catch {
    /* Error reporting is optional and must not block startup. */
  }
}
