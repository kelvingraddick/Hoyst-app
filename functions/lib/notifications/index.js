"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationModules = exports.markInboxEventsRead = exports.markInboxEventRead = exports.updateNotificationSettings = exports.sendRoutineEngagementNotifications = exports.sendFinalTapInWarnings = exports.sendMiddayTapInReminders = exports.oneSignalAppId = exports.oneSignalRestApiKey = void 0;
exports.getJoinRequestNotificationDedupeKey = getJoinRequestNotificationDedupeKey;
exports.getNudgeNotificationDedupeKey = getNudgeNotificationDedupeKey;
exports.getNotificationCopyVariantIndex = getNotificationCopyVariantIndex;
exports.resolveNotificationCopy = resolveNotificationCopy;
exports.getRoutineNotificationEligibility = getRoutineNotificationEligibility;
exports.getDiscoveryInactivityEligibility = getDiscoveryInactivityEligibility;
exports.getNotificationPreferenceEnabled = getNotificationPreferenceEnabled;
exports.buildOneSignalPushPayload = buildOneSignalPushPayload;
exports.markUnreadInboxEventsRead = markUnreadInboxEventsRead;
exports.createInboxEvent = createInboxEvent;
exports.notifyOwnerJoinRequest = notifyOwnerJoinRequest;
exports.notifyOwnerNewJoin = notifyOwnerNewJoin;
exports.notifyJoinRequestReview = notifyJoinRequestReview;
exports.notifyNudge = notifyNudge;
exports.getCircleAtRiskNotificationBody = getCircleAtRiskNotificationBody;
exports.notifyCompanionTappedIn = notifyCompanionTappedIn;
exports.notifyCircleComplete = notifyCircleComplete;
exports.notifyMemberDuePrompt = notifyMemberDuePrompt;
exports.notifyCircleNudgePrompt = notifyCircleNudgePrompt;
exports.notifyCircleDiscoverySuggestion = notifyCircleDiscoverySuggestion;
exports.notifyCircleAtRisk = notifyCircleAtRisk;
exports.getReminderEligibility = getReminderEligibility;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const commitments_1 = require("../shared/commitments");
exports.oneSignalRestApiKey = (0, params_1.defineSecret)('ONESIGNAL_REST_API_KEY');
exports.oneSignalAppId = (0, params_1.defineString)('ONESIGNAL_APP_ID', { default: '' });
function getJoinRequestNotificationDedupeKey({ circleId, requesterId, requestToken, }) {
    const safeRequesterId = typeof requesterId === 'string' && requesterId.trim().length > 0
        ? requesterId.trim()
        : 'unknown';
    const safeRequestToken = typeof requestToken === 'string' && requestToken.trim().length > 0
        ? requestToken.trim()
        : 'current';
    return `join_request_${circleId}_${safeRequesterId}_${safeRequestToken}`;
}
function getNudgeNotificationDedupeKey({ actorUid, circleId, dateKey, targetUid, }) {
    const safeActorUid = typeof actorUid === 'string' && actorUid.trim().length > 0
        ? actorUid.trim()
        : 'unknown';
    return `nudge_${circleId}_${dateKey}_${safeActorUid}_${targetUid}`;
}
const notificationSettingsSchema = zod_1.z.object({
    circleActivity: zod_1.z.boolean().optional(),
    circleRisk: zod_1.z.boolean().optional(),
    discovery: zod_1.z.boolean().optional(),
    nudges: zod_1.z.boolean().optional(),
    productUpdates: zod_1.z.boolean().optional(),
    socialActivity: zod_1.z.boolean().optional(),
    tapInReminders: zod_1.z.boolean().optional(),
});
const updateNotificationSettingsSchema = zod_1.z.object({
    notificationSettings: notificationSettingsSchema,
});
const markInboxEventReadSchema = zod_1.z.object({
    eventId: zod_1.z.string().trim().min(1),
});
const inboxReadBatchLimit = 500;
const defaultNotificationSettings = {
    circleRisk: true,
    discovery: true,
    nudges: true,
    productUpdates: true,
    socialActivity: true,
    tapInReminders: true,
};
const routineSpacingMs = 6 * 60 * 60 * 1000;
const routineDailyLimit = 2;
const discoverySpacingMs = 7 * 24 * 60 * 60 * 1000;
const discoveryInactivityMs = 3 * 24 * 60 * 60 * 1000;
function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : fallback;
}
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function sanitizeEventId(value) {
    return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 500);
}
function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
}
function getTapInCountLabel(count) {
    const safeCount = Math.max(1, Math.round(count ?? 1));
    return `${safeCount} Tap In${safeCount === 1 ? '' : 's'}`;
}
function getCircleTitle(context) {
    return context.circleTitle ?? context.discoveryCircleTitle ?? 'your circle';
}
function getActorName(context) {
    return context.actorName ?? 'Someone';
}
function getPeriodCopy(context) {
    return context.periodCopy ?? 'this period';
}
const notificationCopyCatalog = {
    circle_at_risk: [
        context => ({
            body: `${getCircleTitle(context)} needs ${getTapInCountLabel(context.remainingCount)} ${getPeriodCopy(context)}.`,
            title: 'Circle Progression at risk',
        }),
        context => ({
            body: `${getCircleTitle(context)} is close. ${getTapInCountLabel(context.remainingCount)} will keep it moving ${getPeriodCopy(context)}.`,
            title: 'Close to complete',
        }),
        context => ({
            body: `${getCircleTitle(context)} needs a little help: ${getTapInCountLabel(context.remainingCount)} left ${getPeriodCopy(context)}.`,
            title: 'Progression needs help',
        }),
        context => ({
            body: `${getTapInCountLabel(context.remainingCount)} can protect ${getCircleTitle(context)} ${getPeriodCopy(context)}.`,
            title: 'Almost there',
        }),
        context => ({
            body: `${getCircleTitle(context)} is not far off. ${getTapInCountLabel(context.remainingCount)} still needed ${getPeriodCopy(context)}.`,
            title: 'Circle check-in',
        }),
    ],
    circle_complete: [
        context => ({
            body: `${getCircleTitle(context)} is fully tapped in ${getPeriodCopy(context)}. Nice work.`,
            title: 'Circle complete',
        }),
        context => ({
            body: `Everyone came through for ${getCircleTitle(context)} ${getPeriodCopy(context)}.`,
            title: 'All tapped in',
        }),
        context => ({
            body: `${getCircleTitle(context)} hit the commitment ${getPeriodCopy(context)}.`,
            title: 'Progression secured',
        }),
        context => ({
            body: `${getCircleTitle(context)} is complete ${getPeriodCopy(context)}. The circle showed up.`,
            title: 'Circle showed up',
        }),
        context => ({
            body: `${getCircleTitle(context)} has everyone covered ${getPeriodCopy(context)}.`,
            title: 'Commitment complete',
        }),
    ],
    circle_discovery_suggestion: [
        context => ({
            body: `${context.discoveryCircleTitle ?? 'A public circle'} could help you restart your rhythm.`,
            title: 'Find a new circle',
        }),
        context => ({
            body: `A ${context.discoveryCategory ?? 'Hoyst'} circle is open when you are ready to jump back in.`,
            title: 'A fresh circle is waiting',
        }),
        context => ({
            body: `${context.discoveryCircleTitle ?? 'A new circle'} might be a good place to build momentum again.`,
            title: 'Restart with a circle',
        }),
        context => ({
            body: `You have an open seat to explore in ${context.discoveryCircleTitle ?? 'a public circle'}.`,
            title: 'Explore a circle',
        }),
        context => ({
            body: `When you are ready, ${context.discoveryCircleTitle ?? 'a Hoyst circle'} can help you get moving again.`,
            title: 'Ready for a reset?',
        }),
    ],
    circle_nudge_prompt: [
        context => ({
            body: `${getCircleTitle(context)} could use a nudge for ${context.targetCount ?? 1} companion${(context.targetCount ?? 1) === 1 ? '' : 's'}.`,
            title: 'Help the circle move',
        }),
        context => ({
            body: `You are covered in ${getCircleTitle(context)}. A quick nudge could help the rest catch up.`,
            title: 'Send a teammate a nudge',
        }),
        context => ({
            body: `${getCircleTitle(context)} is close. Your nudge could help finish the job.`,
            title: 'Keep the circle together',
        }),
        context => ({
            body: `A companion in ${getCircleTitle(context)} still has room to Tap In.`,
            title: 'Someone might need a nudge',
        }),
        context => ({
            body: `You can help ${getCircleTitle(context)} stay on track with one quick nudge.`,
            title: 'Circle needs a boost',
        }),
    ],
    companion_tapped_in: [
        context => ({
            body: `${getActorName(context)} tapped in for ${getCircleTitle(context)}.`,
            title: 'A companion tapped in',
        }),
        context => ({
            body: `${getActorName(context)} just moved ${getCircleTitle(context)} forward.`,
            title: 'Progress in your circle',
        }),
        context => ({
            body: `${getActorName(context)} showed up in ${getCircleTitle(context)}.`,
            title: 'Your circle is moving',
        }),
        context => ({
            body: `${getCircleTitle(context)} has a fresh Tap In from ${getActorName(context)}.`,
            title: 'New Tap In',
        }),
        context => ({
            body: `${getActorName(context)} kept the momentum going in ${getCircleTitle(context)}.`,
            title: 'Momentum update',
        }),
    ],
    join_approved: [
        context => ({
            body: `Your request to join ${getCircleTitle(context)} was approved.`,
            title: 'Request approved',
        }),
        context => ({
            body: `You are in ${getCircleTitle(context)}. Tap In when you are ready.`,
            title: 'Welcome to the circle',
        }),
        context => ({
            body: `${getCircleTitle(context)} approved your join request.`,
            title: 'You are approved',
        }),
        context => ({
            body: `You can now join the rhythm in ${getCircleTitle(context)}.`,
            title: 'Circle unlocked',
        }),
        context => ({
            body: `Your seat in ${getCircleTitle(context)} is ready.`,
            title: 'You are in',
        }),
    ],
    join_declined: [
        context => ({
            body: `Your request to join ${getCircleTitle(context)} was declined.`,
            title: 'Request declined',
        }),
        context => ({
            body: `${getCircleTitle(context)} was not opened this time. You can explore another circle.`,
            title: 'Join request update',
        }),
        context => ({
            body: `This request for ${getCircleTitle(context)} did not go through.`,
            title: 'Circle request closed',
        }),
        context => ({
            body: `${getCircleTitle(context)} declined the request. There are other circles to explore.`,
            title: 'Not this circle',
        }),
        context => ({
            body: `Your ${getCircleTitle(context)} request was reviewed and declined.`,
            title: 'Request reviewed',
        }),
    ],
    join_request: [
        context => ({
            body: `${getActorName(context)} requested to join ${getCircleTitle(context)}.`,
            title: 'New join request',
        }),
        context => ({
            body: `${getActorName(context)} wants to join ${getCircleTitle(context)}.`,
            title: 'Review a request',
        }),
        context => ({
            body: `${getCircleTitle(context)} has a new request from ${getActorName(context)}.`,
            title: 'Someone wants in',
        }),
        context => ({
            body: `Review ${getActorName(context)} for ${getCircleTitle(context)}.`,
            title: 'Circle request waiting',
        }),
        context => ({
            body: `${getActorName(context)} is asking for a seat in ${getCircleTitle(context)}.`,
            title: 'Join request',
        }),
    ],
    member_due_prompt: [
        context => ({
            body: `${getCircleTitle(context)} still needs your Tap In ${getPeriodCopy(context)}.`,
            title: 'Your circle needs you',
        }),
        context => ({
            body: `You can still help ${getCircleTitle(context)} keep Progression moving.`,
            title: 'Tap In when ready',
        }),
        context => ({
            body: `${getCircleTitle(context)} has room for your Tap In ${getPeriodCopy(context)}.`,
            title: 'A Tap In is open',
        }),
        context => ({
            body: `Your spot in ${getCircleTitle(context)} is still waiting ${getPeriodCopy(context)}.`,
            title: 'Keep your spot covered',
        }),
        context => ({
            body: `A quick Tap In can help ${getCircleTitle(context)} stay steady.`,
            title: 'Help your circle',
        }),
    ],
    member_joined: [
        context => ({
            body: `${getActorName(context)} joined ${getCircleTitle(context)}.`,
            title: 'New circle member',
        }),
        context => ({
            body: `${getCircleTitle(context)} has a new companion: ${getActorName(context)}.`,
            title: 'Someone joined',
        }),
        context => ({
            body: `${getActorName(context)} is now part of ${getCircleTitle(context)}.`,
            title: 'Circle grew',
        }),
        context => ({
            body: `${getActorName(context)} took a seat in ${getCircleTitle(context)}.`,
            title: 'New companion',
        }),
        context => ({
            body: `${getCircleTitle(context)} welcomed ${getActorName(context)}.`,
            title: 'Member joined',
        }),
    ],
    nudge: [
        context => ({
            body: `${getActorName(context)} nudged you in ${getCircleTitle(context)}.`,
            title: 'Tap In nudge',
        }),
        context => ({
            body: `${getActorName(context)} sent a nudge from ${getCircleTitle(context)}.`,
            title: 'Nudge from your circle',
        }),
        context => ({
            body: `${getCircleTitle(context)} got a nudge from ${getActorName(context)}.`,
            title: 'A companion nudged you',
        }),
        context => ({
            body: `${getActorName(context)} is keeping ${getCircleTitle(context)} moving.`,
            title: 'Your circle checked in',
        }),
        context => ({
            body: `${getActorName(context)} gave you a friendly Tap In nudge.`,
            title: 'Friendly nudge',
        }),
    ],
    tap_in_final_warning: [
        context => ({
            body: `2 hours left to Tap In for ${getCircleTitle(context)}.`,
            title: '2 hours left',
        }),
        context => ({
            body: `${getCircleTitle(context)} is closing soon. Tap In while there is still time.`,
            title: 'Last call',
        }),
        context => ({
            body: `Your ${getCircleTitle(context)} window has 2 hours left.`,
            title: 'Tap In window closing',
        }),
        context => ({
            body: `There is still time to cover ${getCircleTitle(context)} today.`,
            title: 'Still time',
        }),
        context => ({
            body: `Final reminder for ${getCircleTitle(context)}. Keep the Commitment covered.`,
            title: 'Final Tap In reminder',
        }),
    ],
    tap_in_midday_reminder: [
        context => ({
            body: `Tap In to keep ${getCircleTitle(context)} Progression moving.`,
            title: 'Keep your Commitment moving',
        }),
        context => ({
            body: `${getCircleTitle(context)} is open for your Tap In.`,
            title: 'Tap In is ready',
        }),
        context => ({
            body: `A small Tap In now keeps ${getCircleTitle(context)} steady.`,
            title: 'Midday check-in',
        }),
        context => ({
            body: `${getCircleTitle(context)} has a Tap In waiting when you have a minute.`,
            title: 'Your circle is waiting',
        }),
        context => ({
            body: `Keep the rhythm alive in ${getCircleTitle(context)}.`,
            title: 'Time to Tap In',
        }),
    ],
};
function getNotificationCopyVariantIndex({ dedupeKey, type, variantCount, }) {
    if (variantCount <= 0) {
        return 0;
    }
    return hashString(`${type}:${dedupeKey}`) % variantCount;
}
function resolveNotificationCopy({ context = {}, dedupeKey, fallbackBody, fallbackTitle, type, }) {
    const templates = notificationCopyCatalog[type] ?? [];
    const variantIndex = getNotificationCopyVariantIndex({
        dedupeKey,
        type,
        variantCount: templates.length,
    });
    const resolved = templates[variantIndex]?.(context);
    return {
        body: resolved?.body ?? fallbackBody ?? '',
        copyVariant: `${type}_${variantIndex}`,
        title: resolved?.title ?? fallbackTitle ?? '',
    };
}
function getOneSignalConfig() {
    const appId = process.env.ONESIGNAL_APP_ID ??
        process.env.ONE_SIGNAL_APP_ID ??
        exports.oneSignalAppId.value();
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY ??
        process.env.ONE_SIGNAL_REST_API_KEY ??
        exports.oneSignalRestApiKey.value();
    return { appId, restApiKey };
}
function getLocalDateTimeParts(now, timezone) {
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
    const getPart = (type, fallback) => parts.find(part => part.type === type)?.value ?? fallback;
    const hourValue = getPart('hour', '00');
    return {
        dateKey: `${getPart('year', '1970')}-${getPart('month', '01')}-${getPart('day', '01')}`,
        hour: Number(hourValue === '24' ? '0' : hourValue),
        minute: Number(getPart('minute', '00')),
    };
}
function asDate(value) {
    if (value instanceof Date) {
        return value;
    }
    if (value &&
        typeof value === 'object' &&
        'toDate' in value &&
        typeof value.toDate === 'function') {
        const date = value.toDate();
        return date instanceof Date ? date : undefined;
    }
    return undefined;
}
function getRoutineNotificationEligibility({ deliveryState, now = new Date(), type, timezone, }) {
    const localDateKey = getLocalDateTimeParts(now, timezone).dateKey;
    const routineLastSentAt = asDate(deliveryState?.routineLastSentAt);
    const discoveryLastSentAt = asDate(deliveryState?.discoveryLastSentAt);
    const routineDateKey = typeof deliveryState?.routineDateKey === 'string'
        ? deliveryState.routineDateKey
        : undefined;
    const routineSentCount = typeof deliveryState?.routineSentCount === 'number' &&
        Number.isFinite(deliveryState.routineSentCount)
        ? deliveryState.routineSentCount
        : 0;
    if (routineLastSentAt &&
        now.getTime() - routineLastSentAt.getTime() < routineSpacingMs) {
        return { eligible: false, reason: 'routine-spacing' };
    }
    if (routineDateKey === localDateKey && routineSentCount >= routineDailyLimit) {
        return { eligible: false, reason: 'routine-daily-limit' };
    }
    if (type === 'circle_discovery_suggestion' &&
        discoveryLastSentAt &&
        now.getTime() - discoveryLastSentAt.getTime() < discoverySpacingMs) {
        return { eligible: false, reason: 'discovery-spacing' };
    }
    return { eligible: true, reason: 'eligible' };
}
function getDiscoveryInactivityEligibility({ lastTapInAt, now = new Date(), }) {
    const lastTapInDate = asDate(lastTapInAt);
    if (!lastTapInDate) {
        return { eligible: false, reason: 'missing-last-tap-in' };
    }
    if (now.getTime() - lastTapInDate.getTime() < discoveryInactivityMs) {
        return { eligible: false, reason: 'recent-tap-in' };
    }
    return { eligible: true, reason: 'eligible' };
}
function getCommitmentWeekDateKeys(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
    }).formatToParts(now);
    const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Mon';
    const dayOffsetByWeekday = {
        Fri: 4,
        Mon: 0,
        Sat: 5,
        Sun: 6,
        Thu: 3,
        Tue: 1,
        Wed: 2,
    };
    const localDate = new Date(Number(parts.find(part => part.type === 'year')?.value ?? '1970'), Number(parts.find(part => part.type === 'month')?.value ?? '1') - 1, Number(parts.find(part => part.type === 'day')?.value ?? '1'));
    const monday = new Date(localDate);
    monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return [
            String(date.getFullYear()),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');
    });
}
function getCommitmentMonthDateKeys(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(now);
    const year = Number(parts.find(part => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find(part => part.type === 'month')?.value ?? '1');
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: dayCount }, (_, index) => [
        String(year),
        String(month).padStart(2, '0'),
        String(index + 1).padStart(2, '0'),
    ].join('-'));
}
function getCommitmentPeriodDateKeys(commitmentCadence, timezone, now = new Date()) {
    if (commitmentCadence === 'daily') {
        return [getLocalDateTimeParts(now, timezone).dateKey];
    }
    if (commitmentCadence === 'monthly') {
        return getCommitmentMonthDateKeys(timezone, now);
    }
    return getCommitmentWeekDateKeys(timezone, now);
}
function buildActor(data) {
    if (!data) {
        return undefined;
    }
    return {
        avatarUrl: asOptionalString(data.avatarUrl) ?? null,
        displayName: asOptionalString(data.displayName) ??
            asOptionalString(data.name) ??
            asOptionalString(data.handle) ??
            null,
        handle: asOptionalString(data.handle) ?? null,
        uid: asOptionalString(data.uid) ?? null,
    };
}
function isPreferenceEnabled(notificationSettings, key) {
    const value = notificationSettings?.[key];
    if (typeof value === 'boolean') {
        return value;
    }
    if ((key === 'circleRisk' ||
        key === 'nudges' ||
        key === 'socialActivity') &&
        typeof notificationSettings?.circleActivity === 'boolean') {
        return notificationSettings.circleActivity;
    }
    if (key === 'discovery' &&
        typeof notificationSettings?.productUpdates === 'boolean') {
        return notificationSettings.productUpdates;
    }
    return defaultNotificationSettings[key];
}
function getNotificationPreferenceEnabled(notificationSettings, key) {
    return isPreferenceEnabled(notificationSettings, key);
}
function buildOneSignalPushPayload({ appId, body, circleId, eventId, pushData, title, type, uid, }) {
    return {
        app_id: appId,
        contents: { en: body },
        data: {
            ...(circleId ? { circleId } : {}),
            eventId,
            ...(pushData ?? {}),
            type,
        },
        headings: { en: title },
        include_aliases: {
            external_id: [uid],
        },
        ios_badgeCount: 1,
        ios_badgeType: 'Increase',
        target_channel: 'push',
    };
}
async function markUnreadInboxEventsRead(uid) {
    const snapshot = await firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('inbox')
        .where('readAt', '==', null)
        .get();
    if (snapshot.empty) {
        return 0;
    }
    let batch = firebase_1.db.batch();
    let pendingWrites = 0;
    let readCount = 0;
    const readAt = firestore_1.FieldValue.serverTimestamp();
    for (const doc of snapshot.docs) {
        batch.set(doc.ref, { readAt }, { merge: true });
        pendingWrites += 1;
        readCount += 1;
        if (pendingWrites === inboxReadBatchLimit) {
            await batch.commit();
            batch = firebase_1.db.batch();
            pendingWrites = 0;
        }
    }
    if (pendingWrites > 0) {
        await batch.commit();
    }
    return readCount;
}
async function sendPushToUser({ body, circleId, eventId, pushData, title, type, uid, }) {
    const { appId, restApiKey } = getOneSignalConfig();
    if (!appId || !restApiKey) {
        return { status: 'skipped' };
    }
    const response = await fetch('https://api.onesignal.com/notifications', {
        body: JSON.stringify(buildOneSignalPushPayload({
            appId,
            body,
            circleId,
            eventId,
            pushData,
            title,
            type,
            uid,
        })),
        headers: {
            Authorization: `Key ${restApiKey}`,
            'Content-Type': 'application/json',
        },
        method: 'POST',
    });
    const payload = (await response.json().catch(() => undefined));
    if (!response.ok || !payload?.id) {
        return {
            error: payload?.errors ?? response.statusText,
            status: 'failed',
        };
    }
    return { oneSignalId: payload.id, status: 'sent' };
}
async function recordRoutineNotificationDelivery({ now = new Date(), type, uid, timezone, }) {
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const snapshot = await userPrivateRef.get();
    const deliveryState = (snapshot.data()?.notificationDelivery ?? {});
    const localDateKey = getLocalDateTimeParts(now, timezone).dateKey;
    const priorDateKey = typeof deliveryState?.routineDateKey === 'string'
        ? deliveryState.routineDateKey
        : undefined;
    const priorCount = typeof deliveryState?.routineSentCount === 'number' &&
        Number.isFinite(deliveryState.routineSentCount)
        ? deliveryState.routineSentCount
        : 0;
    await userPrivateRef.set({
        notificationDelivery: {
            ...(type === 'circle_discovery_suggestion'
                ? { discoveryLastSentAt: firestore_1.FieldValue.serverTimestamp() }
                : {}),
            routineDateKey: localDateKey,
            routineLastSentAt: firestore_1.FieldValue.serverTimestamp(),
            routineSentCount: priorDateKey === localDateKey ? priorCount + 1 : 1,
        },
    }, { merge: true });
}
async function createInboxEvent({ actor, body, circleId, copyVariant, dedupeKey, deeplink, deliveryPriority = 'immediate', preferenceKey, pushData, routineTimezone = 'UTC', title, type, uid, }) {
    const eventId = sanitizeEventId(dedupeKey ?? `${type}_${circleId ?? 'general'}_${Date.now()}`);
    const eventRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('inbox')
        .doc(eventId);
    const existingSnapshot = await eventRef.get();
    if (existingSnapshot.exists) {
        return { created: false, eventId, pushStatus: 'skipped' };
    }
    const userPrivateSnapshot = await firebase_1.db.collection('userPrivate').doc(uid).get();
    const userPrivate = userPrivateSnapshot.data();
    const enabled = isPreferenceEnabled(userPrivate?.notificationSettings, preferenceKey);
    if (enabled && deliveryPriority === 'routine') {
        const routineEligibility = getRoutineNotificationEligibility({
            deliveryState: userPrivate?.notificationDelivery,
            type,
            timezone: routineTimezone,
        });
        if (!routineEligibility.eligible) {
            return { created: false, eventId, pushStatus: 'throttled' };
        }
    }
    await eventRef.set({
        actor: actor ?? null,
        body,
        circleId: circleId ?? null,
        copyVariant: copyVariant ?? null,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
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
        await eventRef.set({
            push: {
                status: 'disabled',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
        return { created: true, eventId, pushStatus: 'disabled' };
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
    await eventRef.set({
        push: {
            ...(pushResult.status === 'sent'
                ? { oneSignalId: pushResult.oneSignalId }
                : {}),
            ...(pushResult.status === 'failed'
                ? { error: JSON.stringify(pushResult.error) }
                : {}),
            status: pushResult.status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        },
    }, { merge: true });
    if (deliveryPriority === 'routine' && pushResult.status === 'sent') {
        await recordRoutineNotificationDelivery({
            type,
            uid,
            timezone: routineTimezone,
        }).catch(error => console.error('record_routine_notification_delivery_failed', error));
    }
    return { created: true, eventId, pushStatus: pushResult.status };
}
async function notifyOwnerJoinRequest({ circleId, circleTitle, ownerId, requestToken, requester, }) {
    const actor = buildActor(requester);
    const actorName = actor?.displayName ?? 'Someone';
    const dedupeKey = getJoinRequestNotificationDedupeKey({
        circleId,
        requesterId: actor?.uid,
        requestToken,
    });
    const copy = resolveNotificationCopy({
        context: { actorName, circleTitle },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        title: copy.title,
        type: 'join_request',
        uid: ownerId,
    });
}
async function notifyOwnerNewJoin({ circleId, circleTitle, joinedMember, ownerId, }) {
    const actor = buildActor(joinedMember);
    const actorName = actor?.displayName ?? 'Someone';
    const dedupeKey = `member_joined_${circleId}_${actor?.uid ?? 'unknown'}`;
    const copy = resolveNotificationCopy({
        context: { actorName, circleTitle },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        title: copy.title,
        type: 'member_joined',
        uid: ownerId,
    });
}
async function notifyJoinRequestReview({ approved, circleId, circleTitle, owner, requesterId, }) {
    const type = approved ? 'join_approved' : 'join_declined';
    const dedupeKey = `join_review_${circleId}_${requesterId}_${approved ? 'approved' : 'declined'}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        title: copy.title,
        type,
        uid: requesterId,
    });
}
async function notifyNudge({ actor, circleId, circleTitle, dateKey, targetUid, }) {
    const notificationActor = buildActor(actor);
    const actorName = notificationActor?.displayName ?? 'Someone';
    const dedupeKey = getNudgeNotificationDedupeKey({
        actorUid: notificationActor?.uid,
        circleId,
        dateKey,
        targetUid,
    });
    const copy = resolveNotificationCopy({
        context: { actorName, circleTitle },
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
        deeplink: { circleId, screen: 'TapInComposer', source: 'notification' },
        preferenceKey: 'nudges',
        title: copy.title,
        type: 'nudge',
        uid: targetUid,
    });
}
function getCircleAtRiskNotificationBody({ circleTitle, commitmentCadence, remainingCount, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
    return `${circleTitle} needs ${remainingCount} more Tap In${remainingCount === 1 ? '' : 's'} ${periodCopy}.`;
}
function getCommitmentPeriodCopy(commitmentCadence) {
    return commitmentCadence === 'daily'
        ? 'today'
        : commitmentCadence === 'monthly'
            ? 'this month'
            : 'this week';
}
async function notifyCompanionTappedIn({ actor, circleId, circleTitle, dateKey, targetUid, }) {
    const notificationActor = buildActor(actor);
    const actorName = notificationActor?.displayName ?? 'Someone';
    const dedupeKey = `companion_tapped_in_${circleId}_${dateKey}_${notificationActor?.uid ?? 'unknown'}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { actorName, circleTitle },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        title: copy.title,
        type: 'companion_tapped_in',
        uid: targetUid,
    });
}
async function notifyCircleComplete({ circleId, circleTitle, commitmentCadence, periodKey, targetUid, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
    const dedupeKey = `circle_complete_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, periodCopy },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        title: copy.title,
        type: 'circle_complete',
        uid: targetUid,
    });
}
async function notifyMemberDuePrompt({ circleId, circleTitle, commitmentCadence, periodKey, targetUid, timezone, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
    const dedupeKey = `member_due_prompt_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, periodCopy },
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
        deeplink: { circleId, screen: 'TapInComposer', source: 'notification' },
        deliveryPriority: 'routine',
        preferenceKey: 'tapInReminders',
        routineTimezone: timezone,
        title: copy.title,
        type: 'member_due_prompt',
        uid: targetUid,
    });
}
async function notifyCircleNudgePrompt({ circleId, circleTitle, periodKey, targetCount, targetUid, timezone, }) {
    const dedupeKey = `circle_nudge_prompt_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, targetCount },
        dedupeKey,
        fallbackBody: `${circleTitle} could use a nudge for ${targetCount} companion${targetCount === 1 ? '' : 's'}.`,
        fallbackTitle: 'Help the circle move',
        type: 'circle_nudge_prompt',
    });
    return createInboxEvent({
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey,
        deeplink: { circleId, screen: 'CircleDetail' },
        deliveryPriority: 'routine',
        preferenceKey: 'nudges',
        routineTimezone: timezone,
        title: copy.title,
        type: 'circle_nudge_prompt',
        uid: targetUid,
    });
}
async function notifyCircleDiscoverySuggestion({ category, circleId, circleTitle, dateKey, targetUid, timezone, }) {
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
    return createInboxEvent({
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey,
        deeplink: { circleId, screen: 'CircleDetail' },
        deliveryPriority: 'routine',
        preferenceKey: 'discovery',
        routineTimezone: timezone,
        title: copy.title,
        type: 'circle_discovery_suggestion',
        uid: targetUid,
    });
}
async function notifyCircleAtRisk({ commitmentCadence, circleId, circleTitle, periodKey, remainingCount, targetUid, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
    const dedupeKey = `circle_at_risk_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, periodCopy, remainingCount },
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
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'circleRisk',
        title: copy.title,
        type: 'circle_at_risk',
        uid: targetUid,
    });
}
function getReminderEligibility({ circleId, dateKey, kind, memberStatus, notificationSettings, remainingTapIns, todayStatus, uid, }) {
    if (!uid || !circleId || !dateKey) {
        return { eligible: false, reason: 'missing-input' };
    }
    if (memberStatus !== 'active') {
        return { eligible: false, reason: 'inactive-member' };
    }
    if (todayStatus === 'done' || todayStatus === 'skip') {
        return { eligible: false, reason: 'already-covered' };
    }
    if (typeof remainingTapIns === 'number' && remainingTapIns <= 0) {
        return { eligible: false, reason: 'frequency-complete' };
    }
    if (!isPreferenceEnabled(notificationSettings, 'tapInReminders')) {
        return { eligible: false, reason: 'preference-disabled' };
    }
    return {
        dedupeKey: `tap_in_${kind}_${circleId}_${dateKey}_${uid}`,
        eligible: true,
        reason: 'eligible',
    };
}
async function sendTapInReminders(kind) {
    const targetHour = kind === 'midday' ? 12 : 22;
    const now = new Date();
    const circleSnapshots = await firebase_1.db.collection('circles').get();
    const sendPromises = [];
    for (const circleSnapshot of circleSnapshots.docs) {
        const circle = circleSnapshot.data();
        const timezone = asString(circle.timezone, 'UTC');
        const local = getLocalDateTimeParts(now, timezone);
        const commitmentCadence = (0, commitments_1.getCommitmentCadence)(circle);
        const periodDateKeys = getCommitmentPeriodDateKeys(commitmentCadence, timezone, now);
        const requiredTapIns = (0, commitments_1.getRequiredTapIns)(circle);
        if (local.hour !== targetHour) {
            continue;
        }
        const [memberSnapshots, todayCheckInSnapshots, ...periodCheckInSnapshots] = await Promise.all([
            circleSnapshot.ref
                .collection('members')
                .where('status', '==', 'active')
                .get(),
            circleSnapshot.ref
                .collection('days')
                .doc(local.dateKey)
                .collection('checkIns')
                .get(),
            ...periodDateKeys.map(dateKey => circleSnapshot.ref
                .collection('days')
                .doc(dateKey)
                .collection('checkIns')
                .get()),
        ]);
        const checkInStatuses = new Map(todayCheckInSnapshots.docs.map(snapshot => {
            const data = snapshot.data();
            return [asString(data.uid, snapshot.id), data.status];
        }));
        const coveredCounts = new Map();
        const scoringSnapshots = commitmentCadence === 'daily'
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
            const userPrivateSnapshot = await firebase_1.db
                .collection('userPrivate')
                .doc(uid)
                .get();
            const userPrivate = userPrivateSnapshot.data();
            const eligibility = getReminderEligibility({
                circleId: circleSnapshot.id,
                dateKey: local.dateKey,
                kind,
                memberStatus: memberSnapshot.data().status,
                notificationSettings: userPrivate?.notificationSettings,
                remainingTapIns: Math.max(requiredTapIns - (coveredCounts.get(uid) ?? 0), 0),
                todayStatus: checkInStatuses.get(uid),
                uid,
            });
            if (!eligibility.eligible || !eligibility.dedupeKey) {
                continue;
            }
            const type = kind === 'midday'
                ? 'tap_in_midday_reminder'
                : 'tap_in_final_warning';
            const copy = resolveNotificationCopy({
                context: { circleTitle },
                dedupeKey: eligibility.dedupeKey,
                fallbackBody: kind === 'midday'
                    ? `Tap In to keep ${circleTitle} Progression moving.`
                    : `2 hours left to Tap In for ${circleTitle}.`,
                fallbackTitle: kind === 'midday' ? 'Keep your Commitment moving' : '2 hours left',
                type,
            });
            sendPromises.push(createInboxEvent({
                body: copy.body,
                circleId: circleSnapshot.id,
                copyVariant: copy.copyVariant,
                dedupeKey: eligibility.dedupeKey,
                deeplink: {
                    circleId: circleSnapshot.id,
                    screen: 'TapInComposer',
                    source: 'notification',
                },
                deliveryPriority: kind === 'midday' ? 'routine' : 'immediate',
                preferenceKey: 'tapInReminders',
                routineTimezone: timezone,
                title: copy.title,
                type,
                uid,
            }));
        }
    }
    await Promise.all(sendPromises);
    return { sentOrSkipped: sendPromises.length };
}
function getPeriodKey({ commitmentCadence, dateKey, periodDateKeys, }) {
    return commitmentCadence === 'daily'
        ? dateKey
        : periodDateKeys[0] ?? dateKey;
}
async function sendCircleEngagementPrompts() {
    const targetHour = 18;
    const now = new Date();
    const circleSnapshots = await firebase_1.db.collection('circles').get();
    const sendPromises = [];
    for (const circleSnapshot of circleSnapshots.docs) {
        const circle = circleSnapshot.data();
        const timezone = asString(circle.timezone, 'UTC');
        const local = getLocalDateTimeParts(now, timezone);
        if (local.hour !== targetHour) {
            continue;
        }
        const commitmentCadence = (0, commitments_1.getCommitmentCadence)(circle);
        const periodDateKeys = getCommitmentPeriodDateKeys(commitmentCadence, timezone, now);
        const requiredTapIns = (0, commitments_1.getRequiredTapIns)(circle);
        const [memberSnapshots, ...periodCheckInSnapshots] = await Promise.all([
            circleSnapshot.ref
                .collection('members')
                .where('status', '==', 'active')
                .get(),
            ...periodDateKeys.map(dateKey => circleSnapshot.ref
                .collection('days')
                .doc(dateKey)
                .collection('checkIns')
                .get()),
        ]);
        const coveredCounts = new Map();
        periodCheckInSnapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
                if (doc.data().status === 'done' || doc.data().status === 'skip') {
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
            .filter((member) => Boolean(member.uid));
        const behindMembers = members.filter(member => (coveredCounts.get(member.uid) ?? 0) < requiredTapIns);
        const engagedMembers = members.filter(member => (coveredCounts.get(member.uid) ?? 0) >= requiredTapIns);
        if (behindMembers.length === 0) {
            continue;
        }
        const circleTitle = asString(circle.title, 'Your circle');
        const periodKey = getPeriodKey({
            commitmentCadence,
            dateKey: local.dateKey,
            periodDateKeys,
        });
        behindMembers.forEach(member => {
            sendPromises.push(notifyMemberDuePrompt({
                circleId: circleSnapshot.id,
                circleTitle,
                commitmentCadence,
                periodKey,
                targetUid: member.uid,
                timezone,
            }));
        });
        engagedMembers.forEach(member => {
            sendPromises.push(notifyCircleNudgePrompt({
                circleId: circleSnapshot.id,
                circleTitle,
                periodKey,
                targetCount: behindMembers.length,
                targetUid: member.uid,
                timezone,
            }));
        });
    }
    await Promise.all(sendPromises);
    return { sentOrSkipped: sendPromises.length };
}
async function getEligibleDiscoveryCircleForUser({ publicCircleSnapshots, uid, }) {
    for (const circleSnapshot of publicCircleSnapshots.docs) {
        const circle = circleSnapshot.data();
        const memberCount = typeof circle.memberCount === 'number' && Number.isFinite(circle.memberCount)
            ? circle.memberCount
            : 0;
        const maxSize = typeof circle.maxSize === 'number' && Number.isFinite(circle.maxSize)
            ? circle.maxSize
            : 0;
        if (maxSize > 0 && memberCount >= maxSize) {
            continue;
        }
        const memberSnapshot = await firebase_1.db
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
        firebase_1.db.collection('userPrivate').get(),
        firebase_1.db
            .collection('publicCircleIndex')
            .orderBy('updatedAt', 'desc')
            .limit(25)
            .get(),
    ]);
    const sendPromises = [];
    if (publicCircleSnapshots.empty) {
        return { sentOrSkipped: 0 };
    }
    for (const userPrivateSnapshot of userPrivateSnapshots.docs) {
        const uid = userPrivateSnapshot.id;
        const userPrivate = userPrivateSnapshot.data();
        const notificationSettings = userPrivate.notificationSettings;
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
        const circle = await getEligibleDiscoveryCircleForUser({
            publicCircleSnapshots,
            uid,
        });
        if (!circle) {
            continue;
        }
        sendPromises.push(notifyCircleDiscoverySuggestion({
            category: circle.category,
            circleId: circle.circleId,
            circleTitle: circle.title,
            dateKey: getLocalDateTimeParts(now, 'UTC').dateKey,
            targetUid: uid,
            timezone: 'UTC',
        }));
    }
    await Promise.all(sendPromises);
    return { sentOrSkipped: sendPromises.length };
}
exports.sendMiddayTapInReminders = (0, scheduler_1.onSchedule)({ schedule: '0 * * * *', secrets: [exports.oneSignalRestApiKey] }, async () => {
    await sendTapInReminders('midday');
});
exports.sendFinalTapInWarnings = (0, scheduler_1.onSchedule)({ schedule: '0 * * * *', secrets: [exports.oneSignalRestApiKey] }, async () => {
    await sendTapInReminders('final');
});
exports.sendRoutineEngagementNotifications = (0, scheduler_1.onSchedule)({ schedule: '15 * * * *', secrets: [exports.oneSignalRestApiKey] }, async () => {
    await sendCircleEngagementPrompts();
    await sendCircleDiscoverySuggestions();
});
exports.updateNotificationSettings = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const input = updateNotificationSettingsSchema.parse(request.data);
    const uid = request.auth.uid;
    await firebase_1.db.collection('userPrivate').doc(uid).set({
        notificationSettings: input.notificationSettings,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { notificationSettings: input.notificationSettings };
});
exports.markInboxEventRead = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const input = markInboxEventReadSchema.parse(request.data);
    await firebase_1.db
        .collection('userPrivate')
        .doc(request.auth.uid)
        .collection('inbox')
        .doc(input.eventId)
        .set({ readAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return { read: true };
});
exports.markInboxEventsRead = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const read = await markUnreadInboxEventsRead(request.auth.uid);
    return { read };
});
exports.notificationModules = {
    createInboxEvent: 'active',
    markInboxEventsRead: 'active',
    sendFinalTapInWarnings: 'active',
    sendMiddayTapInReminders: 'active',
    sendRoutineEngagementNotifications: 'active',
};
