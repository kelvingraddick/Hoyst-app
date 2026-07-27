import {
  FieldValue,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {z} from 'zod';

import {db} from '../firebase';
import {
  type CommitmentCadence,
  getCommitmentCadence,
  getRequiredTapIns,
  isCoveredCheckInData,
} from '../shared/commitments';
import {
  getOpportunitySlots,
  normalizeCommitmentSchedule,
} from '../momentum/schedule';
import {isMemberExpectedForSlot} from '../momentum/eligibility';

export const oneSignalRestApiKey = defineSecret('ONESIGNAL_REST_API_KEY');
export const oneSignalAppId = defineString('ONESIGNAL_APP_ID', {default: ''});

export type NotificationPreferenceKey =
  | 'circleRisk'
  | 'discovery'
  | 'nudgePrompts'
  | 'productUpdates'
  | 'nudges'
  | 'socialActivity'
  | 'tapInReminders';

export type NotificationType =
  | 'circle_at_risk'
  | 'circle_complete'
  | 'circle_discovery_suggestion'
  | 'circle_nudge_prompt'
  | 'companion_achievement_unlocked'
  | 'companion_circle_created'
  | 'companion_circle_joined'
  | 'companion_momentum_level_up'
  | 'companion_skipped'
  | 'companion_streak_milestone'
  | 'companion_tapped_in'
  | 'evening_summary'
  | 'join_approved'
  | 'join_declined'
  | 'join_request'
  | 'member_due_prompt'
  | 'member_joined'
  | 'nudge'
  | 'tap_in_final_warning'
  | 'tap_in_midday_reminder';

export type NotificationActor = {
  avatarUrl?: string | null;
  displayName?: string | null;
  handle?: string | null;
  uid?: string | null;
};

export type NotificationDeeplink =
  | {screen: 'CircleDetail'; circleId: string}
  | {screen: 'Inbox'}
  | {screen: 'TapInPicker'}
  | {screen: 'TapInComposer'; circleId: string; source: 'notification'};

export type CreateNotificationInput = {
  actor?: NotificationActor;
  body: string;
  circleId?: string;
  copyVariant?: string;
  dailyDeliveryDateKey?: string;
  dailyDeliveryStateKey?: 'nudgePromptDateKey';
  dedupeKey?: string;
  deeplink: NotificationDeeplink;
  deliveryPriority?: 'deferred' | 'immediate' | 'routine' | 'suppressed';
  feedCategory?: 'companion';
  mediaImageUrl?: string | null;
  preferenceKey: NotificationPreferenceKey;
  pushData?: Record<string, string>;
  routineTimezone?: string;
  sourceKey?: string;
  sourceRevision?: number;
  title: string;
  type: NotificationType;
  uid: string;
};

export function getJoinRequestNotificationDedupeKey({
  circleId,
  requesterId,
  requestToken,
}: {
  circleId: string;
  requesterId?: string | null;
  requestToken?: string | null;
}) {
  const safeRequesterId =
    typeof requesterId === 'string' && requesterId.trim().length > 0
      ? requesterId.trim()
      : 'unknown';
  const safeRequestToken =
    typeof requestToken === 'string' && requestToken.trim().length > 0
      ? requestToken.trim()
      : 'current';

  return `join_request_${circleId}_${safeRequesterId}_${safeRequestToken}`;
}

export function getNudgeNotificationDedupeKey({
  actorUid,
  circleId,
  dateKey,
  targetUid,
}: {
  actorUid?: string | null;
  circleId: string;
  dateKey: string;
  targetUid: string;
}) {
  const safeActorUid =
    typeof actorUid === 'string' && actorUid.trim().length > 0
      ? actorUid.trim()
      : 'unknown';

  return `nudge_${circleId}_${dateKey}_${safeActorUid}_${targetUid}`;
}

export type NotificationSendResult = {
  created: boolean;
  eventId: string;
  pushStatus:
    | 'deferred'
    | 'disabled'
    | 'failed'
    | 'sent'
    | 'skipped'
    | 'suppressed'
    | 'throttled';
};

export type ReminderCandidate = {
  cadence?: CommitmentCadence;
  circleId: string;
  dateKey: string;
  kind: 'final' | 'midday';
  memberStatus?: unknown;
  notificationSettings?: Record<string, unknown>;
  opportunityStatus?: unknown;
  periodKey?: string;
  remainingTapIns?: number;
  slotIndex?: number;
  todayStatus?: unknown;
  uid: string;
};

export type TapInReminderCircle = {
  circleId: string;
  circleTitle: string;
  dedupeKey?: string;
  opportunityKey?: string;
};

export type TapInReminderNotificationPlan = {
  body: string;
  circleId?: string;
  dedupeKey: string;
  deeplink: NotificationDeeplink;
  pushData?: Record<string, string>;
  title: string;
  type: 'tap_in_final_warning' | 'tap_in_midday_reminder';
};

export type CompanionFeedTarget = {
  canViewMedia: boolean;
  uid: string;
};

export type CompanionFeedSourceCircle = {
  circleMode?: unknown;
  joinMode?: unknown;
  privacy?: unknown;
};

export type CompanionMomentumStatus =
  | 'getting_started'
  | 'building_momentum'
  | 'strong_momentum'
  | 'peak_momentum';

export type CompanionMomentumSummary = {
  bestStreak?: unknown;
  currentStreak?: unknown;
  label?: unknown;
  percentage?: unknown;
  status?: unknown;
};

export type CompanionMilestoneEvent =
  | {
      achievementTitle: string;
      key: string;
      type: 'companion_achievement_unlocked';
    }
  | {
      key: string;
      momentumLabel: string;
      type: 'companion_momentum_level_up';
    }
  | {
      key: string;
      streakDays: number;
      type: 'companion_streak_milestone';
    };

const notificationSettingsSchema = z.object({
  circleActivity: z.boolean().optional(),
  circleRisk: z.boolean().optional(),
  discovery: z.boolean().optional(),
  nudgePrompts: z.boolean().optional(),
  nudges: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  socialActivity: z.boolean().optional(),
  tapInReminders: z.boolean().optional(),
});

const updateNotificationSettingsSchema = z.object({
  notificationSettings: notificationSettingsSchema,
});

const repairPushSubscriptionSchema = z.object({
  subscriptionId: z.string().trim().min(1).max(160),
  token: z.string().trim().min(1).max(512),
});

const markInboxEventReadSchema = z.object({
  eventId: z.string().trim().min(1),
});

type OneSignalUserSubscription = {
  app_version?: unknown;
  appVersion?: unknown;
  device_os?: unknown;
  deviceOs?: unknown;
  enabled?: unknown;
  id?: unknown;
  notification_types?: unknown;
  notificationTypes?: unknown;
  sdk?: unknown;
  test_type?: unknown;
  testType?: unknown;
  token?: unknown;
  type?: unknown;
};

type OneSignalUserPayload = {
  subscriptions?: OneSignalUserSubscription[];
};

const inboxReadBatchLimit = 500;

const defaultNotificationSettings: Record<NotificationPreferenceKey, boolean> =
  {
    circleRisk: true,
    discovery: true,
    nudgePrompts: true,
    nudges: true,
    productUpdates: true,
    socialActivity: true,
    tapInReminders: true,
  };

const routineSpacingMs = 6 * 60 * 60 * 1000;
const routineDailyLimit = 2;
const discoverySpacingMs = 7 * 24 * 60 * 60 * 1000;
const discoveryInactivityMs = 3 * 24 * 60 * 60 * 1000;
const eveningSummaryHour = 19;
const maxPushCircleTitleLength = 22;
const companionAchievementCatalog = [
  {key: '7-days-straight', threshold: 7, title: '7 Days Straight'},
  {key: '10-day-streak', threshold: 10, title: '10 Day Streak'},
  {key: '20-day-streak', threshold: 20, title: '20 Day Streak'},
  {key: '30-day-streak', threshold: 30, title: '30 Day Streak'},
  {key: '50-taps', threshold: 50, title: '50 Taps'},
] as const;
const milestoneStatuses: CompanionMomentumStatus[] = [
  'getting_started',
  'building_momentum',
  'strong_momentum',
  'peak_momentum',
];
const eveningSummaryEventTypes = new Set<NotificationType>([
  'circle_complete',
  'circle_discovery_suggestion',
  'companion_achievement_unlocked',
  'companion_circle_created',
  'companion_circle_joined',
  'companion_momentum_level_up',
  'companion_skipped',
  'companion_streak_milestone',
  'companion_tapped_in',
  'member_joined',
]);
const sameDayImmediateCoverageTypes = new Set<NotificationType>([
  'circle_at_risk',
  'circle_nudge_prompt',
  'join_approved',
  'join_declined',
  'join_request',
  'member_due_prompt',
  'nudge',
  'tap_in_final_warning',
  'tap_in_midday_reminder',
]);

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeMomentumStatus(
  value: unknown,
): CompanionMomentumStatus | undefined {
  return value === 'getting_started' ||
    value === 'building_momentum' ||
    value === 'strong_momentum' ||
    value === 'peak_momentum'
    ? value
    : undefined;
}

function getMomentumStatusLabel(status: CompanionMomentumStatus) {
  if (status === 'peak_momentum') {
    return 'Peak';
  }

  if (status === 'strong_momentum') {
    return 'Strong';
  }

  if (status === 'building_momentum') {
    return 'Building';
  }

  return 'Getting Started';
}

function getMomentumStatusRank(status: CompanionMomentumStatus | undefined) {
  return status ? milestoneStatuses.indexOf(status) : -1;
}

export function canShareCircleOutsideMembers(
  circle: CompanionFeedSourceCircle | undefined,
) {
  return circle?.privacy === 'public' && circle?.joinMode !== 'invite_only';
}

export function getCompanionFeedTargetsFromMemberships({
  actorUid,
  sharedMemberUids,
  sourceCircle,
  sourceMemberUids,
}: {
  actorUid: string;
  sharedMemberUids: string[];
  sourceCircle?: CompanionFeedSourceCircle;
  sourceMemberUids: string[];
}): CompanionFeedTarget[] {
  const targets = new Map<string, CompanionFeedTarget>();
  const sourceMemberUidSet = new Set(sourceMemberUids.filter(Boolean));
  const canShareOutsideMembers = canShareCircleOutsideMembers(sourceCircle);

  sourceMemberUidSet.forEach(uid => {
    if (uid && uid !== actorUid) {
      targets.set(uid, {canViewMedia: true, uid});
    }
  });

  if (canShareOutsideMembers) {
    sharedMemberUids.forEach(uid => {
      if (uid && uid !== actorUid && !targets.has(uid)) {
        targets.set(uid, {canViewMedia: true, uid});
      }
    });
  }

  return Array.from(targets.values());
}

function getStreakMilestonesCrossed({
  currentStreak,
  priorStreak,
}: {
  currentStreak: number;
  priorStreak: number;
}) {
  const fixedMilestones = [3, 7, 14, 30];
  const recurringMilestones =
    currentStreak > 30
      ? Array.from(
          {length: Math.floor(currentStreak / 30) - 1},
          (_, index) => (index + 2) * 30,
        )
      : [];

  return [...fixedMilestones, ...recurringMilestones].filter(
    milestone => priorStreak < milestone && currentStreak >= milestone,
  );
}

export function getCompanionMilestoneEvents({
  priorSummary,
  summary,
}: {
  priorSummary?: CompanionMomentumSummary;
  summary: CompanionMomentumSummary;
}): CompanionMilestoneEvent[] {
  const priorBestStreak = asNumber(priorSummary?.bestStreak, 0);
  const bestStreak = asNumber(summary.bestStreak, 0);
  const priorCurrentStreak = asNumber(priorSummary?.currentStreak, 0);
  const currentStreak = asNumber(summary.currentStreak, 0);
  const priorStatus = normalizeMomentumStatus(priorSummary?.status);
  const status = normalizeMomentumStatus(summary.status);
  const events: CompanionMilestoneEvent[] = [];

  companionAchievementCatalog.forEach(achievement => {
    if (
      priorBestStreak < achievement.threshold &&
      bestStreak >= achievement.threshold
    ) {
      events.push({
        achievementTitle: achievement.title,
        key: achievement.key,
        type: 'companion_achievement_unlocked',
      });
    }
  });

  getStreakMilestonesCrossed({
    currentStreak,
    priorStreak: priorCurrentStreak,
  }).forEach(streakDays => {
    events.push({
      key: `${streakDays}-day-streak`,
      streakDays,
      type: 'companion_streak_milestone',
    });
  });

  if (
    status &&
    getMomentumStatusRank(status) > getMomentumStatusRank(priorStatus)
  ) {
    events.push({
      key: status,
      momentumLabel:
        asOptionalString(summary.label) ?? getMomentumStatusLabel(status),
      type: 'companion_momentum_level_up',
    });
  }

  return events;
}

function sanitizeEventId(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 500);
}

export type NotificationCopyContext = {
  achievementTitle?: string;
  actorName?: string;
  circleTitle?: string;
  discoveryCategory?: string;
  discoveryCircleTitle?: string;
  momentumLabel?: string;
  periodCopy?: string;
  remainingCount?: number;
  streakDays?: number;
  summaryBody?: string;
  targetCount?: number;
};

type NotificationCopyTemplate = (context: NotificationCopyContext) => {
  body: string;
  title: string;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getTapInCountLabel(count: number | undefined) {
  const safeCount = Math.max(1, Math.round(count ?? 1));
  return `${safeCount} Tap In${safeCount === 1 ? '' : 's'}`;
}

export function formatNotificationCircleTitle(value: string | undefined) {
  const title = asString(value, 'your circle');
  const truncated =
    title.length > maxPushCircleTitleLength
      ? `${title.slice(0, maxPushCircleTitleLength - 3).trimEnd()}...`
      : title;

  return `"${truncated}"`;
}

function getCircleTitle(context: NotificationCopyContext) {
  return formatNotificationCircleTitle(
    context.circleTitle ?? context.discoveryCircleTitle,
  );
}

function getActorName(context: NotificationCopyContext) {
  return context.actorName ?? 'Someone';
}

function getPeriodCopy(context: NotificationCopyContext) {
  return context.periodCopy ?? 'this period';
}

function getAchievementTitle(context: NotificationCopyContext) {
  return context.achievementTitle ?? 'a new achievement';
}

function getMomentumLabelCopy(context: NotificationCopyContext) {
  return context.momentumLabel ?? 'a new momentum level';
}

function getStreakDaysCopy(context: NotificationCopyContext) {
  const streakDays = Math.max(1, Math.round(context.streakDays ?? 1));
  return `${streakDays}-day streak`;
}

const notificationCopyCatalog: Record<
  NotificationType,
  NotificationCopyTemplate
> = {
  circle_at_risk: context => ({
    body: `${getCircleTitle(context)} needs ${getTapInCountLabel(
      context.remainingCount,
    )} ${getPeriodCopy(context)}.`,
    title: 'Circle at risk',
  }),
  circle_complete: context => ({
    body: `${getCircleTitle(context)} completed ${getPeriodCopy(context)}.`,
    title: 'Circle complete',
  }),
  circle_discovery_suggestion: context => ({
    body: `Explore ${getCircleTitle(context)} when you are ready.`,
    title: 'Circle suggestion',
  }),
  circle_nudge_prompt: context => ({
    body: `Nudge ${context.targetCount ?? 1} companion${
      (context.targetCount ?? 1) === 1 ? '' : 's'
    } in ${getCircleTitle(context)}.`,
    title: 'Nudge prompt',
  }),
  companion_achievement_unlocked: context => ({
    body: `${getActorName(context)} unlocked ${getAchievementTitle(context)}.`,
    title: 'Achievement',
  }),
  companion_circle_created: context => ({
    body: `${getActorName(context)} created ${getCircleTitle(context)}.`,
    title: 'New circle',
  }),
  companion_circle_joined: context => ({
    body: `${getActorName(context)} joined ${getCircleTitle(context)}.`,
    title: 'Circle joined',
  }),
  companion_momentum_level_up: context => ({
    body: `${getActorName(context)} reached ${getMomentumLabelCopy(
      context,
    )} momentum.`,
    title: 'Momentum',
  }),
  companion_skipped: context => ({
    body: `${getActorName(context)} used a skip in ${getCircleTitle(context)}.`,
    title: 'Skip',
  }),
  companion_streak_milestone: context => ({
    body: `${getActorName(context)} reached a ${getStreakDaysCopy(context)}.`,
    title: 'Streak',
  }),
  companion_tapped_in: context => ({
    body: `${getActorName(context)} tapped in for ${getCircleTitle(context)}.`,
    title: 'Companion Tap In',
  }),
  evening_summary: context => ({
    body: context.summaryBody ?? 'Open Hoyst for your latest activity.',
    title: 'Hoyst evening recap',
  }),
  join_approved: context => ({
    body: `Approved to join ${getCircleTitle(context)}.`,
    title: 'Request approved',
  }),
  join_declined: context => ({
    body: `Request declined for ${getCircleTitle(context)}.`,
    title: 'Request declined',
  }),
  join_request: context => ({
    body: `${getActorName(context)} requested to join ${getCircleTitle(
      context,
    )}.`,
    title: 'Join request',
  }),
  member_due_prompt: context => ({
    body: `Tap In still needed for ${getCircleTitle(context)} ${getPeriodCopy(
      context,
    )}.`,
    title: 'Tap In reminder',
  }),
  member_joined: context => ({
    body: `${getActorName(context)} joined ${getCircleTitle(context)}.`,
    title: 'Member joined',
  }),
  nudge: context => ({
    body: `${getActorName(context)} nudged you in ${getCircleTitle(context)}.`,
    title: 'Nudge',
  }),
  tap_in_final_warning: context => ({
    body: `2 hours left for ${getCircleTitle(context)}.`,
    title: 'Final Tap In warning',
  }),
  tap_in_midday_reminder: context => ({
    body: `Tap In today for ${getCircleTitle(context)}.`,
    title: 'Tap In reminder',
  }),
};

export function getNotificationCopyVariantIndex({
  dedupeKey,
  type,
  variantCount,
}: {
  dedupeKey: string;
  type: NotificationType;
  variantCount: number;
}) {
  if (variantCount <= 0) {
    return 0;
  }

  return hashString(`${type}:${dedupeKey}`) % variantCount;
}

export function resolveNotificationCopy({
  context = {},
  fallbackBody,
  fallbackTitle,
  type,
}: {
  context?: NotificationCopyContext;
  dedupeKey: string;
  fallbackBody?: string;
  fallbackTitle?: string;
  type: NotificationType;
}) {
  const resolved = notificationCopyCatalog[type]?.(context);

  return {
    body: resolved?.body ?? fallbackBody ?? '',
    copyVariant: type,
    title: resolved?.title ?? fallbackTitle ?? '',
  };
}

function getOneSignalConfig() {
  const appId =
    process.env.ONESIGNAL_APP_ID ??
    process.env.ONE_SIGNAL_APP_ID ??
    oneSignalAppId.value();
  const restApiKey =
    process.env.ONESIGNAL_REST_API_KEY ??
    process.env.ONE_SIGNAL_REST_API_KEY ??
    oneSignalRestApiKey.value();

  return {appId, restApiKey};
}

function getOneSignalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getOneSignalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getSubscriptionId(subscription: OneSignalUserSubscription) {
  return getOneSignalString(subscription.id);
}

function getSubscriptionToken(subscription: OneSignalUserSubscription) {
  return getOneSignalString(subscription.token);
}

function getSubscriptionType(subscription: OneSignalUserSubscription) {
  return getOneSignalString(subscription.type);
}

function getSubscriptionEnabled(subscription: OneSignalUserSubscription) {
  return typeof subscription.enabled === 'boolean'
    ? subscription.enabled
    : undefined;
}

function getSubscriptionNotificationTypes(
  subscription: OneSignalUserSubscription,
) {
  return (
    getOneSignalNumber(subscription.notification_types) ??
    getOneSignalNumber(subscription.notificationTypes)
  );
}

function getSubscriptionAppVersion(subscription: OneSignalUserSubscription) {
  return (
    getOneSignalString(subscription.app_version) ??
    getOneSignalString(subscription.appVersion)
  );
}

function getSubscriptionDeviceOs(subscription: OneSignalUserSubscription) {
  return (
    getOneSignalString(subscription.device_os) ??
    getOneSignalString(subscription.deviceOs)
  );
}

function getSubscriptionSdk(subscription: OneSignalUserSubscription) {
  return getOneSignalString(subscription.sdk);
}

async function fetchOneSignalUserByExternalId({
  appId,
  restApiKey,
  uid,
}: {
  appId: string;
  restApiKey: string;
  uid: string;
}) {
  const response = await fetch(
    `https://api.onesignal.com/apps/${encodeURIComponent(
      appId,
    )}/users/by/external_id/${encodeURIComponent(uid)}`,
    {
      headers: {
        Authorization: `Key ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    },
  );
  const payload = (await response.json().catch(() => undefined)) as
    | OneSignalUserPayload
    | undefined;

  return {payload, response};
}

async function patchOneSignalSubscription({
  appId,
  restApiKey,
  subscription,
  subscriptionId,
  token,
}: {
  appId: string;
  restApiKey: string;
  subscription: OneSignalUserSubscription;
  subscriptionId: string;
  token: string;
}) {
  const appVersion = getSubscriptionAppVersion(subscription);
  const deviceOs = getSubscriptionDeviceOs(subscription);
  const sdk = getSubscriptionSdk(subscription);
  const payload: Record<string, unknown> = {
    enabled: true,
    notification_types: 31,
    token,
  };

  if (appVersion) {
    payload.app_version = appVersion;
  }

  if (deviceOs) {
    payload.device_os = deviceOs;
  }

  if (sdk) {
    payload.sdk = sdk;
  }

  const response = await fetch(
    `https://api.onesignal.com/apps/${encodeURIComponent(
      appId,
    )}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      body: JSON.stringify({subscription: payload}),
      headers: {
        Authorization: `Key ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );
  const responsePayload = (await response.json().catch(() => undefined)) as
    | {errors?: unknown}
    | undefined;

  return {payload: responsePayload, response};
}

function getLocalDateTimeParts(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string, fallback: string) =>
    parts.find(part => part.type === type)?.value ?? fallback;
  const hourValue = getPart('hour', '00');

  return {
    dateKey: `${getPart('year', '1970')}-${getPart('month', '01')}-${getPart(
      'day',
      '01',
    )}`,
    hour: Number(hourValue === '24' ? '0' : hourValue),
    minute: Number(getPart('minute', '00')),
  };
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : undefined;
  }

  return undefined;
}

export type RoutineDeliveryState = {
  discoveryLastSentAt?: unknown;
  eveningSummaryDateKey?: unknown;
  eveningSummaryLastSentAt?: unknown;
  nudgePromptDateKey?: unknown;
  routineDateKey?: unknown;
  routineLastSentAt?: unknown;
  routineSentCount?: unknown;
};

export function getRoutineNotificationEligibility({
  deliveryState,
  now = new Date(),
  type,
  timezone,
}: {
  deliveryState?: RoutineDeliveryState;
  now?: Date;
  type: NotificationType;
  timezone: string;
}) {
  const localDateKey = getLocalDateTimeParts(now, timezone).dateKey;
  const routineLastSentAt = asDate(deliveryState?.routineLastSentAt);
  const discoveryLastSentAt = asDate(deliveryState?.discoveryLastSentAt);
  const routineDateKey =
    typeof deliveryState?.routineDateKey === 'string'
      ? deliveryState.routineDateKey
      : undefined;
  const routineSentCount =
    typeof deliveryState?.routineSentCount === 'number' &&
    Number.isFinite(deliveryState.routineSentCount)
      ? deliveryState.routineSentCount
      : 0;

  if (
    routineLastSentAt &&
    now.getTime() - routineLastSentAt.getTime() < routineSpacingMs
  ) {
    return {eligible: false, reason: 'routine-spacing'};
  }

  if (
    routineDateKey === localDateKey &&
    routineSentCount >= routineDailyLimit
  ) {
    return {eligible: false, reason: 'routine-daily-limit'};
  }

  if (
    type === 'circle_discovery_suggestion' &&
    discoveryLastSentAt &&
    now.getTime() - discoveryLastSentAt.getTime() < discoverySpacingMs
  ) {
    return {eligible: false, reason: 'discovery-spacing'};
  }

  return {eligible: true, reason: 'eligible'};
}

export function getDiscoveryInactivityEligibility({
  lastTapInAt,
  now = new Date(),
}: {
  lastTapInAt?: unknown;
  now?: Date;
}) {
  const lastTapInDate = asDate(lastTapInAt);

  if (!lastTapInDate) {
    return {eligible: false, reason: 'missing-last-tap-in'};
  }

  if (now.getTime() - lastTapInDate.getTime() < discoveryInactivityMs) {
    return {eligible: false, reason: 'recent-tap-in'};
  }

  return {eligible: true, reason: 'eligible'};
}

export type EveningSummaryCandidate = {
  circleId?: unknown;
  createdAt?: unknown;
  push?: unknown;
  type?: unknown;
};

function getCandidatePushStatus(candidate: EveningSummaryCandidate) {
  const push =
    candidate.push && typeof candidate.push === 'object'
      ? (candidate.push as Record<string, unknown>)
      : {};

  return typeof push.status === 'string' ? push.status : undefined;
}

function getCandidateNotificationType(
  candidate: EveningSummaryCandidate,
): NotificationType | undefined {
  return typeof candidate.type === 'string' &&
    Object.prototype.hasOwnProperty.call(
      notificationCopyCatalog,
      candidate.type,
    )
    ? (candidate.type as NotificationType)
    : undefined;
}

function getCandidateCircleId(candidate: EveningSummaryCandidate) {
  return typeof candidate.circleId === 'string' &&
    candidate.circleId.trim().length > 0
    ? candidate.circleId.trim()
    : undefined;
}

function isCandidateOnLocalDate({
  candidate,
  dateKey,
  timezone,
}: {
  candidate: EveningSummaryCandidate;
  dateKey: string;
  timezone: string;
}) {
  const createdAt = asDate(candidate.createdAt);

  if (!createdAt) {
    return false;
  }

  return getLocalDateTimeParts(createdAt, timezone).dateKey === dateKey;
}

export function getSameDayImmediateCoverageCircleIds({
  dateKey,
  events,
  timezone,
}: {
  dateKey: string;
  events: EveningSummaryCandidate[];
  timezone: string;
}) {
  const coveredCircleIds = new Set<string>();

  events.forEach(event => {
    const type = getCandidateNotificationType(event);
    const circleId = getCandidateCircleId(event);

    if (
      type &&
      circleId &&
      sameDayImmediateCoverageTypes.has(type) &&
      getCandidatePushStatus(event) === 'sent' &&
      isCandidateOnLocalDate({candidate: event, dateKey, timezone})
    ) {
      coveredCircleIds.add(circleId);
    }
  });

  return coveredCircleIds;
}

export function shouldIncludeInEveningSummary({
  coveredCircleIds,
  dateKey,
  event,
  timezone,
}: {
  coveredCircleIds: ReadonlySet<string>;
  dateKey: string;
  event: EveningSummaryCandidate;
  timezone: string;
}) {
  const type = getCandidateNotificationType(event);
  const circleId = getCandidateCircleId(event);

  if (
    !type ||
    !eveningSummaryEventTypes.has(type) ||
    getCandidatePushStatus(event) !== 'deferred' ||
    !isCandidateOnLocalDate({candidate: event, dateKey, timezone})
  ) {
    return false;
  }

  return !circleId || !coveredCircleIds.has(circleId);
}

function getEveningSummaryBucket(type: NotificationType) {
  if (type === 'companion_tapped_in') {
    return {plural: 'Tap Ins', singular: 'Tap In'};
  }

  if (type === 'circle_complete') {
    return {plural: 'completions', singular: 'completion'};
  }

  if (type === 'companion_skipped') {
    return {plural: 'skips', singular: 'skip'};
  }

  if (type === 'companion_circle_created') {
    return {plural: 'new circles', singular: 'new circle'};
  }

  if (type === 'companion_circle_joined' || type === 'member_joined') {
    return {plural: 'joins', singular: 'join'};
  }

  if (
    type === 'companion_achievement_unlocked' ||
    type === 'companion_momentum_level_up' ||
    type === 'companion_streak_milestone'
  ) {
    return {plural: 'milestones', singular: 'milestone'};
  }

  if (type === 'circle_discovery_suggestion') {
    return {plural: 'suggestions', singular: 'suggestion'};
  }

  return {plural: 'updates', singular: 'update'};
}

export function buildEveningSummaryCopy(events: EveningSummaryCandidate[]) {
  const counts = new Map<
    string,
    {count: number; plural: string; singular: string}
  >();
  const circleIds = new Set<string>();

  events.forEach(event => {
    const type = getCandidateNotificationType(event);
    const circleId = getCandidateCircleId(event);

    if (!type) {
      return;
    }

    const bucket = getEveningSummaryBucket(type);
    const existing = counts.get(bucket.singular);
    counts.set(bucket.singular, {
      ...bucket,
      count: (existing?.count ?? 0) + 1,
    });

    if (circleId) {
      circleIds.add(circleId);
    }
  });

  const total = events.length;
  const topParts = Array.from(counts.values())
    .sort((first, second) => second.count - first.count)
    .slice(0, 3)
    .map(bucket =>
      bucket.count === 1
        ? `1 ${bucket.singular}`
        : `${bucket.count} ${bucket.plural}`,
    );
  const circleCopy =
    circleIds.size > 0
      ? ` across ${circleIds.size} circle${circleIds.size === 1 ? '' : 's'}`
      : '';
  const body =
    total === 1
      ? `1 update${circleCopy}: ${topParts[0] ?? 'activity'}.`
      : `${total} updates${circleCopy}: ${topParts.join(', ')}.`;

  return {
    body,
    title: 'Hoyst evening recap',
  };
}

function getCommitmentWeekDateKeys(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(now);
  const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Mon';
  const dayOffsetByWeekday: Record<string, number> = {
    Fri: 4,
    Mon: 0,
    Sat: 5,
    Sun: 6,
    Thu: 3,
    Tue: 1,
    Wed: 2,
  };
  const localDate = new Date(
    Number(parts.find(part => part.type === 'year')?.value ?? '1970'),
    Number(parts.find(part => part.type === 'month')?.value ?? '1') - 1,
    Number(parts.find(part => part.type === 'day')?.value ?? '1'),
  );
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));

  return Array.from({length: 7}, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    return [
      String(date.getFullYear()),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  });
}

function getCommitmentMonthDateKeys(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(now);
  const year = Number(
    parts.find(part => part.type === 'year')?.value ?? '1970',
  );
  const month = Number(parts.find(part => part.type === 'month')?.value ?? '1');
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({length: dayCount}, (_, index) =>
    [
      String(year),
      String(month).padStart(2, '0'),
      String(index + 1).padStart(2, '0'),
    ].join('-'),
  );
}

function getCommitmentPeriodDateKeys(
  commitmentCadence: CommitmentCadence,
  timezone: string,
  now = new Date(),
) {
  if (commitmentCadence === 'daily') {
    return [getLocalDateTimeParts(now, timezone).dateKey];
  }

  if (commitmentCadence === 'monthly') {
    return getCommitmentMonthDateKeys(timezone, now);
  }

  return getCommitmentWeekDateKeys(timezone, now);
}

function buildActor(data?: DocumentData): NotificationActor | undefined {
  if (!data) {
    return undefined;
  }

  return {
    avatarUrl: asOptionalString(data.avatarUrl) ?? null,
    displayName:
      asOptionalString(data.displayName) ??
      asOptionalString(data.name) ??
      asOptionalString(data.handle) ??
      null,
    handle: asOptionalString(data.handle) ?? null,
    uid: asOptionalString(data.uid) ?? null,
  };
}

async function getActiveCircleMemberUids(circleId: string) {
  const snapshot = await db
    .collection('circles')
    .doc(circleId)
    .collection('members')
    .where('status', '==', 'active')
    .get();

  return snapshot.docs
    .map(doc => asOptionalString(doc.data().uid) ?? doc.id)
    .filter(Boolean);
}

async function getActorActiveCircleIds(actorUid: string) {
  const snapshot = await db
    .collectionGroup('members')
    .where('uid', '==', actorUid)
    .get();

  return snapshot.docs
    .filter(doc => doc.data().status === 'active')
    .map(doc => doc.ref.parent.parent?.id)
    .filter((circleId): circleId is string => Boolean(circleId));
}

export async function resolveCompanionFeedTargets({
  actorUid,
  circle,
  circleId,
}: {
  actorUid: string;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
}) {
  if (circle?.circleMode === 'personal') {
    return [];
  }

  const sourceMemberUids = await getActiveCircleMemberUids(circleId);
  const sharedMemberUids = canShareCircleOutsideMembers(circle)
    ? (
        await Promise.all(
          Array.from(new Set(await getActorActiveCircleIds(actorUid))).map(
            activeCircleId => getActiveCircleMemberUids(activeCircleId),
          ),
        )
      ).flat()
    : [];

  return getCompanionFeedTargetsFromMemberships({
    actorUid,
    sharedMemberUids,
    sourceCircle: circle,
    sourceMemberUids,
  });
}

function isPreferenceEnabled(
  notificationSettings: Record<string, unknown> | undefined,
  key: NotificationPreferenceKey,
) {
  const value = notificationSettings?.[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (
    key === 'nudgePrompts' &&
    typeof notificationSettings?.circleRisk === 'boolean'
  ) {
    return notificationSettings.circleRisk;
  }

  if (
    (key === 'circleRisk' ||
      key === 'nudgePrompts' ||
      key === 'nudges' ||
      key === 'socialActivity') &&
    typeof notificationSettings?.circleActivity === 'boolean'
  ) {
    return notificationSettings.circleActivity;
  }

  if (
    key === 'discovery' &&
    typeof notificationSettings?.productUpdates === 'boolean'
  ) {
    return notificationSettings.productUpdates;
  }

  return defaultNotificationSettings[key];
}

export function getNotificationPreferenceEnabled(
  notificationSettings: Record<string, unknown> | undefined,
  key: NotificationPreferenceKey,
) {
  return isPreferenceEnabled(notificationSettings, key);
}

export function buildOneSignalPushPayload({
  appId,
  body,
  circleId,
  eventId,
  pushData,
  title,
  type,
  uid,
}: {
  appId: string;
  body: string;
  circleId?: string;
  eventId: string;
  pushData?: Record<string, string>;
  title: string;
  type: NotificationType;
  uid: string;
}) {
  return {
    app_id: appId,
    contents: {en: body},
    data: {
      ...(circleId ? {circleId} : {}),
      eventId,
      ...(pushData ?? {}),
      type,
    },
    headings: {en: title},
    include_aliases: {
      external_id: [uid],
    },
    ios_badgeCount: 1,
    ios_badgeType: 'Increase' as const,
    target_channel: 'push',
  };
}

export async function markUnreadInboxEventsRead(uid: string) {
  const snapshot = await db
    .collection('userPrivate')
    .doc(uid)
    .collection('inbox')
    .where('readAt', '==', null)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  let batch = db.batch();
  let pendingWrites = 0;
  let readCount = 0;
  const readAt = FieldValue.serverTimestamp();

  for (const doc of snapshot.docs) {
    batch.set(doc.ref, {readAt}, {merge: true});
    pendingWrites += 1;
    readCount += 1;

    if (pendingWrites === inboxReadBatchLimit) {
      await batch.commit();
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  return readCount;
}

async function sendPushToUser({
  body,
  circleId,
  eventId,
  pushData,
  title,
  type,
  uid,
}: {
  body: string;
  circleId?: string;
  eventId: string;
  pushData?: Record<string, string>;
  title: string;
  type: NotificationType;
  uid: string;
}) {
  const {appId, restApiKey} = getOneSignalConfig();

  if (!appId || !restApiKey) {
    return {status: 'skipped' as const};
  }

  const response = await fetch('https://api.onesignal.com/notifications', {
    body: JSON.stringify(
      buildOneSignalPushPayload({
        appId,
        body,
        circleId,
        eventId,
        pushData,
        title,
        type,
        uid,
      }),
    ),
    headers: {
      Authorization: `Key ${restApiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await response.json().catch(() => undefined)) as
    | {id?: string; errors?: unknown}
    | undefined;

  if (!response.ok || !payload?.id) {
    return {
      error: payload?.errors ?? response.statusText,
      status: 'failed' as const,
    };
  }

  return {oneSignalId: payload.id, status: 'sent' as const};
}

async function recordRoutineNotificationDelivery({
  now = new Date(),
  type,
  uid,
  timezone,
}: {
  now?: Date;
  type: NotificationType;
  uid: string;
  timezone: string;
}) {
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const snapshot = await userPrivateRef.get();
  const deliveryState = (snapshot.data()?.notificationDelivery ?? {}) as
    | RoutineDeliveryState
    | undefined;
  const localDateKey = getLocalDateTimeParts(now, timezone).dateKey;
  const priorDateKey =
    typeof deliveryState?.routineDateKey === 'string'
      ? deliveryState.routineDateKey
      : undefined;
  const priorCount =
    typeof deliveryState?.routineSentCount === 'number' &&
    Number.isFinite(deliveryState.routineSentCount)
      ? deliveryState.routineSentCount
      : 0;

  await userPrivateRef.set(
    {
      notificationDelivery: {
        ...(type === 'circle_discovery_suggestion'
          ? {discoveryLastSentAt: FieldValue.serverTimestamp()}
          : {}),
        routineDateKey: localDateKey,
        routineLastSentAt: FieldValue.serverTimestamp(),
        routineSentCount: priorDateKey === localDateKey ? priorCount + 1 : 1,
      },
    },
    {merge: true},
  );
}

export async function createInboxEvent({
  actor,
  body,
  circleId,
  copyVariant,
  dailyDeliveryDateKey,
  dailyDeliveryStateKey,
  dedupeKey,
  deeplink,
  deliveryPriority = 'immediate',
  feedCategory,
  mediaImageUrl,
  preferenceKey,
  pushData,
  routineTimezone = 'UTC',
  sourceKey,
  sourceRevision,
  title,
  type,
  uid,
}: CreateNotificationInput): Promise<NotificationSendResult> {
  const eventId = sanitizeEventId(
    dedupeKey ?? `${type}_${circleId ?? 'general'}_${Date.now()}`,
  );
  const eventRef = db
    .collection('userPrivate')
    .doc(uid)
    .collection('inbox')
    .doc(eventId);
  const userPrivateSnapshot = await db.collection('userPrivate').doc(uid).get();
  const userPrivate = userPrivateSnapshot.data();
  const enabled = isPreferenceEnabled(
    userPrivate?.notificationSettings as Record<string, unknown> | undefined,
    preferenceKey,
  );
  const pushStatus = enabled
    ? deliveryPriority === 'deferred' || deliveryPriority === 'suppressed'
      ? deliveryPriority
      : 'pending'
    : 'disabled';

  if (enabled && deliveryPriority === 'routine') {
    const routineEligibility = getRoutineNotificationEligibility({
      deliveryState: userPrivate?.notificationDelivery as
        | RoutineDeliveryState
        | undefined,
      type,
      timezone: routineTimezone,
    });

    if (!routineEligibility.eligible) {
      return {created: false, eventId, pushStatus: 'throttled'};
    }
  }

  const eventPayload = {
    actor: actor ?? null,
    body,
    circleId: circleId ?? null,
    copyVariant: copyVariant ?? null,
    createdAt: FieldValue.serverTimestamp(),
    deeplink,
    feedCategory: feedCategory ?? null,
    mediaImageUrl: mediaImageUrl ?? null,
    preferenceKey,
    push: {
      status: pushStatus,
    },
    readAt: null,
    sourceKey: sourceKey ?? null,
    sourceRevision: sourceRevision ?? null,
    title,
    type,
  };

  try {
    if (dailyDeliveryDateKey && dailyDeliveryStateKey) {
      const created = await db.runTransaction(async transaction => {
        const [latestUserPrivateSnapshot, existingSnapshot] =
          await Promise.all([
            transaction.get(userPrivateSnapshot.ref),
            transaction.get(eventRef),
          ]);
        const latestDeliveryState =
          (latestUserPrivateSnapshot.data()?.notificationDelivery ?? {}) as
            | RoutineDeliveryState
            | undefined;

        if (
          existingSnapshot.exists ||
          latestDeliveryState?.[dailyDeliveryStateKey] === dailyDeliveryDateKey
        ) {
          return false;
        }

        transaction.create(eventRef, eventPayload);
        transaction.set(
          latestUserPrivateSnapshot.ref,
          {
            notificationDelivery: {
              [dailyDeliveryStateKey]: dailyDeliveryDateKey,
            },
          },
          {merge: true},
        );
        return true;
      });

      if (!created) {
        return {created: false, eventId, pushStatus: 'skipped'};
      }
    } else {
      await eventRef.create(eventPayload);
    }
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? (error as {code?: unknown}).code
        : undefined;

    if (code === 6 || code === '6' || code === 'already-exists') {
      return {created: false, eventId, pushStatus: 'skipped'};
    }

    throw error;
  }

  if (!enabled) {
    await eventRef.set(
      {
        push: {
          status: 'disabled',
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      {merge: true},
    );
    return {created: true, eventId, pushStatus: 'disabled'};
  }

  if (deliveryPriority === 'deferred') {
    return {created: true, eventId, pushStatus: 'deferred'};
  }

  if (deliveryPriority === 'suppressed') {
    return {created: true, eventId, pushStatus: 'suppressed'};
  }

  const pushResult = await sendPushToUser({
    body,
    circleId,
    eventId,
    pushData,
    title,
    type,
    uid,
  });
  await eventRef.set(
    {
      push: {
        ...(pushResult.status === 'sent'
          ? {oneSignalId: pushResult.oneSignalId}
          : {}),
        ...(pushResult.status === 'failed'
          ? {error: JSON.stringify(pushResult.error)}
          : {}),
        status: pushResult.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    {merge: true},
  );

  if (deliveryPriority === 'routine' && pushResult.status === 'sent') {
    await recordRoutineNotificationDelivery({
      type,
      uid,
      timezone: routineTimezone,
    }).catch(error =>
      console.error('record_routine_notification_delivery_failed', error),
    );
  }

  return {created: true, eventId, pushStatus: pushResult.status};
}

export async function notifyOwnerJoinRequest({
  circleId,
  circleTitle,
  ownerId,
  requestToken,
  requester,
}: {
  circleId: string;
  circleTitle: string;
  ownerId: string;
  requestToken?: string | null;
  requester?: DocumentData;
}) {
  const actor = buildActor(requester);
  const actorName = actor?.displayName ?? 'Someone';
  const dedupeKey = getJoinRequestNotificationDedupeKey({
    circleId,
    requesterId: actor?.uid,
    requestToken,
  });
  const copy = resolveNotificationCopy({
    context: {actorName, circleTitle},
    dedupeKey,
    fallbackBody: `${actorName} requested to join ${circleTitle}.`,
    fallbackTitle: 'New join request',
    type: 'join_request',
  });

  return createInboxEvent({
    actor,
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'socialActivity',
    title: copy.title,
    type: 'join_request',
    uid: ownerId,
  });
}

export async function notifyOwnerNewJoin({
  circleId,
  circleTitle,
  joinedMember,
  ownerId,
}: {
  circleId: string;
  circleTitle: string;
  joinedMember?: DocumentData;
  ownerId: string;
}) {
  const actor = buildActor(joinedMember);
  const actorName = actor?.displayName ?? 'Someone';
  const dedupeKey = `member_joined_${circleId}_${actor?.uid ?? 'unknown'}`;
  const copy = resolveNotificationCopy({
    context: {actorName, circleTitle},
    dedupeKey,
    fallbackBody: `${actorName} joined ${circleTitle}.`,
    fallbackTitle: 'New circle member',
    type: 'member_joined',
  });

  if (actor?.uid === ownerId) {
    return undefined;
  }

  return createInboxEvent({
    actor,
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    deliveryPriority: 'deferred',
    feedCategory: 'companion',
    preferenceKey: 'socialActivity',
    title: copy.title,
    type: 'member_joined',
    uid: ownerId,
  });
}

export async function notifyJoinRequestReview({
  approved,
  circleId,
  circleTitle,
  owner,
  requesterId,
}: {
  approved: boolean;
  circleId: string;
  circleTitle: string;
  owner?: DocumentData;
  requesterId: string;
}) {
  const type = approved ? 'join_approved' : ('join_declined' as const);
  const dedupeKey = `join_review_${circleId}_${requesterId}_${
    approved ? 'approved' : 'declined'
  }`;
  const copy = resolveNotificationCopy({
    context: {circleTitle},
    dedupeKey,
    fallbackBody: approved
      ? `Your request to join ${circleTitle} was approved.`
      : `Your request to join ${circleTitle} was declined.`,
    fallbackTitle: approved ? 'Request approved' : 'Request declined',
    type,
  });

  return createInboxEvent({
    actor: buildActor(owner),
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'socialActivity',
    title: copy.title,
    type,
    uid: requesterId,
  });
}

export async function notifyNudge({
  actor,
  circleId,
  circleTitle,
  dateKey,
  targetUid,
}: {
  actor?: DocumentData;
  circleId: string;
  circleTitle: string;
  dateKey: string;
  targetUid: string;
}) {
  const notificationActor = buildActor(actor);
  const actorName = notificationActor?.displayName ?? 'Someone';
  const dedupeKey = getNudgeNotificationDedupeKey({
    actorUid: notificationActor?.uid,
    circleId,
    dateKey,
    targetUid,
  });
  const copy = resolveNotificationCopy({
    context: {actorName, circleTitle},
    dedupeKey,
    fallbackBody: `${actorName} nudged you in ${circleTitle}.`,
    fallbackTitle: 'Tap In nudge',
    type: 'nudge',
  });

  return createInboxEvent({
    actor: notificationActor,
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'TapInComposer', source: 'notification'},
    feedCategory: 'companion',
    preferenceKey: 'nudges',
    title: copy.title,
    type: 'nudge',
    uid: targetUid,
  });
}

type CompanionFeedEventInput = {
  actor: NotificationActor;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
  context: NotificationCopyContext;
  dateKey: string;
  dedupeSubject: string;
  excludedUids?: string[];
  fallbackBody: string;
  fallbackTitle: string;
  mediaImageUrl?: string | null;
  sourceKey?: string;
  sourceRevision?: number;
  type:
    | 'companion_achievement_unlocked'
    | 'companion_circle_created'
    | 'companion_circle_joined'
    | 'companion_momentum_level_up'
    | 'companion_skipped'
    | 'companion_streak_milestone';
};

async function notifyCompanionFeedEvent({
  actor,
  circle,
  circleId,
  context,
  dateKey,
  dedupeSubject,
  excludedUids = [],
  fallbackBody,
  fallbackTitle,
  mediaImageUrl,
  sourceKey,
  sourceRevision,
  type,
}: CompanionFeedEventInput) {
  const actorUid = asOptionalString(actor.uid);

  if (!actorUid) {
    return [];
  }

  const excludedUidSet = new Set([actorUid, ...excludedUids]);
  const targets = await resolveCompanionFeedTargets({
    actorUid,
    circle,
    circleId,
  });

  return Promise.all(
    targets
      .filter(target => !excludedUidSet.has(target.uid))
      .map(target => {
        const targetMediaImageUrl = target.canViewMedia
          ? asOptionalString(mediaImageUrl)
          : undefined;
        const revisionKey =
          typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
        const dedupeKey = `${type}_${circleId}_${dateKey}_${actorUid}_${dedupeSubject}_${target.uid}${revisionKey}`;
        const copy = resolveNotificationCopy({
          context,
          dedupeKey,
          fallbackBody,
          fallbackTitle,
          type,
        });

        return createInboxEvent({
          actor,
          body: copy.body,
          circleId,
          copyVariant: copy.copyVariant,
          dedupeKey,
          deeplink: {circleId, screen: 'CircleDetail'},
          deliveryPriority: 'deferred',
          feedCategory: 'companion',
          mediaImageUrl: targetMediaImageUrl,
          preferenceKey: 'socialActivity',
          pushData: {
            feedCategory: 'companion',
            ...(targetMediaImageUrl ? {hasMedia: 'true'} : {}),
          },
          sourceKey,
          sourceRevision,
          title: copy.title,
          type,
          uid: target.uid,
        });
      }),
  );
}

export async function notifyCompanionSkipped({
  actor,
  circle,
  circleId,
  circleTitle,
  dateKey,
  sourceKey,
  sourceRevision,
}: {
  actor: NotificationActor;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
  circleTitle: string;
  dateKey: string;
  sourceKey?: string;
  sourceRevision?: number;
}) {
  const actorName = actor.displayName ?? 'Someone';

  return notifyCompanionFeedEvent({
    actor,
    circle,
    circleId,
    context: {actorName, circleTitle},
    dateKey,
    dedupeSubject: 'skip',
    fallbackBody: `${actorName} used a skip for ${circleTitle}.`,
    fallbackTitle: 'A companion used a skip',
    sourceKey,
    sourceRevision,
    type: 'companion_skipped',
  });
}

export async function notifyCompanionCircleCreated({
  actor,
  circle,
  circleId,
  circleTitle,
  dateKey,
}: {
  actor: NotificationActor;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
  circleTitle: string;
  dateKey: string;
}) {
  if (!canShareCircleOutsideMembers(circle)) {
    return [];
  }

  const actorName = actor.displayName ?? 'Someone';

  return notifyCompanionFeedEvent({
    actor,
    circle,
    circleId,
    context: {actorName, circleTitle},
    dateKey,
    dedupeSubject: 'created',
    fallbackBody: `${actorName} created ${circleTitle}.`,
    fallbackTitle: 'New circle created',
    type: 'companion_circle_created',
  });
}

export async function notifyCompanionCircleJoined({
  actor,
  circle,
  circleId,
  circleTitle,
  dateKey,
  excludedUids,
}: {
  actor: NotificationActor;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
  circleTitle: string;
  dateKey: string;
  excludedUids?: string[];
}) {
  const actorName = actor.displayName ?? 'Someone';

  return notifyCompanionFeedEvent({
    actor,
    circle,
    circleId,
    context: {actorName, circleTitle},
    dateKey,
    dedupeSubject: 'joined',
    excludedUids,
    fallbackBody: `${actorName} joined ${circleTitle}.`,
    fallbackTitle: 'A companion joined',
    type: 'companion_circle_joined',
  });
}

function getCompanionMilestoneContext(
  event: CompanionMilestoneEvent,
  actorName: string,
): NotificationCopyContext {
  if (event.type === 'companion_achievement_unlocked') {
    return {achievementTitle: event.achievementTitle, actorName};
  }

  if (event.type === 'companion_momentum_level_up') {
    return {actorName, momentumLabel: event.momentumLabel};
  }

  return {actorName, streakDays: event.streakDays};
}

function getCompanionMilestoneFallback({
  actorName,
  event,
}: {
  actorName: string;
  event: CompanionMilestoneEvent;
}) {
  if (event.type === 'companion_achievement_unlocked') {
    return {
      body: `${actorName} unlocked ${event.achievementTitle}.`,
      title: 'Achievement unlocked',
    };
  }

  if (event.type === 'companion_momentum_level_up') {
    return {
      body: `${actorName} reached ${event.momentumLabel} momentum.`,
      title: 'Momentum level up',
    };
  }

  return {
    body: `${actorName} reached a ${event.streakDays}-day streak.`,
    title: 'Streak milestone',
  };
}

export async function notifyCompanionMilestones({
  actor,
  circle,
  circleId,
  dateKey,
  events,
  sourceKey,
  sourceRevision,
  targetUid,
}: {
  actor: NotificationActor;
  circle?: CompanionFeedSourceCircle;
  circleId: string;
  dateKey: string;
  events: CompanionMilestoneEvent[];
  sourceKey?: string;
  sourceRevision?: number;
  targetUid: string;
}) {
  const actorUid = asOptionalString(actor.uid);
  const actorName = actor.displayName ?? 'Someone';

  if (!actorUid || events.length === 0) {
    return [];
  }

  const targets = await resolveCompanionFeedTargets({
    actorUid,
    circle,
    circleId,
  });
  const companionSends = events.flatMap(event => {
    const context = getCompanionMilestoneContext(event, actorName);
    const fallback = getCompanionMilestoneFallback({actorName, event});

    return targets.map(target => {
      const revisionKey =
        typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
      const dedupeKey = `${event.type}_${circleId}_${dateKey}_${actorUid}_${event.key}_${target.uid}${revisionKey}`;
      const copy = resolveNotificationCopy({
        context,
        dedupeKey,
        fallbackBody: fallback.body,
        fallbackTitle: fallback.title,
        type: event.type,
      });

      return createInboxEvent({
        actor,
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey,
        deeplink: {circleId, screen: 'CircleDetail'},
        deliveryPriority: 'deferred',
        feedCategory: 'companion',
        preferenceKey: 'socialActivity',
        pushData: {feedCategory: 'companion'},
        sourceKey,
        sourceRevision,
        title: copy.title,
        type: event.type,
        uid: target.uid,
      });
    });
  });
  const selfSends = events.map(event => {
    const context = getCompanionMilestoneContext(event, 'You');
    const fallback = getCompanionMilestoneFallback({actorName: 'You', event});
    const revisionKey =
      typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
    const dedupeKey = `self_${event.type}_${dateKey}_${actorUid}_${event.key}${revisionKey}`;
    const copy = resolveNotificationCopy({
      context,
      dedupeKey,
      fallbackBody: fallback.body,
      fallbackTitle: fallback.title,
      type: event.type,
    });

    return createInboxEvent({
      actor,
      body: copy.body,
      circleId,
      copyVariant: copy.copyVariant,
      dedupeKey,
      deeplink: {circleId, screen: 'CircleDetail'},
      deliveryPriority: 'suppressed',
      preferenceKey: 'socialActivity',
      sourceKey,
      sourceRevision,
      title: copy.title,
      type: event.type,
      uid: targetUid,
    });
  });

  return Promise.all([...companionSends, ...selfSends]);
}

export function getCircleAtRiskNotificationBody({
  circleTitle,
  commitmentCadence,
  remainingCount,
}: {
  circleTitle: string;
  commitmentCadence: CommitmentCadence;
  remainingCount: number;
}) {
  const periodCopy = getCommitmentPeriodCopy(commitmentCadence);

  return `${formatNotificationCircleTitle(
    circleTitle,
  )} needs ${remainingCount} more Tap In${
    remainingCount === 1 ? '' : 's'
  } ${periodCopy}.`;
}

function getCommitmentPeriodCopy(commitmentCadence: CommitmentCadence) {
  return commitmentCadence === 'daily'
    ? 'today'
    : commitmentCadence === 'monthly'
    ? 'this month'
    : 'this week';
}

export async function notifyCompanionTappedIn({
  actor,
  circleId,
  circleTitle,
  dateKey,
  mediaImageUrl,
  sourceKey,
  sourceRevision,
  targetUid,
}: {
  actor?: DocumentData;
  circleId: string;
  circleTitle: string;
  dateKey: string;
  mediaImageUrl?: string | null;
  sourceKey?: string;
  sourceRevision?: number;
  targetUid: string;
}) {
  const notificationActor = buildActor(actor);
  const actorName = notificationActor?.displayName ?? 'Someone';
  const revisionKey =
    typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
  const dedupeKey = `companion_tapped_in_${circleId}_${dateKey}_${
    notificationActor?.uid ?? 'unknown'
  }_${targetUid}${revisionKey}`;
  const copy = resolveNotificationCopy({
    context: {actorName, circleTitle},
    dedupeKey,
    fallbackBody: `${actorName} tapped in for ${circleTitle}.`,
    fallbackTitle: 'A companion tapped in',
    type: 'companion_tapped_in',
  });

  return createInboxEvent({
    actor: notificationActor,
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    deliveryPriority: 'deferred',
    feedCategory: 'companion',
    mediaImageUrl,
    preferenceKey: 'socialActivity',
    pushData: {
      feedCategory: 'companion',
      ...(mediaImageUrl ? {hasMedia: 'true'} : {}),
    },
    sourceKey,
    sourceRevision,
    title: copy.title,
    type: 'companion_tapped_in',
    uid: targetUid,
  });
}

export async function notifyCircleComplete({
  actorUid,
  circleId,
  circleTitle,
  commitmentCadence,
  periodKey,
  sourceKey,
  sourceRevision,
  targetUid,
}: {
  actorUid?: string;
  circleId: string;
  circleTitle: string;
  commitmentCadence: CommitmentCadence;
  periodKey: string;
  sourceKey?: string;
  sourceRevision?: number;
  targetUid: string;
}) {
  const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
  const revisionKey =
    typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
  const dedupeKey = `circle_complete_${circleId}_${periodKey}_${targetUid}${revisionKey}`;
  const copy = resolveNotificationCopy({
    context: {circleTitle, periodCopy},
    dedupeKey,
    fallbackBody: `${circleTitle} is fully tapped in ${periodCopy}.`,
    fallbackTitle: 'Circle complete',
    type: 'circle_complete',
  });

  return createInboxEvent({
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    deliveryPriority: actorUid === targetUid ? 'suppressed' : 'deferred',
    feedCategory: 'companion',
    preferenceKey: 'socialActivity',
    sourceKey,
    sourceRevision,
    title: copy.title,
    type: 'circle_complete',
    uid: targetUid,
  });
}

export async function notifyMemberDuePrompt({
  circleId,
  circleTitle,
  commitmentCadence,
  periodKey,
  targetUid,
  timezone,
}: {
  circleId: string;
  circleTitle: string;
  commitmentCadence: CommitmentCadence;
  periodKey: string;
  targetUid: string;
  timezone: string;
}) {
  const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
  const dedupeKey = `member_due_prompt_${circleId}_${periodKey}_${targetUid}`;
  const copy = resolveNotificationCopy({
    context: {circleTitle, periodCopy},
    dedupeKey,
    fallbackBody: `${circleTitle} still needs your Tap In ${periodCopy}.`,
    fallbackTitle: 'Your circle needs you',
    type: 'member_due_prompt',
  });

  return createInboxEvent({
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'TapInComposer', source: 'notification'},
    deliveryPriority: 'routine',
    preferenceKey: 'tapInReminders',
    routineTimezone: timezone,
    title: copy.title,
    type: 'member_due_prompt',
    uid: targetUid,
  });
}

export async function notifyCircleNudgePrompt({
  circleId,
  circleTitle,
  dateKey,
  periodKey,
  targetCount,
  targetUid,
  timezone,
}: {
  circleId: string;
  circleTitle: string;
  dateKey: string;
  periodKey: string;
  targetCount: number;
  targetUid: string;
  timezone: string;
}) {
  const dedupeKey = `circle_nudge_prompt_${circleId}_${periodKey}_${targetUid}`;
  const copy = resolveNotificationCopy({
    context: {circleTitle, targetCount},
    dedupeKey,
    fallbackBody: `${circleTitle} could use a nudge for ${targetCount} companion${
      targetCount === 1 ? '' : 's'
    }.`,
    fallbackTitle: 'Help the circle move',
    type: 'circle_nudge_prompt',
  });

  return createInboxEvent({
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dailyDeliveryDateKey: dateKey,
    dailyDeliveryStateKey: 'nudgePromptDateKey',
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    deliveryPriority: 'routine',
    preferenceKey: 'nudgePrompts',
    routineTimezone: timezone,
    title: copy.title,
    type: 'circle_nudge_prompt',
    uid: targetUid,
  });
}

export async function notifyCircleDiscoverySuggestion({
  category,
  circleId,
  circleTitle,
  dateKey,
  targetUid,
  timezone,
}: {
  category: string;
  circleId: string;
  circleTitle: string;
  dateKey: string;
  targetUid: string;
  timezone: string;
}) {
  const dedupeKey = `circle_discovery_${circleId}_${dateKey}_${targetUid}`;
  const copy = resolveNotificationCopy({
    context: {
      discoveryCategory: category,
      discoveryCircleTitle: circleTitle,
    },
    dedupeKey,
    fallbackBody: `${circleTitle} could help you restart your rhythm.`,
    fallbackTitle: 'Find a new circle',
    type: 'circle_discovery_suggestion',
  });

  const result = await createInboxEvent({
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    deliveryPriority: 'deferred',
    preferenceKey: 'discovery',
    routineTimezone: timezone,
    title: copy.title,
    type: 'circle_discovery_suggestion',
    uid: targetUid,
  });

  if (result.pushStatus === 'deferred') {
    await recordRoutineNotificationDelivery({
      type: 'circle_discovery_suggestion',
      uid: targetUid,
      timezone,
    }).catch(error =>
      console.error('record_discovery_notification_delivery_failed', error),
    );
  }

  return result;
}

export async function notifyCircleAtRisk({
  commitmentCadence,
  circleId,
  circleTitle,
  periodKey,
  remainingCount,
  targetUid,
}: {
  commitmentCadence: CommitmentCadence;
  circleId: string;
  circleTitle: string;
  periodKey: string;
  remainingCount: number;
  targetUid: string;
}) {
  const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
  const dedupeKey = `circle_at_risk_${circleId}_${periodKey}_${targetUid}`;
  const copy = resolveNotificationCopy({
    context: {circleTitle, periodCopy, remainingCount},
    dedupeKey,
    fallbackBody: getCircleAtRiskNotificationBody({
      circleTitle,
      commitmentCadence,
      remainingCount,
    }),
    fallbackTitle: 'Circle Progression at risk',
    type: 'circle_at_risk',
  });

  return createInboxEvent({
    body: copy.body,
    circleId,
    copyVariant: copy.copyVariant,
    dedupeKey,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleRisk',
    title: copy.title,
    type: 'circle_at_risk',
    uid: targetUid,
  });
}

export function getReminderEligibility({
  cadence,
  circleId,
  dateKey,
  kind,
  memberStatus,
  notificationSettings,
  opportunityStatus,
  periodKey,
  remainingTapIns,
  slotIndex,
  todayStatus,
  uid,
}: ReminderCandidate) {
  if (!uid || !circleId || !dateKey) {
    return {eligible: false, reason: 'missing-input'};
  }

  if (memberStatus !== 'active') {
    return {eligible: false, reason: 'inactive-member'};
  }

  if (
    opportunityStatus === 'completed' ||
    opportunityStatus === 'skipped' ||
    todayStatus === 'done' ||
    todayStatus === 'skip'
  ) {
    return {eligible: false, reason: 'already-covered'};
  }

  if (typeof remainingTapIns === 'number' && remainingTapIns <= 0) {
    return {eligible: false, reason: 'frequency-complete'};
  }

  if (!isPreferenceEnabled(notificationSettings, 'tapInReminders')) {
    return {eligible: false, reason: 'preference-disabled'};
  }

  return {
    dedupeKey:
      cadence &&
      cadence !== 'daily' &&
      periodKey &&
      typeof slotIndex === 'number'
        ? `tap_in_${kind}_${circleId}_${periodKey}_${slotIndex}_${uid}`
        : `tap_in_${kind}_${circleId}_${dateKey}_${uid}`,
    eligible: true,
    reason: 'eligible',
  };
}

function getTapInReminderType(kind: 'final' | 'midday') {
  return kind === 'midday'
    ? ('tap_in_midday_reminder' as const)
    : ('tap_in_final_warning' as const);
}

function getTapInReminderSummaryDedupeKey({
  dateKey,
  kind,
  reminders,
  uid,
}: {
  dateKey: string;
  kind: 'final' | 'midday';
  reminders: TapInReminderCircle[];
  uid: string;
}) {
  const opportunityKeys = reminders
    .map(reminder => reminder.opportunityKey)
    .filter((value): value is string => Boolean(value))
    .sort();
  const opportunitySuffix =
    opportunityKeys.length > 0
      ? `_${hashString(opportunityKeys.join('|')).toString(36)}`
      : '';

  return `tap_in_${kind}_summary_${dateKey}_${uid}${opportunitySuffix}`;
}

function getTapInReminderCircleListCopy(reminders: TapInReminderCircle[]) {
  const formattedTitles = reminders
    .slice(0, 2)
    .map(reminder => formatNotificationCircleTitle(reminder.circleTitle));

  if (formattedTitles.length === 0) {
    return '';
  }

  if (formattedTitles.length === 1) {
    return `, including ${formattedTitles[0]}`;
  }

  return `, including ${formattedTitles[0]} and ${formattedTitles[1]}`;
}

export function buildTapInReminderNotification({
  dateKey,
  kind,
  reminders,
  uid,
}: {
  dateKey: string;
  kind: 'final' | 'midday';
  reminders: TapInReminderCircle[];
  uid: string;
}): TapInReminderNotificationPlan | undefined {
  const type = getTapInReminderType(kind);

  if (reminders.length === 0) {
    return undefined;
  }

  if (reminders.length === 1) {
    const reminder = reminders[0];
    const dedupeKey =
      reminder.dedupeKey ??
      `tap_in_${kind}_${reminder.circleId}_${dateKey}_${uid}`;
    const copy = resolveNotificationCopy({
      context: {circleTitle: reminder.circleTitle},
      dedupeKey,
      fallbackBody:
        kind === 'midday'
          ? `Tap In to keep ${reminder.circleTitle} Progression moving.`
          : `2 hours left to Tap In for ${reminder.circleTitle}.`,
      fallbackTitle:
        kind === 'midday' ? 'Keep your Commitment moving' : '2 hours left',
      type,
    });

    return {
      body: copy.body,
      circleId: reminder.circleId,
      dedupeKey,
      deeplink: {
        circleId: reminder.circleId,
        screen: 'TapInComposer',
        source: 'notification',
      },
      title: copy.title,
      type,
    };
  }

  const circleCount = reminders.length;
  const circleCopy = `${circleCount} circle${circleCount === 1 ? '' : 's'}`;
  const listCopy = getTapInReminderCircleListCopy(reminders);
  const dedupeKey = getTapInReminderSummaryDedupeKey({
    dateKey,
    kind,
    reminders,
    uid,
  });

  return {
    body:
      kind === 'midday'
        ? `Tap In needed for ${circleCopy} today${listCopy}.`
        : `2 hours left for ${circleCopy}${listCopy}.`,
    dedupeKey,
    deeplink: {screen: 'TapInPicker'},
    pushData: {screen: 'TapInPicker'},
    title: kind === 'midday' ? 'Tap In reminder' : 'Final Tap In warning',
    type,
  };
}

export function getOpportunityReminderSlots({
  dateKey,
  kind,
  slots,
}: {
  dateKey: string;
  kind: 'final' | 'midday';
  slots: Array<{
    availableDateKey: string;
    expiresDateKey: string;
    periodKey: string;
    slotIndex: number;
  }>;
}) {
  return slots.filter(slot =>
    kind === 'midday'
      ? slot.availableDateKey === dateKey
      : slot.expiresDateKey === dateKey,
  );
}

async function sendTapInReminders(kind: 'final' | 'midday') {
  const targetHour = kind === 'midday' ? 12 : 22;
  const now = new Date();
  const circleSnapshots = await db.collection('circles').get();
  const reminderGroups = new Map<
    string,
    {
      dateKey: string;
      reminders: TapInReminderCircle[];
      timezone: string;
      uid: string;
    }
  >();

  for (const circleSnapshot of circleSnapshots.docs) {
    const circle = circleSnapshot.data();
    const timezone = asString(circle.timezone, 'UTC');
    const local = getLocalDateTimeParts(now, timezone);
    const commitmentCadence = getCommitmentCadence(circle);
    const slots = getOpportunitySlots(
      normalizeCommitmentSchedule(circle, timezone),
      now,
    );
    const reminderSlots = getOpportunityReminderSlots({
      dateKey: local.dateKey,
      kind,
      slots,
    });

    if (local.hour !== targetHour || reminderSlots.length === 0) {
      continue;
    }

    const memberSnapshots = await circleSnapshot.ref
      .collection('members')
      .where('status', '==', 'active')
      .get();
    const slotSnapshots = await Promise.all(
      reminderSlots.map(slot =>
        circleSnapshot.ref
          .collection('opportunities')
          .doc(slot.periodKey)
          .collection('slots')
          .doc(String(slot.slotIndex))
          .get(),
      ),
    );
    const circleTitle = asString(circle.title, 'Your circle');

    for (const memberSnapshot of memberSnapshots.docs) {
      const uid = asString(memberSnapshot.data().uid, memberSnapshot.id);
      const eligibleSlotIndex = reminderSlots.findIndex((slot, index) => {
        const expectedMemberUids =
          slotSnapshots[index].data()?.expectedMemberUids;

        return Array.isArray(expectedMemberUids)
          ? expectedMemberUids.includes(uid)
          : isMemberExpectedForSlot({
              member: memberSnapshot.data(),
              slot,
              timezone,
            });
      });

      if (eligibleSlotIndex < 0) {
        continue;
      }

      const slot = reminderSlots[eligibleSlotIndex];
      const opportunitySnapshot = await db
        .collection('userPrivate')
        .doc(uid)
        .collection('opportunities')
        .doc(`${circleSnapshot.id}_${slot.periodKey}_${slot.slotIndex}`)
        .get();
      const opportunityStatus = opportunitySnapshot.data()?.status;
      const userPrivateSnapshot = await db
        .collection('userPrivate')
        .doc(uid)
        .get();
      const userPrivate = userPrivateSnapshot.data();
      const eligibility = getReminderEligibility({
        cadence: commitmentCadence,
        circleId: circleSnapshot.id,
        dateKey: local.dateKey,
        kind,
        memberStatus: memberSnapshot.data().status,
        notificationSettings: userPrivate?.notificationSettings as
          | Record<string, unknown>
          | undefined,
        opportunityStatus,
        periodKey: slot.periodKey,
        remainingTapIns:
          opportunityStatus === 'completed' || opportunityStatus === 'skipped'
            ? 0
            : 1,
        slotIndex: slot.slotIndex,
        uid,
      });

      if (!eligibility.eligible || !eligibility.dedupeKey) {
        continue;
      }

      const groupKey = `${kind}_${local.dateKey}_${uid}`;
      const group =
        reminderGroups.get(groupKey) ??
        ({
          dateKey: local.dateKey,
          reminders: [],
          timezone,
          uid,
        } satisfies {
          dateKey: string;
          reminders: TapInReminderCircle[];
          timezone: string;
          uid: string;
        });

      group.reminders.push({
        circleId: circleSnapshot.id,
        circleTitle,
        dedupeKey: eligibility.dedupeKey,
        opportunityKey:
          commitmentCadence === 'daily'
            ? undefined
            : `${circleSnapshot.id}_${slot.periodKey}_${slot.slotIndex}`,
      });
      reminderGroups.set(groupKey, group);
    }
  }

  const sendPromises = Array.from(reminderGroups.values())
    .map(group => {
      const notification = buildTapInReminderNotification({
        dateKey: group.dateKey,
        kind,
        reminders: group.reminders,
        uid: group.uid,
      });

      if (!notification) {
        return undefined;
      }

      return createInboxEvent({
        body: notification.body,
        circleId: notification.circleId,
        copyVariant: notification.type,
        dedupeKey: notification.dedupeKey,
        deeplink: notification.deeplink,
        deliveryPriority: kind === 'midday' ? 'routine' : 'immediate',
        preferenceKey: 'tapInReminders',
        pushData: notification.pushData,
        routineTimezone: group.timezone,
        title: notification.title,
        type: notification.type,
        uid: group.uid,
      });
    })
    .filter((promise): promise is Promise<NotificationSendResult> =>
      Boolean(promise),
    );

  await Promise.all(sendPromises);
  return {sentOrSkipped: sendPromises.length};
}

function getPeriodKey({
  commitmentCadence,
  dateKey,
  periodDateKeys,
}: {
  commitmentCadence: CommitmentCadence;
  dateKey: string;
  periodDateKeys: string[];
}) {
  return commitmentCadence === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
}

export type CircleNudgePromptCandidate = {
  activeCount: number;
  behindCount: number;
  circleId: string;
  circleTitle: string;
  deadlineDateKey: string;
  periodKey: string;
  targetUid: string;
  timezone: string;
};

export function compareCircleNudgePromptCandidates(
  left: CircleNudgePromptCandidate,
  right: CircleNudgePromptCandidate,
) {
  const deadlineComparison = left.deadlineDateKey.localeCompare(
    right.deadlineDateKey,
  );

  if (deadlineComparison !== 0) {
    return deadlineComparison;
  }

  const riskShareComparison =
    right.behindCount * left.activeCount -
    left.behindCount * right.activeCount;

  if (riskShareComparison !== 0) {
    return riskShareComparison;
  }

  return left.circleId.localeCompare(right.circleId);
}

export function selectHighestPriorityCircleNudge(
  candidates: CircleNudgePromptCandidate[],
) {
  return [...candidates].sort(compareCircleNudgePromptCandidates)[0];
}

async function sendCircleEngagementPrompts() {
  const targetHour = 18;
  const now = new Date();
  const circleSnapshots = await db.collection('circles').get();
  const candidatesByUid = new Map<string, CircleNudgePromptCandidate[]>();
  const sendPromises: Promise<unknown>[] = [];

  for (const circleSnapshot of circleSnapshots.docs) {
    const circle = circleSnapshot.data();
    const timezone = asString(circle.timezone, 'UTC');
    const local = getLocalDateTimeParts(now, timezone);

    if (circle.circleMode === 'personal') {
      continue;
    }

    const commitmentCadence = getCommitmentCadence(circle);
    const periodDateKeys = getCommitmentPeriodDateKeys(
      commitmentCadence,
      timezone,
      now,
    );
    const requiredTapIns = getRequiredTapIns(circle);
    const [memberSnapshots, ...periodCheckInSnapshots] = await Promise.all([
      circleSnapshot.ref
        .collection('members')
        .where('status', '==', 'active')
        .get(),
      ...periodDateKeys.map(dateKey =>
        circleSnapshot.ref
          .collection('days')
          .doc(dateKey)
          .collection('checkIns')
          .get(),
      ),
    ]);
    const coveredCounts = new Map<string, number>();

    periodCheckInSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (isCoveredCheckInData(doc.data())) {
          const uid = asString(doc.data().uid, doc.id);
          coveredCounts.set(uid, (coveredCounts.get(uid) ?? 0) + 1);
        }
      });
    });

    const members = memberSnapshots.docs
      .map(snapshot => snapshot.data())
      .map(member => ({
        ...member,
        uid: asString(member.uid),
      }))
      .filter((member): member is DocumentData & {uid: string} =>
        Boolean(member.uid),
      );
    const behindMembers = members.filter(
      member => (coveredCounts.get(member.uid) ?? 0) < requiredTapIns,
    );
    const engagedMembers = members.filter(
      member => (coveredCounts.get(member.uid) ?? 0) >= requiredTapIns,
    );

    if (behindMembers.length === 0) {
      continue;
    }

    const circleTitle = asString(circle.title, 'Your circle');
    const periodKey = getPeriodKey({
      commitmentCadence,
      dateKey: local.dateKey,
      periodDateKeys,
    });
    const deadlineDateKey =
      periodDateKeys[periodDateKeys.length - 1] ?? local.dateKey;

    if (local.hour === targetHour) {
      behindMembers.forEach(member => {
        sendPromises.push(
          notifyMemberDuePrompt({
            circleId: circleSnapshot.id,
            circleTitle,
            commitmentCadence,
            periodKey,
            targetUid: member.uid,
            timezone,
          }),
        );
      });
    }

    engagedMembers.forEach(member => {
      const candidates = candidatesByUid.get(member.uid) ?? [];
      candidates.push({
        activeCount: members.length,
        behindCount: behindMembers.length,
        circleId: circleSnapshot.id,
        circleTitle,
        deadlineDateKey,
        periodKey,
        targetUid: member.uid,
        timezone,
      });
      candidatesByUid.set(member.uid, candidates);
    });
  }

  sendPromises.push(
    ...Array.from(candidatesByUid.entries()).map(
      async ([uid, candidates]) => {
        const [userPrivateSnapshot, userSnapshot] = await Promise.all([
          db.collection('userPrivate').doc(uid).get(),
          db.collection('users').doc(uid).get(),
        ]);
        const fallbackTimezone = candidates[0]?.timezone ?? 'UTC';
        const timezone = asString(
          userPrivateSnapshot.data()?.timezone,
          asString(userSnapshot.data()?.timezone, fallbackTimezone),
        );
        const local = getLocalDateTimeParts(now, timezone);

        if (local.hour !== targetHour) {
          return undefined;
        }

        const unsentCandidates = (
          await Promise.all(
            candidates.map(async candidate => {
              const dedupeKey = `circle_nudge_prompt_${candidate.circleId}_${candidate.periodKey}_${uid}`;
              const existingSnapshot = await userPrivateSnapshot.ref
                .collection('inbox')
                .doc(sanitizeEventId(dedupeKey))
                .get();

              return existingSnapshot.exists ? undefined : candidate;
            }),
          )
        ).filter(
          (candidate): candidate is CircleNudgePromptCandidate =>
            Boolean(candidate),
        );
        const selected = selectHighestPriorityCircleNudge(unsentCandidates);

        if (!selected) {
          return undefined;
        }

        return notifyCircleNudgePrompt({
          circleId: selected.circleId,
          circleTitle: selected.circleTitle,
          dateKey: local.dateKey,
          periodKey: selected.periodKey,
          targetCount: selected.behindCount,
          targetUid: selected.targetUid,
          timezone,
        });
      },
    ),
  );

  const results = await Promise.all(sendPromises);
  return {
    sentOrSkipped: results.filter(result => Boolean(result)).length,
  };
}

async function getEligibleDiscoveryCircleForUser({
  publicCircleSnapshots,
  uid,
}: {
  publicCircleSnapshots: QuerySnapshot<DocumentData>;
  uid: string;
}) {
  for (const circleSnapshot of publicCircleSnapshots.docs) {
    const circle = circleSnapshot.data();

    if (circle.circleMode === 'personal') {
      continue;
    }
    const memberCount =
      typeof circle.memberCount === 'number' &&
      Number.isFinite(circle.memberCount)
        ? circle.memberCount
        : 0;
    const maxSize =
      typeof circle.maxSize === 'number' && Number.isFinite(circle.maxSize)
        ? circle.maxSize
        : 0;

    if (maxSize > 0 && memberCount >= maxSize) {
      continue;
    }

    const memberSnapshot = await db
      .collection('circles')
      .doc(circleSnapshot.id)
      .collection('members')
      .doc(uid)
      .get();
    const memberStatus = memberSnapshot.data()?.status;

    if (memberStatus === 'active' || memberStatus === 'pending') {
      continue;
    }

    return {
      category: asString(circle.category, 'Hoyst'),
      circleId: circleSnapshot.id,
      title: asString(circle.title, 'Hoyst Circle'),
    };
  }

  return undefined;
}

async function sendCircleDiscoverySuggestions() {
  const now = new Date();
  const [userPrivateSnapshots, publicCircleSnapshots] = await Promise.all([
    db.collection('userPrivate').get(),
    db
      .collection('publicCircleIndex')
      .orderBy('updatedAt', 'desc')
      .limit(25)
      .get(),
  ]);
  const sendPromises: Promise<unknown>[] = [];

  if (publicCircleSnapshots.empty) {
    return {sentOrSkipped: 0};
  }

  for (const userPrivateSnapshot of userPrivateSnapshots.docs) {
    const uid = userPrivateSnapshot.id;
    const userPrivate = userPrivateSnapshot.data();
    const notificationSettings = userPrivate.notificationSettings as
      | Record<string, unknown>
      | undefined;

    if (!isPreferenceEnabled(notificationSettings, 'discovery')) {
      continue;
    }

    const inactivity = getDiscoveryInactivityEligibility({
      lastTapInAt: userPrivate.lastTapInAt ?? userPrivate.lastSignInAt,
      now,
    });

    if (!inactivity.eligible) {
      continue;
    }

    const deliveryEligibility = getRoutineNotificationEligibility({
      deliveryState: userPrivate.notificationDelivery as
        | RoutineDeliveryState
        | undefined,
      now,
      timezone: 'UTC',
      type: 'circle_discovery_suggestion',
    });

    if (!deliveryEligibility.eligible) {
      continue;
    }

    const circle = await getEligibleDiscoveryCircleForUser({
      publicCircleSnapshots,
      uid,
    });

    if (!circle) {
      continue;
    }

    sendPromises.push(
      notifyCircleDiscoverySuggestion({
        category: circle.category,
        circleId: circle.circleId,
        circleTitle: circle.title,
        dateKey: getLocalDateTimeParts(now, 'UTC').dateKey,
        targetUid: uid,
        timezone: 'UTC',
      }),
    );
  }

  await Promise.all(sendPromises);
  return {sentOrSkipped: sendPromises.length};
}

async function sendEveningActivitySummaries() {
  const now = new Date();
  const userPrivateSnapshots = await db.collection('userPrivate').get();
  let sentOrSkipped = 0;

  for (const userPrivateSnapshot of userPrivateSnapshots.docs) {
    const uid = userPrivateSnapshot.id;
    const userPrivate = userPrivateSnapshot.data();
    const userSnapshot = await db.collection('users').doc(uid).get();
    const timezone = asString(
      userPrivate.timezone,
      asString(userSnapshot.data()?.timezone, 'UTC'),
    );
    const local = getLocalDateTimeParts(now, timezone);
    const deliveryState = (userPrivate.notificationDelivery ?? {}) as
      | RoutineDeliveryState
      | undefined;

    if (local.hour !== eveningSummaryHour) {
      continue;
    }

    if (deliveryState?.eveningSummaryDateKey === local.dateKey) {
      continue;
    }

    const inboxRef = userPrivateSnapshot.ref.collection('inbox');
    const [deferredSnapshot, recentSnapshot] = await Promise.all([
      inboxRef.where('push.status', '==', 'deferred').get(),
      inboxRef.orderBy('createdAt', 'desc').limit(100).get(),
    ]);
    const recentEvents = recentSnapshot.docs.map(doc => doc.data());
    const coveredCircleIds = getSameDayImmediateCoverageCircleIds({
      dateKey: local.dateKey,
      events: recentEvents,
      timezone,
    });
    const includedDocs = deferredSnapshot.docs.filter(doc =>
      shouldIncludeInEveningSummary({
        coveredCircleIds,
        dateKey: local.dateKey,
        event: doc.data(),
        timezone,
      }),
    );
    const coveredDocs = deferredSnapshot.docs.filter(doc => {
      const data = doc.data();
      const circleId = getCandidateCircleId(data);

      return (
        circleId &&
        coveredCircleIds.has(circleId) &&
        getCandidatePushStatus(data) === 'deferred' &&
        isCandidateOnLocalDate({
          candidate: data,
          dateKey: local.dateKey,
          timezone,
        })
      );
    });

    if (includedDocs.length === 0 && coveredDocs.length === 0) {
      continue;
    }

    const summary = buildEveningSummaryCopy(
      includedDocs.map(doc => doc.data()),
    );
    const dedupeKey = `evening_summary_${uid}_${local.dateKey}`;
    const summaryResult =
      includedDocs.length > 0
        ? await createInboxEvent({
            body: summary.body,
            copyVariant: 'evening_summary',
            dedupeKey,
            deeplink: {screen: 'Inbox'},
            preferenceKey: 'socialActivity',
            title: summary.title,
            type: 'evening_summary',
            uid,
          })
        : undefined;

    let batch = db.batch();
    let pendingWrites = 0;
    const markDoc = async (
      doc: (typeof deferredSnapshot.docs)[number],
      status: 'covered_by_immediate' | 'summarized',
    ) => {
      batch.set(
        doc.ref,
        {
          push: {
            ...(status === 'summarized' && summaryResult
              ? {summaryEventId: summaryResult.eventId}
              : {}),
            status,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        {merge: true},
      );
      pendingWrites += 1;

      if (pendingWrites === inboxReadBatchLimit) {
        await batch.commit();
        batch = db.batch();
        pendingWrites = 0;
      }
    };

    for (const doc of includedDocs) {
      await markDoc(doc, 'summarized');
    }

    for (const doc of coveredDocs) {
      await markDoc(doc, 'covered_by_immediate');
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }

    await userPrivateSnapshot.ref.set(
      {
        notificationDelivery: {
          eveningSummaryDateKey: local.dateKey,
          eveningSummaryLastSentAt: FieldValue.serverTimestamp(),
        },
      },
      {merge: true},
    );

    sentOrSkipped += summaryResult ? 1 : 0;
  }

  return {sentOrSkipped};
}

export const sendMiddayTapInReminders = onSchedule(
  {schedule: '0 * * * *', secrets: [oneSignalRestApiKey]},
  async () => {
    await sendTapInReminders('midday');
  },
);

export const sendFinalTapInWarnings = onSchedule(
  {schedule: '0 * * * *', secrets: [oneSignalRestApiKey]},
  async () => {
    await sendTapInReminders('final');
  },
);

export const sendRoutineEngagementNotifications = onSchedule(
  {schedule: '15 * * * *', secrets: [oneSignalRestApiKey]},
  async () => {
    await sendCircleEngagementPrompts();
    await sendCircleDiscoverySuggestions();
  },
);

export const sendEveningActivityRecaps = onSchedule(
  {schedule: '30 * * * *', secrets: [oneSignalRestApiKey]},
  async () => {
    await sendEveningActivitySummaries();
  },
);

export const repairPushSubscription = onCall(
  {secrets: [oneSignalRestApiKey]},
  async request => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in is required.');
    }

    const input = repairPushSubscriptionSchema.parse(request.data);
    const uid = request.auth.uid;
    const {appId, restApiKey} = getOneSignalConfig();

    if (!appId || !restApiKey) {
      throw new HttpsError(
        'failed-precondition',
        'OneSignal is not configured.',
      );
    }

    let userResult: Awaited<ReturnType<typeof fetchOneSignalUserByExternalId>>;

    try {
      userResult = await fetchOneSignalUserByExternalId({
        appId,
        restApiKey,
        uid,
      });
    } catch (error) {
      console.error('onesignal_user_fetch_request_failed', error);
      throw new HttpsError(
        'internal',
        'Could not load push subscription state.',
      );
    }

    if (!userResult.response.ok) {
      console.error('onesignal_user_fetch_failed', {
        errors: userResult.payload,
        status: userResult.response.status,
      });
      throw new HttpsError(
        userResult.response.status === 404 ? 'not-found' : 'internal',
        'Could not load push subscription state.',
      );
    }

    const subscription = (userResult.payload?.subscriptions ?? []).find(
      candidate => getSubscriptionId(candidate) === input.subscriptionId,
    );

    if (!subscription) {
      throw new HttpsError(
        'permission-denied',
        'Push subscription is not linked to this user.',
      );
    }

    const subscriptionType = getSubscriptionType(subscription);

    if (subscriptionType && subscriptionType !== 'iOSPush') {
      throw new HttpsError(
        'failed-precondition',
        'Push subscription is not an iOS push subscription.',
      );
    }

    const remoteToken = getSubscriptionToken(subscription);

    if (remoteToken && remoteToken !== input.token) {
      throw new HttpsError(
        'permission-denied',
        'Push subscription token does not match this device.',
      );
    }

    const enabled = getSubscriptionEnabled(subscription);
    const notificationTypes = getSubscriptionNotificationTypes(subscription);

    if (enabled && (notificationTypes === undefined || notificationTypes > 0)) {
      return {repaired: false as const, status: 'already-enabled' as const};
    }

    let repairResult: Awaited<ReturnType<typeof patchOneSignalSubscription>>;

    try {
      repairResult = await patchOneSignalSubscription({
        appId,
        restApiKey,
        subscription,
        subscriptionId: input.subscriptionId,
        token: input.token,
      });
    } catch (error) {
      console.error('onesignal_subscription_repair_request_failed', error);
      throw new HttpsError('internal', 'Could not repair push subscription.');
    }

    if (!repairResult.response.ok) {
      console.error('onesignal_subscription_repair_failed', {
        errors: repairResult.payload?.errors,
        status: repairResult.response.status,
      });
      throw new HttpsError('internal', 'Could not repair push subscription.');
    }

    return {repaired: true as const, status: 'repaired' as const};
  },
);

export const updateNotificationSettings = onCall(async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const input = updateNotificationSettingsSchema.parse(request.data);
  const uid = request.auth.uid;

  await db.collection('userPrivate').doc(uid).set(
    {
      notificationSettings: input.notificationSettings,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return {notificationSettings: input.notificationSettings};
});

export const markInboxEventRead = onCall(async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const input = markInboxEventReadSchema.parse(request.data);
  await db
    .collection('userPrivate')
    .doc(request.auth.uid)
    .collection('inbox')
    .doc(input.eventId)
    .set({readAt: FieldValue.serverTimestamp()}, {merge: true});

  return {read: true as const};
});

export const markInboxEventsRead = onCall(async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const read = await markUnreadInboxEventsRead(request.auth.uid);

  return {read};
});

export const notificationModules = {
  createInboxEvent: 'active',
  sendEveningActivityRecaps: 'active',
  markInboxEventsRead: 'active',
  repairPushSubscription: 'active',
  sendFinalTapInWarnings: 'active',
  sendMiddayTapInReminders: 'active',
  sendRoutineEngagementNotifications: 'active',
};
