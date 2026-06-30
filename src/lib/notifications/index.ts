import {OneSignal, LogLevel} from 'react-native-onesignal';
import type {NavigationContainerRef} from '@react-navigation/native';

import {env} from '../../config/env';
import {firebaseFunctions} from '../firebase/functions';
import type {RootStackParamList} from '../../navigation/types';

type NotificationClickEvent = {
  notification?: {
    additionalData?: object;
  };
};

let initialized = false;
let navigationRef: NavigationContainerRef<RootStackParamList> | undefined;
let pushUserId: string | undefined;
let requestedPermissionDuringSession = false;
let lastServerRepairAttemptAt = 0;
let warnedMissingAppId = false;
const serverRepairThrottleMs = 5 * 60 * 1000;

async function optInWithAvailablePermission({
  requestPermissionIfPossible = false,
}: {
  requestPermissionIfPossible?: boolean;
} = {}): Promise<{
  optInAttempted: boolean;
  permissionGranted?: boolean;
  permissionRequested: boolean;
}> {
  if (!initialized) {
    return {optInAttempted: false, permissionRequested: false};
  }

  const existingPermission =
    await OneSignal.Notifications.getPermissionAsync().catch(() => false);

  if (existingPermission) {
    OneSignal.User.pushSubscription.optIn();
    return {optInAttempted: true, permissionRequested: false};
  }

  if (!requestPermissionIfPossible || requestedPermissionDuringSession) {
    return {optInAttempted: false, permissionRequested: false};
  }

  const canRequestPermission =
    await OneSignal.Notifications.canRequestPermission().catch(() => false);

  if (!canRequestPermission) {
    return {optInAttempted: false, permissionRequested: false};
  }

  requestedPermissionDuringSession = true;
  const permissionGranted =
    await OneSignal.Notifications.requestPermission(true).catch(() => false);

  if (!permissionGranted) {
    return {
      optInAttempted: false,
      permissionGranted,
      permissionRequested: true,
    };
  }

  OneSignal.User.pushSubscription.optIn();
  return {
    optInAttempted: true,
    permissionGranted,
    permissionRequested: true,
  };
}

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
      type === 'member_due_prompt' ||
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

  navigationRef.navigate('Inbox');
}

function handlePermissionChange(granted: boolean) {
  if (!granted) {
    return;
  }

  syncPushSubscription({forceServerRepair: true}).catch(() => undefined);
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
  OneSignal.Notifications.addEventListener(
    'permissionChange',
    handlePermissionChange,
  );
}

export async function identifyPushUser(uid: string): Promise<void> {
  if (!uid) {
    return;
  }

  pushUserId = uid;
  await syncPushSubscription({
    forceServerRepair: true,
    requestPermissionIfPossible: true,
  });
}

export async function syncPushSubscription({
  forceServerRepair = false,
  requestPermissionIfPossible = false,
}: {
  forceServerRepair?: boolean;
  requestPermissionIfPossible?: boolean;
} = {}): Promise<boolean> {
  initializePushNotifications();

  if (!initialized || !pushUserId) {
    return false;
  }

  OneSignal.login(pushUserId);
  const syncResult = await optInWithAvailablePermission({
    requestPermissionIfPossible,
  });

  if (syncResult.optInAttempted) {
    await repairServerPushSubscription({force: forceServerRepair});
  }

  return syncResult.optInAttempted;
}

async function repairServerPushSubscription({
  force = false,
}: {
  force?: boolean;
} = {}) {
  if (!pushUserId) {
    return false;
  }

  const [subscriptionId, token] = await Promise.all([
    OneSignal.User.pushSubscription.getIdAsync().catch(() => undefined),
    OneSignal.User.pushSubscription.getTokenAsync().catch(() => undefined),
  ]);

  const safeSubscriptionId = asString(subscriptionId);
  const safeToken = asString(token);

  if (!safeSubscriptionId || !safeToken) {
    return false;
  }

  const now = Date.now();
  if (!force && now - lastServerRepairAttemptAt < serverRepairThrottleMs) {
    return false;
  }

  lastServerRepairAttemptAt = now;

  try {
    const callable = firebaseFunctions().httpsCallable(
      'repairPushSubscription',
    );
    await callable({
      subscriptionId: safeSubscriptionId,
      token: safeToken,
    });
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('Push subscription server repair failed.', error);
    }

    return false;
  }
}

export async function clearPushUser(): Promise<void> {
  pushUserId = undefined;

  if (!initialized) {
    return;
  }

  OneSignal.logout();
}

export async function clearDeliveredNotifications(): Promise<void> {
  initializePushNotifications();

  if (!initialized) {
    return;
  }

  OneSignal.Notifications.clearAll();
}

export async function requestPushNotificationPermission(): Promise<boolean> {
  initializePushNotifications();

  if (!initialized) {
    return false;
  }

  const existingPermission = await optInWithAvailablePermission();

  if (existingPermission.optInAttempted) {
    return true;
  }

  const granted = await OneSignal.Notifications.requestPermission(true);

  if (granted) {
    OneSignal.User.pushSubscription.optIn();
    await repairServerPushSubscription({force: true});
  }

  return granted;
}
