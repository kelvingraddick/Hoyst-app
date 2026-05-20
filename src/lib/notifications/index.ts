import {OneSignal, LogLevel} from 'react-native-onesignal';
import type {NavigationContainerRef} from '@react-navigation/native';

import {env} from '../../config/env';
import type {RootStackParamList} from '../../navigation/types';

type NotificationClickEvent = {
  notification?: {
    additionalData?: object;
  };
};

let initialized = false;
let navigationRef: NavigationContainerRef<RootStackParamList> | undefined;
let pushUserId: string | undefined;
let warnedMissingAppId = false;

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function handleNotificationClick(event: NotificationClickEvent) {
  const data = (event.notification?.additionalData ?? {}) as Record<
    string,
    unknown
  >;
  const type = asString(data.type);
  const circleId = asString(data.circleId);

  if (!navigationRef?.isReady()) {
    return;
  }

  if (
    circleId &&
    (type === 'tap_in_midday_reminder' ||
      type === 'tap_in_final_warning' ||
      type === 'nudge')
  ) {
    navigationRef.navigate('TapInComposer', {
      circleId,
      source: 'notification',
    });
    return;
  }

  if (circleId) {
    navigationRef.navigate('CircleDetail', {circleId, source: 'notification'});
    return;
  }

  navigationRef.navigate('MainTabs', {screen: 'Inbox'});
}

function getOneSignalAppId() {
  return env.oneSignalAppId.trim();
}

function warnMissingOneSignalAppId() {
  if (!__DEV__ || warnedMissingAppId) {
    return;
  }

  warnedMissingAppId = true;
  console.warn(
    'Push notifications are disabled because ONESIGNAL_APP_ID is missing from the app environment.',
  );
}

export function setNotificationNavigationRef(
  ref: NavigationContainerRef<RootStackParamList> | null,
) {
  navigationRef = ref ?? undefined;
}

export function initializePushNotifications(): void {
  if (initialized) {
    return;
  }

  const appId = getOneSignalAppId();
  if (!appId) {
    warnMissingOneSignalAppId();
    return;
  }

  initialized = true;

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Warn);
  }

  OneSignal.initialize(appId);
  OneSignal.Notifications.addEventListener('click', handleNotificationClick);

  if (pushUserId) {
    OneSignal.login(pushUserId);
  }
}

export async function identifyPushUser(uid: string): Promise<void> {
  if (!uid) {
    return;
  }

  pushUserId = uid;
  initializePushNotifications();

  if (!initialized) {
    return;
  }

  OneSignal.login(uid);
}

export async function clearPushUser(): Promise<void> {
  pushUserId = undefined;

  if (!initialized) {
    return;
  }

  OneSignal.logout();
}

export async function requestPushNotificationPermission(): Promise<boolean> {
  initializePushNotifications();

  if (!initialized) {
    return false;
  }

  const existingPermission =
    await OneSignal.Notifications.getPermissionAsync().catch(() => false);

  if (existingPermission) {
    OneSignal.User.pushSubscription.optIn();
    return true;
  }

  const granted = await OneSignal.Notifications.requestPermission(true);

  if (granted) {
    OneSignal.User.pushSubscription.optIn();
  }

  return granted;
}
