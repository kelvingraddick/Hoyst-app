"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationModules = exports.markInboxEventsRead = exports.markInboxEventRead = exports.updateNotificationSettings = exports.repairPushSubscription = exports.sendEveningActivityRecaps = exports.sendRoutineEngagementNotifications = exports.sendFinalTapInWarnings = exports.sendMiddayTapInReminders = exports.oneSignalAppId = exports.oneSignalRestApiKey = exports.legacyCircleActivityNotificationTypes = exports.legacyCircleActivityFeedCategory = void 0;
exports.getJoinRequestNotificationDedupeKey = getJoinRequestNotificationDedupeKey;
exports.getNudgeNotificationDedupeKey = getNudgeNotificationDedupeKey;
exports.canShareCircleOutsideMembers = canShareCircleOutsideMembers;
exports.getCircleActivityTargetsFromMemberships = getCircleActivityTargetsFromMemberships;
exports.getMemberMilestoneEvents = getMemberMilestoneEvents;
exports.formatNotificationCircleTitle = formatNotificationCircleTitle;
exports.getNotificationCopyVariantIndex = getNotificationCopyVariantIndex;
exports.resolveNotificationCopy = resolveNotificationCopy;
exports.getRoutineWindowKey = getRoutineWindowKey;
exports.getRoutineNotificationEligibility = getRoutineNotificationEligibility;
exports.getDiscoveryInactivityEligibility = getDiscoveryInactivityEligibility;
exports.getSameDayImmediateCoverageCircleIds = getSameDayImmediateCoverageCircleIds;
exports.shouldIncludeInEveningSummary = shouldIncludeInEveningSummary;
exports.buildEveningSummaryCopy = buildEveningSummaryCopy;
exports.resolveCircleActivityTargets = resolveCircleActivityTargets;
exports.getNotificationPreferenceEnabled = getNotificationPreferenceEnabled;
exports.buildOneSignalPushPayload = buildOneSignalPushPayload;
exports.markUnreadInboxEventsRead = markUnreadInboxEventsRead;
exports.createInboxEvent = createInboxEvent;
exports.notifyCircleLifecycleChanged = notifyCircleLifecycleChanged;
exports.notifyOwnerJoinRequest = notifyOwnerJoinRequest;
exports.notifyOwnerNewJoin = notifyOwnerNewJoin;
exports.notifyJoinRequestReview = notifyJoinRequestReview;
exports.notifyNudge = notifyNudge;
exports.notifyMemberSkipped = notifyMemberSkipped;
exports.notifyMemberCircleCreated = notifyMemberCircleCreated;
exports.notifyMemberCircleJoined = notifyMemberCircleJoined;
exports.notifyMemberMilestones = notifyMemberMilestones;
exports.getCircleAtRiskNotificationBody = getCircleAtRiskNotificationBody;
exports.notifyMemberTappedIn = notifyMemberTappedIn;
exports.notifyCircleComplete = notifyCircleComplete;
exports.notifyMemberDuePrompt = notifyMemberDuePrompt;
exports.notifyCircleNudgePrompt = notifyCircleNudgePrompt;
exports.notifyCircleDiscoverySuggestion = notifyCircleDiscoverySuggestion;
exports.notifyCircleAtRisk = notifyCircleAtRisk;
exports.getReminderEligibility = getReminderEligibility;
exports.buildTapInReminderNotification = buildTapInReminderNotification;
exports.getOpportunityReminderSlots = getOpportunityReminderSlots;
exports.getOutstandingTapInUids = getOutstandingTapInUids;
exports.compareCircleNudgePromptCandidates = compareCircleNudgePromptCandidates;
exports.selectHighestPriorityCircleNudge = selectHighestPriorityCircleNudge;
exports.selectGloballyEligibleCircleNudge = selectGloballyEligibleCircleNudge;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const commitments_1 = require("../shared/commitments");
const schedule_1 = require("../momentum/schedule");
const eligibility_1 = require("../momentum/eligibility");
const notification_compat_1 = require("../shared/notification-compat");
var notification_compat_2 = require("../shared/notification-compat");
Object.defineProperty(exports, "legacyCircleActivityFeedCategory", { enumerable: true, get: function () { return notification_compat_2.legacyCircleActivityFeedCategory; } });
Object.defineProperty(exports, "legacyCircleActivityNotificationTypes", { enumerable: true, get: function () { return notification_compat_2.legacyCircleActivityNotificationTypes; } });
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
    nudgePrompts: zod_1.z.boolean().optional(),
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
const memberAchievementCatalog = [
    {
        key: '7-days-straight',
        metric: 'longestStreakDays',
        threshold: 7,
        title: '7 Days Straight',
    },
    {
        key: '10-day-streak',
        metric: 'longestStreakDays',
        threshold: 10,
        title: '10 Day Streak',
    },
    {
        key: '20-day-streak',
        metric: 'longestStreakDays',
        threshold: 20,
        title: '20 Day Streak',
    },
    {
        key: '30-day-streak',
        metric: 'longestStreakDays',
        threshold: 30,
        title: '30 Day Streak',
    },
    {
        key: '50-taps',
        metric: 'totalTapIns',
        threshold: 50,
        title: '50 Taps',
    },
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
    ...Object.values(notification_compat_1.legacyCircleActivityNotificationTypes),
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
function getCircleActivityTargetsFromMemberships({ actorUid, sharedMemberUids, sourceCircle, sourceMemberUids, }) {
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
function getMemberMilestoneEvents({ metrics, priorMetrics, priorSummary, summary, }) {
    const priorCurrentStreak = asNumber(priorMetrics?.personalStreakDays, 0);
    const currentStreak = asNumber(metrics.personalStreakDays, 0);
    const priorRollingMomentum = priorSummary?.rollingMomentum;
    const rollingMomentum = summary.rollingMomentum;
    const priorResolvedOpportunityCount = asNumber(priorRollingMomentum?.resolvedOpportunityCount, 0);
    const resolvedOpportunityCount = asNumber(rollingMomentum?.resolvedOpportunityCount, 0);
    const priorStatus = normalizeMomentumStatus(priorRollingMomentum?.status);
    const status = normalizeMomentumStatus(rollingMomentum?.status);
    const events = [];
    memberAchievementCatalog.forEach(achievement => {
        const priorValue = asNumber(priorMetrics?.[achievement.metric], 0);
        const value = asNumber(metrics[achievement.metric], 0);
        if (priorValue < achievement.threshold && value >= achievement.threshold) {
            events.push({
                achievementTitle: achievement.title,
                key: achievement.key,
                type: notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked,
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
            type: notification_compat_1.legacyCircleActivityNotificationTypes.streakMilestone,
        });
    });
    if (priorResolvedOpportunityCount >= 3 &&
        resolvedOpportunityCount >= 3 &&
        status &&
        getMomentumStatusRank(status) > getMomentumStatusRank(priorStatus)) {
        events.push({
            key: status,
            momentumLabel: getMomentumStatusLabel(status),
            type: notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp,
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
    return context.periodCopy ?? 'this Cycle';
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
    circle_archived: context => ({
        body: `${getCircleTitle(context)} was archived. History is still available.`,
        title: 'Circle archived',
    }),
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
        body: `Nudge ${context.targetCount ?? 1} ${(context.targetCount ?? 1) === 1 ? 'Member' : 'Members'} in ${getCircleTitle(context)}.`,
        title: 'Nudge prompt',
    }),
    circle_restored: context => ({
        body: `${getCircleTitle(context)} was restored. New Tap Ins resume at the next opening.`,
        title: 'Circle restored',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked]: context => ({
        body: `${getActorName(context)} unlocked ${getAchievementTitle(context)}.`,
        title: 'Achievement',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.circleCreated]: context => ({
        body: `${getActorName(context)} created ${getCircleTitle(context)}.`,
        title: 'New circle',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.circleJoined]: context => ({
        body: `${getActorName(context)} joined ${getCircleTitle(context)}.`,
        title: 'Circle joined',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp]: context => ({
        body: `${getActorName(context)} reached ${getMomentumLabelCopy(context)} momentum.`,
        title: 'Momentum',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.skipped]: context => ({
        body: `${getActorName(context)} used a skip in ${getCircleTitle(context)}.`,
        title: 'Skip',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.streakMilestone]: context => ({
        body: `${getActorName(context)} reached a ${getStreakDaysCopy(context)}.`,
        title: 'Streak',
    }),
    [notification_compat_1.legacyCircleActivityNotificationTypes.tappedIn]: context => ({
        body: `${getActorName(context)} tapped in for ${getCircleTitle(context)}.`,
        title: 'Member Tap In',
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
function getRoutineWindowKey(now = new Date()) {
    return now.toISOString().slice(0, 13);
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
    const routineWindowKey = getRoutineWindowKey(now);
    if (deliveryState?.routineWindowKey === routineWindowKey) {
        return { eligible: false, reason: 'routine-window' };
    }
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
function shouldIncludeInEveningSummary({ archivedCircleIds = new Set(), coveredCircleIds, dateKey, event, timezone, }) {
    const type = getCandidateNotificationType(event);
    const circleId = getCandidateCircleId(event);
    if (!type ||
        !eveningSummaryEventTypes.has(type) ||
        (circleId ? archivedCircleIds.has(circleId) : false) ||
        getCandidatePushStatus(event) !== 'deferred' ||
        !isCandidateOnLocalDate({ candidate: event, dateKey, timezone })) {
        return false;
    }
    return !circleId || !coveredCircleIds.has(circleId);
}
function getEveningSummaryBucket(type) {
    if (type === notification_compat_1.legacyCircleActivityNotificationTypes.tappedIn) {
        return { plural: 'Tap Ins', singular: 'Tap In' };
    }
    if (type === 'circle_complete') {
        return { plural: 'completions', singular: 'completion' };
    }
    if (type === notification_compat_1.legacyCircleActivityNotificationTypes.skipped) {
        return { plural: 'skips', singular: 'skip' };
    }
    if (type === notification_compat_1.legacyCircleActivityNotificationTypes.circleCreated) {
        return { plural: 'new circles', singular: 'new circle' };
    }
    if (type === notification_compat_1.legacyCircleActivityNotificationTypes.circleJoined ||
        type === 'member_joined') {
        return { plural: 'joins', singular: 'join' };
    }
    if (type === notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked ||
        type === notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp ||
        type === notification_compat_1.legacyCircleActivityNotificationTypes.streakMilestone) {
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
function getCommitmentPeriodDateKeys(commitmentPace, timezone, now = new Date()) {
    if (commitmentPace === 'daily') {
        return [getLocalDateTimeParts(now, timezone).dateKey];
    }
    if (commitmentPace === 'monthly') {
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
    const circleIds = snapshot.docs
        .filter(doc => doc.data().status === 'active')
        .map(doc => doc.ref.parent.parent?.id)
        .filter((circleId) => Boolean(circleId));
    const circleSnapshots = await Promise.all(Array.from(new Set(circleIds)).map(circleId => firebase_1.db.collection('circles').doc(circleId).get()));
    return circleSnapshots
        .filter(circleSnapshot => circleSnapshot.exists &&
        (0, circle_lifecycle_1.getCircleLifecycleStatus)(circleSnapshot.data()) === 'active')
        .map(circleSnapshot => circleSnapshot.id);
}
async function resolveCircleActivityTargets({ actorUid, circle, circleId, }) {
    if (circle?.circleMode === 'personal' ||
        (0, circle_lifecycle_1.getCircleLifecycleStatus)(circle) === 'archived') {
        return [];
    }
    const sourceMemberUids = await getActiveCircleMemberUids(circleId);
    const sharedMemberUids = canShareCircleOutsideMembers(circle)
        ? (await Promise.all(Array.from(new Set(await getActorActiveCircleIds(actorUid))).map(activeCircleId => getActiveCircleMemberUids(activeCircleId)))).flat()
        : [];
    return getCircleActivityTargetsFromMemberships({
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
    if (key === 'nudgePrompts' &&
        typeof notificationSettings?.circleRisk === 'boolean') {
        return notificationSettings.circleRisk;
    }
    if ((key === 'circleRisk' ||
        key === 'nudgePrompts' ||
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
async function createInboxEvent({ actor, body, circleId, copyVariant, dailyDeliveryDateKey, dailyDeliveryStateKey, dedupeKey, deeplink, deliveryPriority = 'immediate', feedCategory, mediaImageUrl, preferenceKey, pushData, routineDelivery = false, routineNow = new Date(), routineTimezone = 'UTC', sourceKey, sourceRevision, title, type, uid, }) {
    const eventId = sanitizeEventId(dedupeKey ?? `${type}_${circleId ?? 'general'}_${Date.now()}`);
    const eventRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('inbox')
        .doc(eventId);
    const userPrivateSnapshot = await firebase_1.db.collection('userPrivate').doc(uid).get();
    const userPrivate = userPrivateSnapshot.data();
    const isRoutineDelivery = routineDelivery || deliveryPriority === 'routine';
    let enabled = isPreferenceEnabled(userPrivate?.notificationSettings, preferenceKey);
    const buildEventPayload = (preferenceEnabled) => ({
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
            status: preferenceEnabled
                ? deliveryPriority === 'deferred' || deliveryPriority === 'suppressed'
                    ? deliveryPriority
                    : 'pending'
                : 'disabled',
        },
        readAt: null,
        sourceKey: sourceKey ?? null,
        sourceRevision: sourceRevision ?? null,
        title,
        type,
    });
    try {
        if (isRoutineDelivery || (dailyDeliveryDateKey && dailyDeliveryStateKey)) {
            const reservation = await firebase_1.db.runTransaction(async (transaction) => {
                const [latestUserPrivateSnapshot, existingSnapshot] = await Promise.all([transaction.get(userPrivateSnapshot.ref), transaction.get(eventRef)]);
                const latestUserPrivate = latestUserPrivateSnapshot.data();
                const latestDeliveryState = (latestUserPrivate?.notificationDelivery ??
                    {});
                const latestEnabled = isPreferenceEnabled(latestUserPrivate?.notificationSettings, preferenceKey);
                if (existingSnapshot.exists) {
                    return { created: false, reason: 'dedupe' };
                }
                if (latestEnabled && isRoutineDelivery) {
                    const routineEligibility = getRoutineNotificationEligibility({
                        deliveryState: latestDeliveryState,
                        now: routineNow,
                        type,
                        timezone: routineTimezone,
                    });
                    if (!routineEligibility.eligible) {
                        return { created: false, reason: 'routine' };
                    }
                }
                if (dailyDeliveryDateKey &&
                    dailyDeliveryStateKey &&
                    latestDeliveryState?.[dailyDeliveryStateKey] === dailyDeliveryDateKey) {
                    return { created: false, reason: 'dedupe' };
                }
                const deliveryUpdates = {};
                if (latestEnabled && isRoutineDelivery) {
                    deliveryUpdates.routineWindowKey = getRoutineWindowKey(routineNow);
                }
                if (dailyDeliveryDateKey && dailyDeliveryStateKey) {
                    deliveryUpdates[dailyDeliveryStateKey] = dailyDeliveryDateKey;
                }
                transaction.create(eventRef, buildEventPayload(latestEnabled));
                if (Object.keys(deliveryUpdates).length > 0) {
                    transaction.set(latestUserPrivateSnapshot.ref, { notificationDelivery: deliveryUpdates }, { merge: true });
                }
                return { created: true, enabled: latestEnabled };
            });
            if (!reservation.created) {
                return {
                    created: false,
                    eventId,
                    pushStatus: reservation.reason === 'routine' ? 'throttled' : 'skipped',
                };
            }
            enabled = reservation.enabled;
        }
        else {
            await eventRef.create(buildEventPayload(enabled));
        }
    }
    catch (error) {
        const code = error && typeof error === 'object' && 'code' in error
            ? error.code
            : undefined;
        if (code === 6 || code === '6' || code === 'already-exists') {
            return { created: false, eventId, pushStatus: 'skipped' };
        }
        throw error;
    }
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
    if (isRoutineDelivery && pushResult.status === 'sent') {
        await recordRoutineNotificationDelivery({
            now: routineNow,
            type,
            uid,
            timezone: routineTimezone,
        }).catch(error => console.error('record_routine_notification_delivery_failed', error));
    }
    return { created: true, eventId, pushStatus: pushResult.status };
}
async function notifyCircleLifecycleChanged({ actor, circleId, circleTitle, lifecycleRevision, status, }) {
    const notificationActor = buildActor(actor);
    const actorUid = notificationActor?.uid;
    const memberUids = await getActiveCircleMemberUids(circleId);
    const type = status === 'archived' ? 'circle_archived' : 'circle_restored';
    const copy = resolveNotificationCopy({
        context: { circleTitle },
        dedupeKey: `circle_lifecycle_${circleId}_${lifecycleRevision}_${status}`,
        type,
    });
    return Promise.all(memberUids
        .filter(uid => uid !== actorUid)
        .map(uid => createInboxEvent({
        actor: notificationActor,
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey: `circle_lifecycle_${circleId}_${lifecycleRevision}_${status}_${uid}`,
        deeplink: { circleId, screen: 'CircleDetail' },
        preferenceKey: 'socialActivity',
        sourceKey: `circle_lifecycle_${circleId}`,
        sourceRevision: lifecycleRevision,
        title: copy.title,
        type,
        uid,
    })));
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
        fallbackTitle: 'New Circle Member',
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
        feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
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
        feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
        preferenceKey: 'nudges',
        title: copy.title,
        type: 'nudge',
        uid: targetUid,
    });
}
async function notifyCircleActivityEvent({ actor, circle, circleId, context, dateKey, dedupeSubject, excludedUids = [], fallbackBody, fallbackTitle, mediaImageUrl, sourceKey, sourceRevision, type, }) {
    const actorUid = asOptionalString(actor.uid);
    if (!actorUid) {
        return [];
    }
    const excludedUidSet = new Set([actorUid, ...excludedUids]);
    const targets = await resolveCircleActivityTargets({
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
        const revisionKey = typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
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
            deeplink: { circleId, screen: 'CircleDetail' },
            deliveryPriority: 'deferred',
            feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
            mediaImageUrl: targetMediaImageUrl,
            preferenceKey: 'socialActivity',
            pushData: {
                feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
                ...(targetMediaImageUrl ? { hasMedia: 'true' } : {}),
            },
            sourceKey,
            sourceRevision,
            title: copy.title,
            type,
            uid: target.uid,
        });
    }));
}
async function notifyMemberSkipped({ actor, circle, circleId, circleTitle, dateKey, sourceKey, sourceRevision, }) {
    const actorName = actor.displayName ?? 'Someone';
    return notifyCircleActivityEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'skip',
        fallbackBody: `${actorName} used a skip for ${circleTitle}.`,
        fallbackTitle: 'A Member used a Skip',
        sourceKey,
        sourceRevision,
        type: notification_compat_1.legacyCircleActivityNotificationTypes.skipped,
    });
}
async function notifyMemberCircleCreated({ actor, circle, circleId, circleTitle, dateKey, }) {
    if (!canShareCircleOutsideMembers(circle)) {
        return [];
    }
    const actorName = actor.displayName ?? 'Someone';
    return notifyCircleActivityEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'created',
        fallbackBody: `${actorName} created ${circleTitle}.`,
        fallbackTitle: 'New circle created',
        type: notification_compat_1.legacyCircleActivityNotificationTypes.circleCreated,
    });
}
async function notifyMemberCircleJoined({ actor, circle, circleId, circleTitle, dateKey, excludedUids, }) {
    const actorName = actor.displayName ?? 'Someone';
    return notifyCircleActivityEvent({
        actor,
        circle,
        circleId,
        context: { actorName, circleTitle },
        dateKey,
        dedupeSubject: 'joined',
        excludedUids,
        fallbackBody: `${actorName} joined ${circleTitle}.`,
        fallbackTitle: 'A Member joined',
        type: notification_compat_1.legacyCircleActivityNotificationTypes.circleJoined,
    });
}
function getMemberMilestoneContext(event, actorName) {
    if (event.type === notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked) {
        return { achievementTitle: event.achievementTitle, actorName };
    }
    if (event.type === notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp) {
        return { actorName, momentumLabel: event.momentumLabel };
    }
    return { actorName, streakDays: event.streakDays };
}
function getMemberMilestoneFallback({ actorName, event, }) {
    if (event.type === notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked) {
        return {
            body: `${actorName} unlocked ${event.achievementTitle}.`,
            title: 'Achievement unlocked',
        };
    }
    if (event.type === notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp) {
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
async function notifyMemberMilestones({ actor, circle, circleId, dateKey, events, sourceKey, sourceRevision, targetUid, }) {
    const actorUid = asOptionalString(actor.uid);
    const actorName = actor.displayName ?? 'Someone';
    if (!actorUid || events.length === 0) {
        return [];
    }
    const targets = await resolveCircleActivityTargets({
        actorUid,
        circle,
        circleId,
    });
    const memberSends = events.flatMap(event => {
        const context = getMemberMilestoneContext(event, actorName);
        const fallback = getMemberMilestoneFallback({ actorName, event });
        return targets.map(target => {
            const revisionKey = typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
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
                deeplink: { circleId, screen: 'CircleDetail' },
                deliveryPriority: 'deferred',
                feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
                preferenceKey: 'socialActivity',
                pushData: { feedCategory: notification_compat_1.legacyCircleActivityFeedCategory },
                sourceKey,
                sourceRevision,
                title: copy.title,
                type: event.type,
                uid: target.uid,
            });
        });
    });
    const selfSends = events.map(event => {
        const context = getMemberMilestoneContext(event, 'You');
        const fallback = getMemberMilestoneFallback({ actorName: 'You', event });
        const revisionKey = typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
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
            deeplink: { circleId, screen: 'CircleDetail' },
            deliveryPriority: 'suppressed',
            preferenceKey: 'socialActivity',
            sourceKey,
            sourceRevision,
            title: copy.title,
            type: event.type,
            uid: targetUid,
        });
    });
    return Promise.all([...memberSends, ...selfSends]);
}
function getCircleAtRiskNotificationBody({ circleTitle, commitmentPace, remainingCount, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentPace);
    return `${formatNotificationCircleTitle(circleTitle)} needs ${remainingCount} more Tap In${remainingCount === 1 ? '' : 's'} ${periodCopy}.`;
}
function getCommitmentPeriodCopy(_commitmentPace) {
    return 'this Cycle';
}
async function notifyMemberTappedIn({ actor, circleId, circleTitle, dateKey, mediaImageUrl, sourceKey, sourceRevision, targetUid, }) {
    const notificationActor = buildActor(actor);
    const actorName = notificationActor?.displayName ?? 'Someone';
    const revisionKey = typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
    const dedupeKey = `${notification_compat_1.legacyCircleActivityNotificationTypes.tappedIn}_${circleId}_${dateKey}_${notificationActor?.uid ?? 'unknown'}_${targetUid}${revisionKey}`;
    const copy = resolveNotificationCopy({
        context: { actorName, circleTitle },
        dedupeKey,
        fallbackBody: `${actorName} tapped in for ${circleTitle}.`,
        fallbackTitle: 'A Member tapped in',
        type: notification_compat_1.legacyCircleActivityNotificationTypes.tappedIn,
    });
    return createInboxEvent({
        actor: notificationActor,
        body: copy.body,
        circleId,
        copyVariant: copy.copyVariant,
        dedupeKey,
        deeplink: { circleId, screen: 'CircleDetail' },
        deliveryPriority: 'deferred',
        feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
        mediaImageUrl,
        preferenceKey: 'socialActivity',
        pushData: {
            feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
            ...(mediaImageUrl ? { hasMedia: 'true' } : {}),
        },
        sourceKey,
        sourceRevision,
        title: copy.title,
        type: notification_compat_1.legacyCircleActivityNotificationTypes.tappedIn,
        uid: targetUid,
    });
}
async function notifyCircleComplete({ actorUid, circleId, circleTitle, commitmentPace, periodKey, sourceKey, sourceRevision, targetUid, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentPace);
    const revisionKey = typeof sourceRevision === 'number' ? `_r${sourceRevision}` : '';
    const dedupeKey = `circle_complete_${circleId}_${periodKey}_${targetUid}${revisionKey}`;
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
        feedCategory: notification_compat_1.legacyCircleActivityFeedCategory,
        preferenceKey: 'socialActivity',
        sourceKey,
        sourceRevision,
        title: copy.title,
        type: 'circle_complete',
        uid: targetUid,
    });
}
async function notifyMemberDuePrompt({ circleId, circleTitle, commitmentPace, periodKey, targetUid, timezone, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentPace);
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
async function notifyCircleNudgePrompt({ circleId, circleTitle, dateKey, periodKey, routineNow, targetCount, targetUid, timezone, }) {
    const dedupeKey = `circle_nudge_prompt_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, targetCount },
        dedupeKey,
        fallbackBody: `${circleTitle} could use a nudge for ${targetCount} ${targetCount === 1 ? 'Member' : 'Members'}.`,
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
        deeplink: { circleId, screen: 'CircleDetail' },
        deliveryPriority: 'routine',
        preferenceKey: 'nudgePrompts',
        routineNow,
        routineTimezone: timezone,
        title: copy.title,
        type: 'circle_nudge_prompt',
        uid: targetUid,
    });
}
async function notifyCircleDiscoverySuggestion({ category, circleId, circleTitle, dateKey, routineNow, targetUid, timezone, }) {
    const dedupeKey = `circle_discovery_${circleId}_${dateKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: {
            discoveryCategory: category,
            discoveryCircleTitle: circleTitle,
        },
        dedupeKey,
        fallbackBody: `${circleTitle} could help you restart your Commitment.`,
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
        routineDelivery: true,
        routineNow,
        routineTimezone: timezone,
        title: copy.title,
        type: 'circle_discovery_suggestion',
        uid: targetUid,
    });
    if (result.pushStatus === 'deferred') {
        await recordRoutineNotificationDelivery({
            now: routineNow,
            type: 'circle_discovery_suggestion',
            uid: targetUid,
            timezone,
        }).catch(error => console.error('record_discovery_notification_delivery_failed', error));
    }
    return result;
}
async function notifyCircleAtRisk({ commitmentPace, circleId, circleTitle, periodKey, remainingCount, targetUid, }) {
    const periodCopy = getCommitmentPeriodCopy(commitmentPace);
    const dedupeKey = `circle_at_risk_${circleId}_${periodKey}_${targetUid}`;
    const copy = resolveNotificationCopy({
        context: { circleTitle, periodCopy, remainingCount },
        dedupeKey,
        fallbackBody: getCircleAtRiskNotificationBody({
            circleTitle,
            commitmentPace,
            remainingCount,
        }),
        fallbackTitle: 'Circle Progress at risk',
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
function getReminderEligibility({ pace, circleId, dateKey, kind, memberStatus, notificationSettings, opportunityStatus, periodKey, remainingTapIns, slotIndex, todayStatus, uid, }) {
    if (!uid || !circleId || !dateKey) {
        return { eligible: false, reason: 'missing-input' };
    }
    if (memberStatus !== 'active') {
        return { eligible: false, reason: 'inactive-member' };
    }
    if (opportunityStatus === 'completed' ||
        opportunityStatus === 'skipped' ||
        todayStatus === 'done' ||
        todayStatus === 'skip') {
        return { eligible: false, reason: 'already-covered' };
    }
    if (typeof remainingTapIns === 'number' && remainingTapIns <= 0) {
        return { eligible: false, reason: 'frequency-complete' };
    }
    if (!isPreferenceEnabled(notificationSettings, 'tapInReminders')) {
        return { eligible: false, reason: 'preference-disabled' };
    }
    return {
        dedupeKey: pace &&
            pace !== 'daily' &&
            periodKey &&
            typeof slotIndex === 'number'
            ? `tap_in_${kind}_${circleId}_${periodKey}_${slotIndex}_${uid}`
            : `tap_in_${kind}_${circleId}_${dateKey}_${uid}`,
        eligible: true,
        reason: 'eligible',
    };
}
function getTapInReminderType(kind) {
    return kind === 'midday'
        ? 'tap_in_midday_reminder'
        : 'tap_in_final_warning';
}
function getTapInReminderSummaryDedupeKey({ dateKey, kind, reminders, uid, }) {
    const opportunityKeys = reminders
        .map(reminder => reminder.opportunityKey)
        .filter((value) => Boolean(value))
        .sort();
    const opportunitySuffix = opportunityKeys.length > 0
        ? `_${hashString(opportunityKeys.join('|')).toString(36)}`
        : '';
    return `tap_in_${kind}_summary_${dateKey}_${uid}${opportunitySuffix}`;
}
function getTapInReminderCircleListCopy(reminders) {
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
function buildTapInReminderNotification({ dateKey, kind, reminders, uid, }) {
    const type = getTapInReminderType(kind);
    if (reminders.length === 0) {
        return undefined;
    }
    if (reminders.length === 1) {
        const reminder = reminders[0];
        const dedupeKey = reminder.dedupeKey ??
            `tap_in_${kind}_${reminder.circleId}_${dateKey}_${uid}`;
        const copy = resolveNotificationCopy({
            context: { circleTitle: reminder.circleTitle },
            dedupeKey,
            fallbackBody: kind === 'midday'
                ? `Tap In to keep ${reminder.circleTitle} Progress moving.`
                : `2 hours left to Tap In for ${reminder.circleTitle}.`,
            fallbackTitle: kind === 'midday' ? 'Keep your Commitment moving' : '2 hours left',
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
        body: kind === 'midday'
            ? `Tap In needed for ${circleCopy} today${listCopy}.`
            : `2 hours left for ${circleCopy}${listCopy}.`,
        dedupeKey,
        deeplink: { screen: 'TapInPicker' },
        pushData: { screen: 'TapInPicker' },
        title: kind === 'midday' ? 'Tap In reminder' : 'Final Tap In warning',
        type,
    };
}
function getOpportunityReminderSlots({ dateKey, kind, slots, }) {
    return slots.filter(slot => kind === 'midday'
        ? slot.availableDateKey === dateKey
        : slot.expiresDateKey === dateKey);
}
async function sendTapInReminders(kind) {
    const targetHour = kind === 'midday' ? 12 : 22;
    const now = new Date();
    const circleSnapshots = await firebase_1.db.collection('circles').get();
    const reminderGroups = new Map();
    for (const circleSnapshot of circleSnapshots.docs) {
        const circle = circleSnapshot.data();
        if ((0, circle_lifecycle_1.getCircleLifecycleStatus)(circle) === 'archived') {
            continue;
        }
        const timezone = asString(circle.timezone, 'UTC');
        const local = getLocalDateTimeParts(now, timezone);
        const commitmentPace = (0, commitments_1.getCommitmentPace)(circle);
        const slots = (0, schedule_1.getOpportunitySlots)((0, schedule_1.normalizeCommitmentSchedule)(circle, timezone), now).filter(slot => (0, circle_lifecycle_1.isCircleSlotAfterResumeBoundary)(circle, slot.availableDateKey));
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
        const slotSnapshots = await Promise.all(reminderSlots.map(slot => circleSnapshot.ref
            .collection('opportunities')
            .doc(slot.periodKey)
            .collection('slots')
            .doc(String(slot.slotIndex))
            .get()));
        const circleTitle = asString(circle.title, 'Your circle');
        for (const memberSnapshot of memberSnapshots.docs) {
            const uid = asString(memberSnapshot.data().uid, memberSnapshot.id);
            const eligibleSlotIndex = reminderSlots.findIndex((slot, index) => {
                const expectedMemberUids = slotSnapshots[index].data()?.expectedMemberUids;
                return Array.isArray(expectedMemberUids)
                    ? expectedMemberUids.includes(uid)
                    : (0, eligibility_1.isMemberExpectedForSlot)({
                        member: memberSnapshot.data(),
                        slot,
                        timezone,
                    });
            });
            if (eligibleSlotIndex < 0) {
                continue;
            }
            const slot = reminderSlots[eligibleSlotIndex];
            const opportunitySnapshot = await firebase_1.db
                .collection('userPrivate')
                .doc(uid)
                .collection('opportunities')
                .doc(`${circleSnapshot.id}_${slot.periodKey}_${slot.slotIndex}`)
                .get();
            const opportunityStatus = opportunitySnapshot.data()?.status;
            const userPrivateSnapshot = await firebase_1.db
                .collection('userPrivate')
                .doc(uid)
                .get();
            const userPrivate = userPrivateSnapshot.data();
            const eligibility = getReminderEligibility({
                pace: commitmentPace,
                circleId: circleSnapshot.id,
                dateKey: local.dateKey,
                kind,
                memberStatus: memberSnapshot.data().status,
                notificationSettings: userPrivate?.notificationSettings,
                opportunityStatus,
                periodKey: slot.periodKey,
                remainingTapIns: opportunityStatus === 'completed' || opportunityStatus === 'skipped'
                    ? 0
                    : 1,
                slotIndex: slot.slotIndex,
                uid,
            });
            if (!eligibility.eligible || !eligibility.dedupeKey) {
                continue;
            }
            const groupKey = `${kind}_${local.dateKey}_${uid}`;
            const group = reminderGroups.get(groupKey) ??
                {
                    dateKey: local.dateKey,
                    reminders: [],
                    timezone,
                    uid,
                };
            group.reminders.push({
                circleId: circleSnapshot.id,
                circleTitle,
                dedupeKey: eligibility.dedupeKey,
                opportunityKey: commitmentPace === 'daily'
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
            routineNow: now,
            routineTimezone: group.timezone,
            title: notification.title,
            type: notification.type,
            uid: group.uid,
        });
    })
        .filter((promise) => Boolean(promise));
    await Promise.all(sendPromises);
    return { sentOrSkipped: sendPromises.length };
}
function getPeriodKey({ commitmentPace, dateKey, periodDateKeys, }) {
    return commitmentPace === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
}
function getOutstandingTapInUids({ coveredCounts, members, requiredTapIns, }) {
    return members
        .filter(member => member.status === 'active' &&
        (coveredCounts.get(member.uid) ?? 0) < requiredTapIns)
        .map(member => member.uid);
}
function compareCircleNudgePromptCandidates(left, right) {
    const deadlineComparison = left.deadlineDateKey.localeCompare(right.deadlineDateKey);
    if (deadlineComparison !== 0) {
        return deadlineComparison;
    }
    const riskShareComparison = right.behindCount * left.activeCount -
        left.behindCount * right.activeCount;
    if (riskShareComparison !== 0) {
        return riskShareComparison;
    }
    return left.circleId.localeCompare(right.circleId);
}
function selectHighestPriorityCircleNudge(candidates) {
    return [...candidates].sort(compareCircleNudgePromptCandidates)[0];
}
function selectGloballyEligibleCircleNudge({ candidates, hasOutstandingTapIns, }) {
    return hasOutstandingTapIns
        ? undefined
        : selectHighestPriorityCircleNudge(candidates);
}
async function sendCircleEngagementPrompts() {
    const targetHour = 18;
    const now = new Date();
    const circleSnapshots = await firebase_1.db.collection('circles').get();
    const candidatesByUid = new Map();
    const outstandingTapInUids = new Set();
    for (const circleSnapshot of circleSnapshots.docs) {
        const circle = circleSnapshot.data();
        if ((0, circle_lifecycle_1.getCircleLifecycleStatus)(circle) === 'archived') {
            continue;
        }
        const timezone = asString(circle.timezone, 'UTC');
        const local = getLocalDateTimeParts(now, timezone);
        const eligibleSlots = (0, schedule_1.getOpportunitySlots)((0, schedule_1.normalizeCommitmentSchedule)(circle, timezone), now).filter(slot => (0, circle_lifecycle_1.isCircleSlotAfterResumeBoundary)(circle, slot.availableDateKey));
        if (!eligibleSlots.some(slot => slot.availableDateKey <= local.dateKey &&
            slot.expiresDateKey >= local.dateKey)) {
            continue;
        }
        const commitmentPace = (0, commitments_1.getCommitmentPace)(circle);
        const periodDateKeys = getCommitmentPeriodDateKeys(commitmentPace, timezone, now);
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
                if ((0, commitments_1.isCoveredCheckInData)(doc.data())) {
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
        const behindUidSet = new Set(getOutstandingTapInUids({ coveredCounts, members, requiredTapIns }));
        const behindMembers = members.filter(member => behindUidSet.has(member.uid));
        const engagedMembers = members.filter(member => !behindUidSet.has(member.uid));
        behindMembers.forEach(member => outstandingTapInUids.add(member.uid));
        if (behindMembers.length === 0 || circle.circleMode === 'personal') {
            continue;
        }
        const circleTitle = asString(circle.title, 'Your circle');
        const periodKey = getPeriodKey({
            commitmentPace,
            dateKey: local.dateKey,
            periodDateKeys,
        });
        const deadlineDateKey = periodDateKeys[periodDateKeys.length - 1] ?? local.dateKey;
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
    const sendPromises = Array.from(candidatesByUid.entries()).map(async ([uid, candidates]) => {
        const [userPrivateSnapshot, userSnapshot] = await Promise.all([
            firebase_1.db.collection('userPrivate').doc(uid).get(),
            firebase_1.db.collection('users').doc(uid).get(),
        ]);
        const fallbackTimezone = candidates[0]?.timezone ?? 'UTC';
        const timezone = asString(userPrivateSnapshot.data()?.timezone, asString(userSnapshot.data()?.timezone, fallbackTimezone));
        const local = getLocalDateTimeParts(now, timezone);
        if (local.hour !== targetHour) {
            return undefined;
        }
        const unsentCandidates = (await Promise.all(candidates.map(async (candidate) => {
            const dedupeKey = `circle_nudge_prompt_${candidate.circleId}_${candidate.periodKey}_${uid}`;
            const existingSnapshot = await userPrivateSnapshot.ref
                .collection('inbox')
                .doc(sanitizeEventId(dedupeKey))
                .get();
            return existingSnapshot.exists ? undefined : candidate;
        }))).filter((candidate) => Boolean(candidate));
        const selected = selectGloballyEligibleCircleNudge({
            candidates: unsentCandidates,
            hasOutstandingTapIns: outstandingTapInUids.has(uid),
        });
        if (!selected) {
            return undefined;
        }
        return notifyCircleNudgePrompt({
            circleId: selected.circleId,
            circleTitle: selected.circleTitle,
            dateKey: local.dateKey,
            periodKey: selected.periodKey,
            routineNow: now,
            targetCount: selected.behindCount,
            targetUid: selected.targetUid,
            timezone,
        });
    });
    const results = await Promise.all(sendPromises);
    return {
        sentOrSkipped: results.filter(result => Boolean(result)).length,
    };
}
async function getEligibleDiscoveryCircleForUser({ publicCircleSnapshots, uid, }) {
    for (const circleSnapshot of publicCircleSnapshots.docs) {
        const circle = circleSnapshot.data();
        if (circle.circleMode === 'personal') {
            continue;
        }
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
            routineNow: now,
            targetUid: uid,
            timezone: 'UTC',
        }));
    }
    await Promise.all(sendPromises);
    return { sentOrSkipped: sendPromises.length };
}
async function updateDeferredInboxPushStatuses({ docs, status, summaryEventId, }) {
    let batch = firebase_1.db.batch();
    let pendingWrites = 0;
    for (const doc of docs) {
        batch.set(doc.ref, {
            push: {
                ...(status === 'summarized' && summaryEventId
                    ? { summaryEventId }
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
    }
    if (pendingWrites > 0) {
        await batch.commit();
    }
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
        const deferredCircleIds = Array.from(new Set(deferredSnapshot.docs
            .map(doc => getCandidateCircleId(doc.data()))
            .filter((circleId) => Boolean(circleId))));
        const deferredCircleSnapshots = await Promise.all(deferredCircleIds.map(circleId => firebase_1.db.collection('circles').doc(circleId).get()));
        const archivedCircleIds = new Set(deferredCircleSnapshots
            .filter(circleSnapshot => circleSnapshot.exists &&
            (0, circle_lifecycle_1.getCircleLifecycleStatus)(circleSnapshot.data()) === 'archived')
            .map(circleSnapshot => circleSnapshot.id));
        const coveredCircleIds = getSameDayImmediateCoverageCircleIds({
            dateKey: local.dateKey,
            events: recentEvents,
            timezone,
        });
        const includedDocs = deferredSnapshot.docs.filter(doc => shouldIncludeInEveningSummary({
            archivedCircleIds,
            coveredCircleIds,
            dateKey: local.dateKey,
            event: doc.data(),
            timezone,
        }));
        const coveredDocs = deferredSnapshot.docs.filter(doc => {
            const data = doc.data();
            const circleId = getCandidateCircleId(data);
            return (circleId &&
                !archivedCircleIds.has(circleId) &&
                coveredCircleIds.has(circleId) &&
                getCandidatePushStatus(data) === 'deferred' &&
                isCandidateOnLocalDate({
                    candidate: data,
                    dateKey: local.dateKey,
                    timezone,
                }));
        });
        const archivedDocs = deferredSnapshot.docs.filter(doc => {
            const circleId = getCandidateCircleId(doc.data());
            return circleId ? archivedCircleIds.has(circleId) : false;
        });
        if (archivedDocs.length > 0) {
            await updateDeferredInboxPushStatuses({
                docs: archivedDocs,
                status: 'suppressed',
            });
        }
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
        await updateDeferredInboxPushStatuses({
            docs: includedDocs,
            status: 'summarized',
            summaryEventId: summaryResult?.eventId,
        });
        await updateDeferredInboxPushStatuses({
            docs: coveredDocs,
            status: 'covered_by_immediate',
        });
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
