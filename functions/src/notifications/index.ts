import {FieldValue, type DocumentData} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {z} from 'zod';

import {db} from '../firebase';

export const oneSignalRestApiKey = defineSecret('ONESIGNAL_REST_API_KEY');
export const oneSignalAppId = defineString('ONESIGNAL_APP_ID', {default: ''});

export type NotificationPreferenceKey =
  | 'circleActivity'
  | 'productUpdates'
  | 'tapInReminders';

export type NotificationType =
  | 'circle_at_risk'
  | 'join_approved'
  | 'join_declined'
  | 'join_request'
  | 'member_joined'
  | 'poke'
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
  | {screen: 'TapInComposer'; circleId: string; source: 'notification'};

export type CreateNotificationInput = {
  actor?: NotificationActor;
  body: string;
  circleId?: string;
  dedupeKey?: string;
  deeplink: NotificationDeeplink;
  preferenceKey: NotificationPreferenceKey;
  pushData?: Record<string, string>;
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

export type NotificationSendResult = {
  created: boolean;
  eventId: string;
  pushStatus: 'disabled' | 'failed' | 'sent' | 'skipped';
};

export type ReminderCandidate = {
  circleId: string;
  dateKey: string;
  kind: 'final' | 'midday';
  memberStatus?: unknown;
  notificationSettings?: Record<string, unknown>;
  todayStatus?: unknown;
  uid: string;
};

const notificationSettingsSchema = z.object({
  circleActivity: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  tapInReminders: z.boolean().optional(),
});

const updateNotificationSettingsSchema = z.object({
  notificationSettings: notificationSettingsSchema,
});

const markInboxEventReadSchema = z.object({
  eventId: z.string().trim().min(1),
});

const defaultNotificationSettings: Record<NotificationPreferenceKey, boolean> =
  {
    circleActivity: true,
    productUpdates: true,
    tapInReminders: true,
  };

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

function sanitizeEventId(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 500);
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

function isPreferenceEnabled(
  notificationSettings: Record<string, unknown> | undefined,
  key: NotificationPreferenceKey,
) {
  const value = notificationSettings?.[key];
  return typeof value === 'boolean' ? value : defaultNotificationSettings[key];
}

async function isUserPreferenceEnabled(
  uid: string,
  key: NotificationPreferenceKey,
) {
  const snapshot = await db.collection('userPrivate').doc(uid).get();
  const data = snapshot.data();
  return isPreferenceEnabled(
    data?.notificationSettings as Record<string, unknown> | undefined,
    key,
  );
}

async function sendPushToUser({
  body,
  circleId,
  eventId,
  title,
  type,
  uid,
}: {
  body: string;
  circleId?: string;
  eventId: string;
  title: string;
  type: NotificationType;
  uid: string;
}) {
  const {appId, restApiKey} = getOneSignalConfig();

  if (!appId || !restApiKey) {
    return {status: 'skipped' as const};
  }

  const response = await fetch('https://api.onesignal.com/notifications', {
    body: JSON.stringify({
      app_id: appId,
      contents: {en: body},
      data: {
        ...(circleId ? {circleId} : {}),
        eventId,
        type,
      },
      headings: {en: title},
      include_aliases: {
        external_id: [uid],
      },
      target_channel: 'push',
    }),
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

export async function createInboxEvent({
  actor,
  body,
  circleId,
  dedupeKey,
  deeplink,
  preferenceKey,
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
  const existingSnapshot = await eventRef.get();

  if (existingSnapshot.exists) {
    return {created: false, eventId, pushStatus: 'skipped'};
  }

  const enabled = await isUserPreferenceEnabled(uid, preferenceKey);
  await eventRef.set({
    actor: actor ?? null,
    body,
    circleId: circleId ?? null,
    createdAt: FieldValue.serverTimestamp(),
    deeplink,
    preferenceKey,
    push: {
      status: enabled ? 'pending' : 'disabled',
    },
    readAt: null,
    title,
    type,
  });

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

  const pushResult = await sendPushToUser({
    body,
    circleId,
    eventId,
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

  return createInboxEvent({
    actor,
    body: `${actorName} requested to join ${circleTitle}.`,
    circleId,
    dedupeKey: getJoinRequestNotificationDedupeKey({
      circleId,
      requesterId: actor?.uid,
      requestToken,
    }),
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleActivity',
    title: 'New join request',
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

  if (actor?.uid === ownerId) {
    return undefined;
  }

  return createInboxEvent({
    actor,
    body: `${actorName} joined ${circleTitle}.`,
    circleId,
    dedupeKey: `member_joined_${circleId}_${actor?.uid ?? 'unknown'}`,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleActivity',
    title: 'New circle member',
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
  return createInboxEvent({
    actor: buildActor(owner),
    body: approved
      ? `Your request to join ${circleTitle} was approved.`
      : `Your request to join ${circleTitle} was declined.`,
    circleId,
    dedupeKey: `join_review_${circleId}_${requesterId}_${
      approved ? 'approved' : 'declined'
    }`,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleActivity',
    title: approved ? 'Request approved' : 'Request declined',
    type: approved ? 'join_approved' : 'join_declined',
    uid: requesterId,
  });
}

export async function notifyPoke({
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

  return createInboxEvent({
    actor: notificationActor,
    body: `${actorName} nudged you in ${circleTitle}.`,
    circleId,
    dedupeKey: `poke_${circleId}_${dateKey}_${targetUid}`,
    deeplink: {circleId, screen: 'TapInComposer', source: 'notification'},
    preferenceKey: 'circleActivity',
    title: 'Tap In nudge',
    type: 'poke',
    uid: targetUid,
  });
}

export async function notifyCircleAtRisk({
  circleId,
  circleTitle,
  dateKey,
  remainingCount,
  targetUid,
}: {
  circleId: string;
  circleTitle: string;
  dateKey: string;
  remainingCount: number;
  targetUid: string;
}) {
  return createInboxEvent({
    body: `${circleTitle} needs ${remainingCount} more Tap In${
      remainingCount === 1 ? '' : 's'
    } today.`,
    circleId,
    dedupeKey: `circle_at_risk_${circleId}_${dateKey}_${targetUid}`,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleActivity',
    title: 'Circle at risk',
    type: 'circle_at_risk',
    uid: targetUid,
  });
}

export function getReminderEligibility({
  circleId,
  dateKey,
  kind,
  memberStatus,
  notificationSettings,
  todayStatus,
  uid,
}: ReminderCandidate) {
  if (!uid || !circleId || !dateKey) {
    return {eligible: false, reason: 'missing-input'};
  }

  if (memberStatus !== 'active') {
    return {eligible: false, reason: 'inactive-member'};
  }

  if (todayStatus === 'done' || todayStatus === 'skip') {
    return {eligible: false, reason: 'already-covered'};
  }

  if (!isPreferenceEnabled(notificationSettings, 'tapInReminders')) {
    return {eligible: false, reason: 'preference-disabled'};
  }

  return {
    dedupeKey: `tap_in_${kind}_${circleId}_${dateKey}_${uid}`,
    eligible: true,
    reason: 'eligible',
  };
}

async function sendTapInReminders(kind: 'final' | 'midday') {
  const targetHour = kind === 'midday' ? 12 : 22;
  const now = new Date();
  const circleSnapshots = await db.collection('circles').get();
  const sendPromises: Promise<unknown>[] = [];

  for (const circleSnapshot of circleSnapshots.docs) {
    const circle = circleSnapshot.data();
    const timezone = asString(circle.timezone, 'UTC');
    const local = getLocalDateTimeParts(now, timezone);

    if (local.hour !== targetHour) {
      continue;
    }

    const [memberSnapshots, checkInSnapshots] = await Promise.all([
      circleSnapshot.ref
        .collection('members')
        .where('status', '==', 'active')
        .get(),
      circleSnapshot.ref
        .collection('days')
        .doc(local.dateKey)
        .collection('checkIns')
        .get(),
    ]);
    const checkInStatuses = new Map(
      checkInSnapshots.docs.map(snapshot => [
        snapshot.id,
        snapshot.data().status,
      ]),
    );
    const circleTitle = asString(circle.title, 'Your circle');

    for (const memberSnapshot of memberSnapshots.docs) {
      const uid = asString(memberSnapshot.data().uid, memberSnapshot.id);
      const userPrivateSnapshot = await db
        .collection('userPrivate')
        .doc(uid)
        .get();
      const userPrivate = userPrivateSnapshot.data();
      const eligibility = getReminderEligibility({
        circleId: circleSnapshot.id,
        dateKey: local.dateKey,
        kind,
        memberStatus: memberSnapshot.data().status,
        notificationSettings: userPrivate?.notificationSettings as
          | Record<string, unknown>
          | undefined,
        todayStatus: checkInStatuses.get(uid),
        uid,
      });

      if (!eligibility.eligible || !eligibility.dedupeKey) {
        continue;
      }

      sendPromises.push(
        createInboxEvent({
          body:
            kind === 'midday'
              ? `Tap In to keep your ${circleTitle} streak moving.`
              : `2 hours left to Tap In for ${circleTitle}.`,
          circleId: circleSnapshot.id,
          dedupeKey: eligibility.dedupeKey,
          deeplink: {
            circleId: circleSnapshot.id,
            screen: 'TapInComposer',
            source: 'notification',
          },
          preferenceKey: 'tapInReminders',
          title: kind === 'midday' ? 'Keep your streak alive' : '2 hours left',
          type:
            kind === 'midday'
              ? 'tap_in_midday_reminder'
              : 'tap_in_final_warning',
          uid,
        }),
      );
    }
  }

  await Promise.all(sendPromises);
  return {sentOrSkipped: sendPromises.length};
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

export const notificationModules = {
  createInboxEvent: 'active',
  sendFinalTapInWarnings: 'active',
  sendMiddayTapInReminders: 'active',
};
