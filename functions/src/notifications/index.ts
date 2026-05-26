import {FieldValue, type DocumentData} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {z} from 'zod';

import {db} from '../firebase';
import {
  type CommitmentCadence,
  getCommitmentCadence,
  getRequiredTapIns,
} from '../shared/commitments';

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
  remainingTapIns?: number;
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

const inboxReadBatchLimit = 500;

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
  const year = Number(parts.find(part => part.type === 'year')?.value ?? '1970');
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

export function buildOneSignalPushPayload({
  appId,
  body,
  circleId,
  eventId,
  title,
  type,
  uid,
}: {
  appId: string;
  body: string;
  circleId?: string;
  eventId: string;
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
    body: JSON.stringify(
      buildOneSignalPushPayload({
        appId,
        body,
        circleId,
        eventId,
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

  return createInboxEvent({
    actor: notificationActor,
    body: `${actorName} nudged you in ${circleTitle}.`,
    circleId,
    dedupeKey: `nudge_${circleId}_${dateKey}_${targetUid}`,
    deeplink: {circleId, screen: 'TapInComposer', source: 'notification'},
    preferenceKey: 'circleActivity',
    title: 'Tap In nudge',
    type: 'nudge',
    uid: targetUid,
  });
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
  const periodCopy =
    commitmentCadence === 'daily'
      ? 'today'
      : commitmentCadence === 'monthly'
      ? 'this month'
      : 'this week';

  return `${circleTitle} needs ${remainingCount} more Tap In${
    remainingCount === 1 ? '' : 's'
  } ${periodCopy}.`;
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
  return createInboxEvent({
    body: getCircleAtRiskNotificationBody({
      circleTitle,
      commitmentCadence,
      remainingCount,
    }),
    circleId,
    dedupeKey: `circle_at_risk_${circleId}_${periodKey}_${targetUid}`,
    deeplink: {circleId, screen: 'CircleDetail'},
    preferenceKey: 'circleActivity',
    title: 'Circle Progression at risk',
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
  remainingTapIns,
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

  if (typeof remainingTapIns === 'number' && remainingTapIns <= 0) {
    return {eligible: false, reason: 'frequency-complete'};
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
    const commitmentCadence = getCommitmentCadence(circle);
    const periodDateKeys = getCommitmentPeriodDateKeys(
      commitmentCadence,
      timezone,
      now,
    );
    const requiredTapIns = getRequiredTapIns(circle);

    if (local.hour !== targetHour) {
      continue;
    }

    const [memberSnapshots, todayCheckInSnapshots, ...periodCheckInSnapshots] =
      await Promise.all([
        circleSnapshot.ref
          .collection('members')
          .where('status', '==', 'active')
          .get(),
        circleSnapshot.ref
          .collection('days')
          .doc(local.dateKey)
          .collection('checkIns')
          .get(),
        ...periodDateKeys.map(dateKey =>
          circleSnapshot.ref
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .get(),
        ),
      ]);
    const checkInStatuses = new Map(
      todayCheckInSnapshots.docs.map(snapshot => {
        const data = snapshot.data();

        return [asString(data.uid, snapshot.id), data.status] as const;
      }),
    );
    const coveredCounts = new Map<string, number>();
    const scoringSnapshots =
      commitmentCadence === 'daily'
        ? [todayCheckInSnapshots]
        : periodCheckInSnapshots;

    scoringSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (doc.data().status === 'done' || doc.data().status === 'skip') {
          const uid = asString(doc.data().uid, doc.id);
          coveredCounts.set(uid, (coveredCounts.get(uid) ?? 0) + 1);
        }
      });
    });
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
        remainingTapIns: Math.max(
          requiredTapIns - (coveredCounts.get(uid) ?? 0),
          0,
        ),
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
              ? `Tap In to keep ${circleTitle} Progression moving.`
              : `2 hours left to Tap In for ${circleTitle}.`,
          circleId: circleSnapshot.id,
          dedupeKey: eligibility.dedupeKey,
          deeplink: {
            circleId: circleSnapshot.id,
            screen: 'TapInComposer',
            source: 'notification',
          },
          preferenceKey: 'tapInReminders',
          title:
            kind === 'midday'
              ? 'Keep your Commitment moving'
              : '2 hours left',
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

export const markInboxEventsRead = onCall(async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const read = await markUnreadInboxEventsRead(request.auth.uid);

  return {read};
});

export const notificationModules = {
  createInboxEvent: 'active',
  markInboxEventsRead: 'active',
  sendFinalTapInWarnings: 'active',
  sendMiddayTapInReminders: 'active',
};
