"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationModules = exports.markInboxEventsRead = exports.markInboxEventRead = exports.updateNotificationSettings = exports.repairPushSubscription = exports.sendEveningActivityRecaps = exports.sendRoutineEngagementNotifications = exports.sendFinalTapInWarnings = exports.sendMiddayTapInReminders = exports.oneSignalAppId = exports.oneSignalRestApiKey = void 0;
exports.getJoinRequestNotificationDedupeKey = getJoinRequestNotificationDedupeKey;
exports.getNudgeNotificationDedupeKey = getNudgeNotificationDedupeKey;
exports.canShareCircleOutsideMembers = canShareCircleOutsideMembers;
exports.getCompanionFeedTargetsFromMemberships = getCompanionFeedTargetsFromMemberships;
exports.getCompanionMilestoneEvents = getCompanionMilestoneEvents;
exports.formatNotificationCircleTitle = formatNotificationCircleTitle;
exports.getNotificationCopyVariantIndex = getNotificationCopyVariantIndex;
exports.resolveNotificationCopy = resolveNotificationCopy;
exports.getRoutineNotificationEligibility = getRoutineNotificationEligibility;
exports.getDiscoveryInactivityEligibility = getDiscoveryInactivityEligibility;
exports.getSameDayImmediateCoverageCircleIds = getSameDayImmediateCoverageCircleIds;
exports.shouldIncludeInEveningSummary = shouldIncludeInEveningSummary;
exports.buildEveningSummaryCopy = buildEveningSummaryCopy;
exports.resolveCompanionFeedTargets = resolveCompanionFeedTargets;
exports.getNotificationPreferenceEnabled = getNotificationPreferenceEnabled;
exports.buildOneSignalPushPayload = buildOneSignalPushPayload;
exports.markUnreadInboxEventsRead = markUnreadInboxEventsRead;
exports.createInboxEvent = createInboxEvent;
exports.notifyOwnerJoinRequest = notifyOwnerJoinRequest;
exports.notifyOwnerNewJoin = notifyOwnerNewJoin;
exports.notifyJoinRequestReview = notifyJoinRequestReview;
exports.notifyNudge = notifyNudge;
exports.notifyCompanionSkipped = notifyCompanionSkipped;
exports.notifyCompanionCircleCreated = notifyCompanionCircleCreated;
exports.notifyCompanionCircleJoined = notifyCompanionCircleJoined;
exports.notifyCompanionMilestones = notifyCompanionMilestones;
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
const repairPushSubscriptionSchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().trim().min(1).max(160),
    token: zod_1.z.string().trim().min(1).max(512),
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
const eveningSummaryHour = 19;
const maxPushCircleTitleLength = 22;
const companionAchievementCatalog = [
    { key: '7-days-straight', threshold: 7, title: '7 Days Straight' },
    { key: '10-day-streak', threshold: 10, title: '10 Day Streak' },
    { key: '20-day-streak', threshold: 20, title: '20 Day Streak' },
    { key: '30-day-streak', threshold: 30, title: '30 Day Streak' },
    { key: '50-taps', threshold: 50, title: '50 Taps' },
];
const milestoneStatuses = [
    'getting_started',
    'building_momentum',
    'strong_momentum',
    'peak_momentum',
];
const eveningSummaryEventTypes = new Set([
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
const sameDayImmediateCoverageTypes = new Set([
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
function asNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function normalizeMomentumStatus(value) {
    return value === 'getting_started' ||
        value === 'building_momentum' ||
        value === 'strong_momentum' ||
        value === 'peak_momentum'
        ? value
        : undefined;
}
function getMomentumStatusLabel(status) {
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
function getMomentumStatusRank(status) {
    return status ? milestoneStatuses.indexOf(status) : -1;
}
function canShareCircleOutsideMembers(circle) {
    return circle?.privacy === 'public' && circle?.joinMode !== 'invite_only';
}
function getCompanionFeedTargetsFromMemberships({ actorUid, sharedMemberUids, sourceCircle, sourceMemberUids, }) {
    const targets = new Map();
    const sourceMemberUidSet = new Set(sourceMemberUids.filter(Boolean));
    const canShareOutsideMembers = canShareCircleOutsideMembers(sourceCircle);
    sourceMemberUidSet.forEach(uid => {
        if (uid && uid !== actorUid) {
            targets.set(uid, { canViewMedia: true, uid });
        }
    });
    if (canShareOutsideMembers) {
        sharedMemberUids.forEach(uid => {
            if (uid && uid !== actorUid && !targets.has(uid)) {
                targets.set(uid, { canViewMedia: true, uid });
            }
        });
    }
    return Array.from(targets.values());
}
function getStreakMilestonesCrossed({ currentStreak, priorStreak, }) {
    const fixedMilestones = [3, 7, 14, 30];
    const recurringMilestones = currentStreak > 30
        ? Array.from({ length: Math.floor(currentStreak / 30) - 1 }, (_, index) => (index + 2) * 30)
        : [];
    return [...fixedMilestones, ...recurringMilestones].filter(milestone => priorStreak < milestone && currentStreak >= milestone);
}
function getCompanionMilestoneEvents({ priorSummary, summary, }) {
    const priorBestStreak = asNumber(priorSummary?.bestStreak, 0);
    const bestStreak = asNumber(summary.bestStreak, 0);
    const priorCurrentStreak = asNumber(priorSummary?.currentStreak, 0);
    const currentStreak = asNumber(summary.currentStreak, 0);
    const priorStatus = normalizeMomentumStatus(priorSummary?.status);
    const status = normalizeMomentumStatus(summary.status);
    const events = [];
    companionAchievementCatalog.forEach(achievement => {
        if (priorBestStreak < achievement.threshold &&
            bestStreak >= achievement.threshold) {
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
    if (status &&
        getMomentumStatusRank(status) > getMomentumStatusRank(priorStatus)) {
        events.push({
            key: status,
            momentumLabel: asOptionalString(summary.label) ?? getMomentumStatusLabel(status),
            type: 'companion_momentum_level_up',
        });
    }
    return events;
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
function formatNotificationCircleTitle(value) {
    const title = asString(value, 'your circle');
    const truncated = title.length > maxPushCircleTitleLength
        ? `${title.slice(0, maxPushCircleTitleLength - 3).trimEnd()}...`
        : title;
    return `"${truncated}"`;
}
function getCircleTitle(context) {
    return formatNotificationCircleTitle(context.circleTitle ?? context.discoveryCircleTitle);
}
function getActorName(context) {
    return context.actorName ?? 'Someone';
}
function getPeriodCopy(context) {
    return context.periodCopy ?? 'this period';
}
function getAchievementTitle(context) {
    return context.achievementTitle ?? 'a new achievement';
}
function getMomentumLabelCopy(context) {
    return context.momentumLabel ?? 'a new momentum level';
}
function getStreakDaysCopy(context) {
    const streakDays = Math.max(1, Math.round(context.streakDays ?? 1));
    return `${streakDays}-day streak`;
}
const notificationCopyCatalog = {
    circle_at_risk: context => ({
        body: `${getCircleTitle(context)} needs ${getTapInCountLabel(context.remainingCount)} ${getPeriodCopy(context)}.`,
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
        body: `Nudge ${context.targetCount ?? 1} companion${(context.targetCount ?? 1) === 1 ? '' : 's'} in ${getCircleTitle(context)}.`,
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
        body: `${getActorName(context)} reached ${getMomentumLabelCopy(context)} momentum.`,
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
        body: `${getActorName(context)} requested to join ${getCircleTitle(context)}.`,
        title: 'Join request',
    }),
    member_due_prompt: context => ({
        body: `Tap In still needed for ${getCircleTitle(context)} ${getPeriodCopy(context)}.`,
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
function getNotificationCopyVariantIndex({ dedupeKey, type, variantCount, }) {
    if (variantCount <= 0) {
        return 0;
    }
    return hashString(`${type}:${dedupeKey}`) % variantCount;
}
function resolveNotificationCopy({ context = {}, fallbackBody, fallbackTitle, type, }) {
    const resolved = notificationCopyCatalog[type]?.(context);
    return {
        body: resolved?.body ?? fallbackBody ?? '',
        copyVariant: type,
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
function getOneSignalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function getOneSignalNumber(value) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
}
function getSubscriptionId(subscription) {
    return getOneSignalString(subscription.id);
}
function getSubscriptionToken(subscription) {
    return getOneSignalString(subscription.token);
}
function getSubscriptionType(subscription) {
    return getOneSignalString(subscription.type);
}
function getSubscriptionEnabled(subscription) {
    return typeof subscription.enabled === 'boolean'
        ? subscription.enabled
        : undefined;
}
function getSubscriptionNotificationTypes(subscription) {
    return (getOneSignalNumber(subscription.notification_types) ??
        getOneSignalNumber(subscription.notificationTypes));
}
function getSubscriptionAppVersion(subscription) {
    return (getOneSignalString(subscription.app_version) ??
        getOneSignalString(subscription.appVersion));
}
function getSubscriptionDeviceOs(subscription) {
    return (getOneSignalString(subscription.device_os) ??
        getOneSignalString(subscription.deviceOs));
}
function getSubscriptionSdk(subscription) {
    return getOneSignalString(subscription.sdk);
}
async function fetchOneSignalUserByExternalId({ appId, restApiKey, uid, }) {
    const response = await fetch(`https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(uid)}`, {
        headers: {
            Authorization: `Key ${restApiKey}`,
            'Content-Type': 'application/json',
        },
        method: 'GET',
    });
    const payload = (await response.json().catch(() => undefined));
    return { payload, response };
}
async function patchOneSignalSubscription({ appId, restApiKey, subscription, subscriptionId, token, }) {
    const appVersion = getSubscriptionAppVersion(subscription);
    const deviceOs = getSubscriptionDeviceOs(subscription);
    const sdk = getSubscriptionSdk(subscription);
    const payload = {
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
    const response = await fetch(`https://api.onesignal.com/apps/${encodeURIComponent(appId)}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        body: JSON.stringify({ subscription: payload }),
        headers: {
            Authorization: `Key ${restApiKey}`,
            'Content-Type': 'application/json',
        },
        method: 'PATCH',
    });
    const responsePayload = (await response.json().catch(() => undefined));
    return { payload: responsePayload, response };
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
    if (routineDateKey === localDateKey &&
        routineSentCount >= routineDailyLimit) {
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
function getCandidatePushStatus(candidate) {
    const push = candidate.push && typeof candidate.push === 'object'
        ? candidate.push
        : {};
    return typeof push.status === 'string' ? push.status : undefined;
}
function getCandidateNotificationType(candidate) {
    return typeof candidate.type === 'string' &&
        Object.prototype.hasOwnProperty.call(notificationCopyCatalog, candidate.type)
        ? candidate.type
        : undefined;
}
function getCandidateCircleId(candidate) {
    return typeof candidate.circleId === 'string' &&
        candidate.circleId.trim().length > 0
        ? candidate.circleId.trim()
        : undefined;
}
function isCandidateOnLocalDate({ candidate, dateKey, timezone, }) {
    const createdAt = asDate(candidate.createdAt);
    if (!createdAt) {
        return false;
    }
    return getLocalDateTimeParts(createdAt, timezone).dateKey === dateKey;
}
function getSameDayImmediateCoverageCircleIds({ dateKey, events, timezone, }) {
    const coveredCircleIds = new Set();
    events.forEach(event => {
        const type = getCandidateNotificationType(event);
        const circleId = getCandidateCircleId(event);
        if (type &&
            circleId &&
            sameDayImmediateCoverageTypes.has(type) &&
            getCandidatePushStatus(event) === 'sent' &&
            isCandidateOnLocalDate({ candidate: event, dateKey, timezone })) {
            coveredCircleIds.add(circleId);
        }
    });
    return coveredCircleIds;
}
function shouldIncludeInEveningSummary({ coveredCircleIds, dateKey, event, timezone, }) {
    const type = getCandidateNotificationType(event);
    const circleId = getCandidateCircleId(event);
    if (!type ||
        !eveningSummaryEventTypes.has(type) ||
        getCandidatePushStatus(event) !== 'deferred' ||
        !isCandidateOnLocalDate({ candidate: event, dateKey, timezone })) {
        return false;
    }
    return !circleId || !coveredCircleIds.has(circleId);
}
function getEveningSummaryBucket(type) {
    if (type === 'companion_tapped_in') {
        return { plural: 'Tap Ins', singular: 'Tap In' };
    }
    if (type === 'circle_complete') {
        return { plural: 'completions', singular: 'completion' };
    }
    if (type === 'companion_skipped') {
        return { plural: 'skips', singular: 'skip' };
    }
    if (type === 'companion_circle_created') {
        return { plural: 'new circles', singular: 'new circle' };
    }
    if (type === 'companion_circle_joined' || type === 'member_joined') {
        return { plural: 'joins', singular: 'join' };
    }
    if (type === 'companion_achievement_unlocked' ||
        type === 'companion_momentum_level_up' ||
        type === 'companion_streak_milestone') {
        return { plural: 'milestones', singular: 'milestone' };
    }
    if (type === 'circle_discovery_suggestion') {
        return { plural: 'suggestions', singular: 'suggestion' };
    }
    return { plural: 'updates', singular: 'update' };
}
function buildEveningSummaryCopy(events) {
    const counts = new Map();
    const circleIds = new Set();
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
        .map(bucket => bucket.count === 1
        ? `1 ${bucket.singular}`
        : `${bucket.count} ${bucket.plural}`);
    const circleCopy = circleIds.size > 0
        ? ` across ${circleIds.size} circle${circleIds.size === 1 ? '' : 's'}`
        : '';
    const body = total === 1
        ? `1 update${circleCopy}: ${topParts[0] ?? 'activity'}.`
        : `${total} updates${circleCopy}: ${topParts.join(', ')}.`;
    return {
        body,
        title: 'Hoyst evening recap',
    };
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
async function getActiveCircleMemberUids(circleId) {
    const snapshot = await firebase_1.db
        .collection('circles')
        .doc(circleId)
        .collection('members')
        .where('status', '==', 'active')
        .get();
    return snapshot.docs
        .map(doc => asOptionalString(doc.data().uid) ?? doc.id)
        .filter(Boolean);
}
async function getActorActiveCircleIds(actorUid) {
    const snapshot = await firebase_1.db
        .collectionGroup('members')
        .where('uid', '==', actorUid)
        .get();
    return snapshot.docs
        .filter(doc => doc.data().status === 'active')
        .map(doc => doc.ref.parent.parent?.id)
        .filter((circleId) => Boolean(circleId));
}
async function resolveCompanionFeedTargets({ actorUid, circle, circleId, }) {
    const sourceMemberUids = await getActiveCircleMemberUids(circleId);
    const sharedMemberUids = canShareCircleOutsideMembers(circle)
        ? (await Promise.all(Array.from(new Set(await getActorActiveCircleIds(actorUid))).map(activeCircleId => getActiveCircleMemberUids(activeCircleId)))).flat()
        : [];
    return getCompanionFeedTargetsFromMemberships({
        actorUid,
        sharedMemberUids,
        sourceCircle: circle,
        sourceMemberUids,
    });
}
function isPreferenceEnabled(notificationSettings, key) {
    const value = notificationSettings?.[key];
    if (typeof value === 'boolean') {
        return value;
    }
    if ((key === 'circleRisk' || key === 'nudges' || key === 'socialActivity') &&
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
async function createInboxEvent({ actor, body, circleId, copyVariant, dedupeKey, deeplink, deliveryPriority = 'immediate', feedCategory, mediaImageUrl, preferenceKey, pushData, routineTimezone = 'UTC', title, type, uid, }) {
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
    const pushStatus = enabled
        ? deliveryPriority === 'deferred' || deliveryPriority === 'suppressed'
            ? deliveryPriority
            : 'pending'
        : 'disabled';
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
        feedCategory: feedCategory ?? null,
        mediaImageUrl: mediaImageUrl ?? null,
        preferenceKey,
        push: {
            status: pushStatus,
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
    if (deliveryPriority === 'deferred') {
        return { created: true, eventId, pushStatus: 'deferred' };
    }
    if (deliveryPriority === 'suppressed') {
        return { created: true, eventId, pushStatus: 'suppressed' };
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
        deliveryPriority: 'deferred',
        feedCategory: 'companion',
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
        feedCategory: 'companion',
        preferenceKey: 'nudges',
        title: copy.title,
        type: 'nudge',
        uid: targetUid,
    });
}
async function notifyCompanionFeedEvent({ actor, circle, circleId, context, dateKey, dedupeSubject, excludedUids = [], fallbackBody, fallbackTitle, mediaImageUrl, type, }) {
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
    return Promise.all(targets
        .filter(target => !excludedUidSet.has(target.uid))
        .map(target => {
        const targetMediaImageUrl = target.canViewMedia
            ? asOptionalString(mediaImageUrl)
            : undefined;
        const dedupeKey = `${type}_${circleId}_${dateKey}_${actorUid}_${dedupeSubject}_${target.uid}`;
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
            deeplink: { circleId, screen: 'CircleDetail' },
            deliveryPriority: 'deferred',
            feedCategory: 'companion',
            mediaImageUrl: targetMediaImageUrl,
            preferenceKey: 'socialActivity',
            pushData: {
                feedCategory: 'companion',
                ...(targetMediaImageUrl ? { hasMedia: 'true' } : {}),
            },
            title: copy.title,
            type,
            uid: target.uid,
        });
    }));
}
async function notifyCompanionSkipped({ actor, circle, circleId, circleTitle, dateKey, }) {
    const actorName = actor.displayName ?? 'Someone';
    return notifyCompanionFeedEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'skip',
        fallbackBody: `${actorName} used a skip for ${circleTitle}.`,
        fallbackTitle: 'A companion used a skip',
        type: 'companion_skipped',
    });
}
async function notifyCompanionCircleCreated({ actor, circle, circleId, circleTitle, dateKey, }) {
    if (!canShareCircleOutsideMembers(circle)) {
        return [];
    }
    const actorName = actor.displayName ?? 'Someone';
    return notifyCompanionFeedEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'created',
        fallbackBody: `${actorName} created ${circleTitle}.`,
        fallbackTitle: 'New circle created',
        type: 'companion_circle_created',
    });
}
async function notifyCompanionCircleJoined({ actor, circle, circleId, circleTitle, dateKey, excludedUids, }) {
    const actorName = actor.displayName ?? 'Someone';
    return notifyCompanionFeedEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'joined',
        excludedUids,
        fallbackBody: `${actorName} joined ${circleTitle}.`,
        fallbackTitle: 'A companion joined',
        type: 'companion_circle_joined',
    });
}
function getCompanionMilestoneContext(event, actorName) {
    if (event.type === 'companion_achievement_unlocked') {
        return { achievementTitle: event.achievementTitle, actorName };
    }
    if (event.type === 'companion_momentum_level_up') {
        return { actorName, momentumLabel: event.momentumLabel };
    }
    return { actorName, streakDays: event.streakDays };
}
function getCompanionMilestoneFallback({ actorName, event, }) {
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
async function notifyCompanionMilestones({ actor, circle, circleId, dateKey, events, targetUid, }) {
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
        const fallback = getCompanionMilestoneFallback({ actorName, event });
        return targets.map(target => {
            const dedupeKey = `${event.type}_${circleId}_${dateKey}_${actorUid}_${event.key}_${target.uid}`;
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
                deeplink: { circleId, screen: 'CircleDetail' },
                deliveryPriority: 'deferred',
                feedCategory: 'companion',
                preferenceKey: 'socialActivity',
                pushData: { feedCategory: 'companion' },
                title: copy.title,
                type: event.type,
                uid: target.uid,
            });
        });
    });
    const selfSends = events.map(event => {
        const context = getCompanionMilestoneContext(event, 'You');
        const fallback = getCompanionMilestoneFallback({ actorName: 'You', event });
        const dedupeKey = `self_${event.type}_${dateKey}_${actorUid}_${event.key}`;
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
            deeplink: { circleId, screen: 'CircleDetail' },
            deliveryPriority: 'suppressed',
            preferenceKey: 'socialActivity',
            title: copy.title,
            type: event.type,
            uid: targetUid,
        });
    });
    return Promise.all([...companionSends, ...selfSends]);
}
function getCircleAtRiskNotificationBody({ circleTitle, commitmentCadence, remainingCount, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentCadence);
    return `${formatNotificationCircleTitle(circleTitle)} needs ${remainingCount} more Tap In${remainingCount === 1 ? '' : 's'} ${periodCopy}.`;
}
function getCommitmentPeriodCopy(commitmentCadence) {
    return commitmentCadence === 'daily'
        ? 'today'
        : commitmentCadence === 'monthly'
            ? 'this month'
            : 'this week';
}
async function notifyCompanionTappedIn({ actor, circleId, circleTitle, dateKey, mediaImageUrl, targetUid, }) {
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
        deliveryPriority: 'deferred',
        feedCategory: 'companion',
        mediaImageUrl,
        preferenceKey: 'socialActivity',
        pushData: {
            feedCategory: 'companion',
            ...(mediaImageUrl ? { hasMedia: 'true' } : {}),
        },
        title: copy.title,
        type: 'companion_tapped_in',
        uid: targetUid,
    });
}
async function notifyCircleComplete({ actorUid, circleId, circleTitle, commitmentCadence, periodKey, targetUid, }) {
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
        deliveryPriority: actorUid === targetUid ? 'suppressed' : 'deferred',
        feedCategory: 'companion',
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
    const result = await createInboxEvent({
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey,
        deeplink: { circleId, screen: 'CircleDetail' },
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
        }).catch(error => console.error('record_discovery_notification_delivery_failed', error));
    }
    return result;
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
            const type = kind === 'midday' ? 'tap_in_midday_reminder' : 'tap_in_final_warning';
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
    return commitmentCadence === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
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
        const memberCount = typeof circle.memberCount === 'number' &&
            Number.isFinite(circle.memberCount)
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
        const deliveryEligibility = getRoutineNotificationEligibility({
            deliveryState: userPrivate.notificationDelivery,
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
async function sendEveningActivitySummaries() {
    const now = new Date();
    const userPrivateSnapshots = await firebase_1.db.collection('userPrivate').get();
    let sentOrSkipped = 0;
    for (const userPrivateSnapshot of userPrivateSnapshots.docs) {
        const uid = userPrivateSnapshot.id;
        const userPrivate = userPrivateSnapshot.data();
        const userSnapshot = await firebase_1.db.collection('users').doc(uid).get();
        const timezone = asString(userPrivate.timezone, asString(userSnapshot.data()?.timezone, 'UTC'));
        const local = getLocalDateTimeParts(now, timezone);
        const deliveryState = (userPrivate.notificationDelivery ?? {});
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
        const includedDocs = deferredSnapshot.docs.filter(doc => shouldIncludeInEveningSummary({
            coveredCircleIds,
            dateKey: local.dateKey,
            event: doc.data(),
            timezone,
        }));
        const coveredDocs = deferredSnapshot.docs.filter(doc => {
            const data = doc.data();
            const circleId = getCandidateCircleId(data);
            return (circleId &&
                coveredCircleIds.has(circleId) &&
                getCandidatePushStatus(data) === 'deferred' &&
                isCandidateOnLocalDate({
                    candidate: data,
                    dateKey: local.dateKey,
                    timezone,
                }));
        });
        if (includedDocs.length === 0 && coveredDocs.length === 0) {
            continue;
        }
        const summary = buildEveningSummaryCopy(includedDocs.map(doc => doc.data()));
        const dedupeKey = `evening_summary_${uid}_${local.dateKey}`;
        const summaryResult = includedDocs.length > 0
            ? await createInboxEvent({
                body: summary.body,
                copyVariant: 'evening_summary',
                dedupeKey,
                deeplink: { screen: 'Inbox' },
                preferenceKey: 'socialActivity',
                title: summary.title,
                type: 'evening_summary',
                uid,
            })
            : undefined;
        let batch = firebase_1.db.batch();
        let pendingWrites = 0;
        const markDoc = async (doc, status) => {
            batch.set(doc.ref, {
                push: {
                    ...(status === 'summarized' && summaryResult
                        ? { summaryEventId: summaryResult.eventId }
                        : {}),
                    status,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
            pendingWrites += 1;
            if (pendingWrites === inboxReadBatchLimit) {
                await batch.commit();
                batch = firebase_1.db.batch();
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
        await userPrivateSnapshot.ref.set({
            notificationDelivery: {
                eveningSummaryDateKey: local.dateKey,
                eveningSummaryLastSentAt: firestore_1.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
        sentOrSkipped += summaryResult ? 1 : 0;
    }
    return { sentOrSkipped };
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
exports.sendEveningActivityRecaps = (0, scheduler_1.onSchedule)({ schedule: '30 * * * *', secrets: [exports.oneSignalRestApiKey] }, async () => {
    await sendEveningActivitySummaries();
});
exports.repairPushSubscription = (0, https_1.onCall)({ secrets: [exports.oneSignalRestApiKey] }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const input = repairPushSubscriptionSchema.parse(request.data);
    const uid = request.auth.uid;
    const { appId, restApiKey } = getOneSignalConfig();
    if (!appId || !restApiKey) {
        throw new https_1.HttpsError('failed-precondition', 'OneSignal is not configured.');
    }
    let userResult;
    try {
        userResult = await fetchOneSignalUserByExternalId({
            appId,
            restApiKey,
            uid,
        });
    }
    catch (error) {
        console.error('onesignal_user_fetch_request_failed', error);
        throw new https_1.HttpsError('internal', 'Could not load push subscription state.');
    }
    if (!userResult.response.ok) {
        console.error('onesignal_user_fetch_failed', {
            errors: userResult.payload,
            status: userResult.response.status,
        });
        throw new https_1.HttpsError(userResult.response.status === 404 ? 'not-found' : 'internal', 'Could not load push subscription state.');
    }
    const subscription = (userResult.payload?.subscriptions ?? []).find(candidate => getSubscriptionId(candidate) === input.subscriptionId);
    if (!subscription) {
        throw new https_1.HttpsError('permission-denied', 'Push subscription is not linked to this user.');
    }
    const subscriptionType = getSubscriptionType(subscription);
    if (subscriptionType && subscriptionType !== 'iOSPush') {
        throw new https_1.HttpsError('failed-precondition', 'Push subscription is not an iOS push subscription.');
    }
    const remoteToken = getSubscriptionToken(subscription);
    if (remoteToken && remoteToken !== input.token) {
        throw new https_1.HttpsError('permission-denied', 'Push subscription token does not match this device.');
    }
    const enabled = getSubscriptionEnabled(subscription);
    const notificationTypes = getSubscriptionNotificationTypes(subscription);
    if (enabled && (notificationTypes === undefined || notificationTypes > 0)) {
        return { repaired: false, status: 'already-enabled' };
    }
    let repairResult;
    try {
        repairResult = await patchOneSignalSubscription({
            appId,
            restApiKey,
            subscription,
            subscriptionId: input.subscriptionId,
            token: input.token,
        });
    }
    catch (error) {
        console.error('onesignal_subscription_repair_request_failed', error);
        throw new https_1.HttpsError('internal', 'Could not repair push subscription.');
    }
    if (!repairResult.response.ok) {
        console.error('onesignal_subscription_repair_failed', {
            errors: repairResult.payload?.errors,
            status: repairResult.response.status,
        });
        throw new https_1.HttpsError('internal', 'Could not repair push subscription.');
    }
    return { repaired: true, status: 'repaired' };
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
    sendEveningActivityRecaps: 'active',
    markInboxEventsRead: 'active',
    repairPushSubscription: 'active',
    sendFinalTapInWarnings: 'active',
    sendMiddayTapInReminders: 'active',
    sendRoutineEngagementNotifications: 'active',
};
