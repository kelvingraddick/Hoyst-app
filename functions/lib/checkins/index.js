"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTapIn = exports.processTapInSideEffects = exports.updateTapInDetails = exports.submitTapIn = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const grace_1 = require("./grace");
const remove_1 = require("./remove");
const reconciliation_1 = require("./reconciliation");
const momentum_1 = require("../momentum");
const notifications_1 = require("../notifications");
const notification_compat_1 = require("../shared/notification-compat");
const commitments_1 = require("../shared/commitments");
const circle_mode_1 = require("../shared/circle-mode");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const profile_1 = require("../profile");
const thread_1 = require("../thread");
const notification_plan_1 = require("./notification-plan");
const details_1 = require("./details");
const submitTapInSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    currentValue: zod_1.z.number().int().min(0).max(100000).optional(),
    note: zod_1.z.string().trim().max(1000).optional(),
    photoUrl: zod_1.z.string().trim().max(2048).optional(),
    status: zod_1.z.enum(['done', 'skip']).default('done'),
});
const removeTapInSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    idToken: zod_1.z.string().trim().min(1).optional(),
});
const updateTapInDetailsSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    note: zod_1.z.string().trim().max(1000).nullable(),
    photoUrl: zod_1.z.string().trim().url().max(2048).nullable(),
});
function getCheckInEffectSourceKey(circleId, dateKey, uid) {
    return `check_in:${circleId}:${dateKey}:${uid}`;
}
async function deleteSnapshotsInBatches(snapshots) {
    for (let index = 0; index < snapshots.length; index += 400) {
        const batch = firebase_1.db.batch();
        snapshots.slice(index, index + 400).forEach(snapshot => {
            batch.delete(snapshot.ref);
        });
        await batch.commit();
    }
}
async function retractTapInEffects({ accountDeletion = false, circleId, dateKey, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const sourceKey = getCheckInEffectSourceKey(circleId, dateKey, uid);
    const streakPrefix = `streak_${dateKey}_${uid}_`;
    const effectRef = circleRef
        .collection('checkInEffects')
        .doc(`${dateKey}_${uid}`);
    const [effectSnapshot, sourceInboxSnapshots, streakSnapshots] = await Promise.all([
        effectRef.get(),
        firebase_1.db.collectionGroup('inbox').where('sourceKey', '==', sourceKey).get(),
        circleRef
            .collection('feedItems')
            .where(firestore_1.FieldPath.documentId(), '>=', streakPrefix)
            .where(firestore_1.FieldPath.documentId(), '<', `${streakPrefix}\uf8ff`)
            .get(),
    ]);
    const coverageRevision = typeof effectSnapshot.data()?.coverageRevision === 'number'
        ? effectSnapshot.data()?.coverageRevision
        : 1;
    const momentumSummary = accountDeletion
        ? undefined
        : await (0, momentum_1.recalculateMomentumSummaryForUser)(uid);
    const personalMetrics = accountDeletion
        ? undefined
        : await (0, profile_1.calculatePersonalMetricsForUser)({ uid });
    const retainedInboxSnapshots = momentumSummary && personalMetrics
        ? sourceInboxSnapshots.docs.filter(snapshot => (0, reconciliation_1.shouldRetainCorrectedMetricEffect)({
            currentStreakDays: personalMetrics.personalStreakDays,
            effectId: snapshot.id,
            longestStreakDays: personalMetrics.longestStreakDays,
            rollingMomentumStatus: momentumSummary.rollingMomentum?.status,
            totalTapIns: personalMetrics.totalTapIns,
            type: snapshot.data().type,
        }))
        : [];
    const retainedInboxIds = new Set(retainedInboxSnapshots.map(snapshot => snapshot.id));
    const removableInboxSnapshots = sourceInboxSnapshots.docs.filter(snapshot => !retainedInboxIds.has(snapshot.id));
    const retainedStreakSnapshots = momentumSummary && personalMetrics
        ? streakSnapshots.docs.filter(snapshot => (0, reconciliation_1.shouldRetainCorrectedMetricEffect)({
            currentStreakDays: personalMetrics.personalStreakDays,
            effectId: snapshot.id,
            longestStreakDays: personalMetrics.longestStreakDays,
            rollingMomentumStatus: momentumSummary.rollingMomentum?.status,
            totalTapIns: personalMetrics.totalTapIns,
            type: 'streak_milestone',
        }))
        : [];
    const retainedStreakIds = new Set(retainedStreakSnapshots.map(snapshot => snapshot.id));
    const removableStreakSnapshots = streakSnapshots.docs.filter(snapshot => !retainedStreakIds.has(snapshot.id));
    const retainedMetricEventIds = [
        ...retainedInboxSnapshots.map(snapshot => snapshot.id),
        ...retainedStreakSnapshots.map(snapshot => snapshot.id),
    ];
    await Promise.all([
        circleRef.collection('feedItems').doc(`tap_in_${dateKey}_${uid}`).delete(),
        deleteSnapshotsInBatches(removableInboxSnapshots),
        deleteSnapshotsInBatches(removableStreakSnapshots),
    ]);
    if (accountDeletion) {
        await firebase_1.db.recursiveDelete(effectRef);
        return;
    }
    await Promise.all([
        effectRef.set({
            active: false,
            retractedAt: firestore_1.FieldValue.serverTimestamp(),
            retainedMetricEventIds,
            sourceKey,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true }),
        effectRef.collection('revisions').doc(String(coverageRevision)).set({
            active: false,
            retractedAt: firestore_1.FieldValue.serverTimestamp(),
            retainedMetricEventIds,
            sourceKey,
            status: 'retracted',
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true }),
    ]);
}
async function reconcileCorrectedMetricEffects({ circleId, dateKey, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const sourceKey = getCheckInEffectSourceKey(circleId, dateKey, uid);
    const streakPrefix = `streak_${dateKey}_${uid}_`;
    const [sourceInboxSnapshots, streakSnapshots, momentumSummary, metrics] = await Promise.all([
        firebase_1.db.collectionGroup('inbox').where('sourceKey', '==', sourceKey).get(),
        circleRef
            .collection('feedItems')
            .where(firestore_1.FieldPath.documentId(), '>=', streakPrefix)
            .where(firestore_1.FieldPath.documentId(), '<', `${streakPrefix}\uf8ff`)
            .get(),
        (0, momentum_1.recalculateMomentumSummaryForUser)(uid),
        (0, profile_1.calculatePersonalMetricsForUser)({ uid }),
    ]);
    const metricInboxSnapshots = sourceInboxSnapshots.docs.filter(snapshot => [
        notification_compat_1.legacyCircleActivityNotificationTypes.achievementUnlocked,
        notification_compat_1.legacyCircleActivityNotificationTypes.momentumLevelUp,
        notification_compat_1.legacyCircleActivityNotificationTypes.streakMilestone,
    ].includes(snapshot.data().type));
    const retainedInboxSnapshots = metricInboxSnapshots.filter(snapshot => (0, reconciliation_1.shouldRetainCorrectedMetricEffect)({
        currentStreakDays: metrics.personalStreakDays,
        effectId: snapshot.id,
        longestStreakDays: metrics.longestStreakDays,
        rollingMomentumStatus: momentumSummary.rollingMomentum?.status,
        totalTapIns: metrics.totalTapIns,
        type: snapshot.data().type,
    }));
    const retainedInboxIds = new Set(retainedInboxSnapshots.map(snapshot => snapshot.id));
    const removableInboxSnapshots = metricInboxSnapshots.filter(snapshot => !retainedInboxIds.has(snapshot.id));
    const retainedStreakSnapshots = streakSnapshots.docs.filter(snapshot => (0, reconciliation_1.shouldRetainCorrectedMetricEffect)({
        currentStreakDays: metrics.personalStreakDays,
        effectId: snapshot.id,
        longestStreakDays: metrics.longestStreakDays,
        rollingMomentumStatus: momentumSummary.rollingMomentum?.status,
        totalTapIns: metrics.totalTapIns,
        type: 'streak_milestone',
    }));
    const retainedStreakIds = new Set(retainedStreakSnapshots.map(snapshot => snapshot.id));
    const removableStreakSnapshots = streakSnapshots.docs.filter(snapshot => !retainedStreakIds.has(snapshot.id));
    await Promise.all([
        deleteSnapshotsInBatches(removableInboxSnapshots),
        deleteSnapshotsInBatches(removableStreakSnapshots),
    ]);
}
async function updateCoveredTapInActivity({ checkIn, circleId, dateKey, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const activityId = `tap_in_${dateKey}_${uid}`;
    const activityRef = circleRef.collection('feedItems').doc(activityId);
    const effectRef = circleRef
        .collection('checkInEffects')
        .doc(`${dateKey}_${uid}`);
    const [circleSnapshot, activitySnapshot, effectSnapshot] = await Promise.all([
        circleRef.get(),
        activityRef.get(),
        effectRef.get(),
    ]);
    const isAccountDeletion = checkIn.deletionReason === 'account';
    const shouldShowActivity = !isAccountDeletion &&
        (0, circle_mode_1.getCircleMode)(circleSnapshot.data()) !== 'personal' &&
        checkIn.status === 'done';
    if (!shouldShowActivity) {
        await activityRef.delete();
    }
    else if (activitySnapshot.exists) {
        await activityRef.set({
            mediaImageUrl: asCleanString(checkIn.photoUrl) ?? null,
            note: asCleanString(checkIn.note) ?? null,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    else {
        await (0, thread_1.createCircleThreadActivity)({
            actor: {
                avatarUrl: asCleanString(checkIn.avatarUrl) ?? null,
                displayName: asCleanString(checkIn.displayName) ?? 'Someone',
                handle: asCleanString(checkIn.handle) ?? null,
                uid,
            },
            circleId,
            createdAt: checkIn.createdAt,
            itemId: activityId,
            mediaImageUrl: asCleanString(checkIn.photoUrl),
            note: asCleanString(checkIn.note),
            text: `${asCleanString(checkIn.displayName) ?? 'Someone'} tapped in`,
            tone: 'success',
            type: 'tap_in',
        });
    }
    if (isAccountDeletion || !effectSnapshot.exists) {
        return;
    }
    const rawActivityIds = effectSnapshot.data()?.circleActivityIds;
    const priorActivityIds = Array.isArray(rawActivityIds)
        ? rawActivityIds.filter((value) => typeof value === 'string')
        : [];
    const circleActivityIds = shouldShowActivity
        ? Array.from(new Set([...priorActivityIds, activityId]))
        : priorActivityIds.filter(value => value !== activityId);
    const coverageRevision = typeof checkIn.coverageRevision === 'number'
        ? checkIn.coverageRevision
        : effectSnapshot.data()?.coverageRevision;
    const effectPayload = {
        circleActivityIds,
        status: checkIn.status,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    const writes = [
        effectRef.set(effectPayload, { merge: true }),
    ];
    if (typeof coverageRevision === 'number') {
        writes.push(effectRef
            .collection('revisions')
            .doc(String(coverageRevision))
            .set(effectPayload, { merge: true }));
    }
    await Promise.all(writes);
}
async function getAuthenticatedUid(uid, idToken) {
    if (uid) {
        return uid;
    }
    if (!idToken) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    try {
        const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
        return decodedToken.uid;
    }
    catch {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
}
async function requireCompletedProfile(uid, idToken) {
    const authenticatedUid = await getAuthenticatedUid(uid, idToken);
    const snapshot = await firebase_1.db.collection('users').doc(authenticatedUid).get();
    const profile = snapshot.data();
    if (!profile || profile.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { profile, uid: authenticatedUid };
}
function getDateKey(timezone) {
    return getDateKeyForDate(timezone, new Date());
}
function getDateKeyForDate(timezone, date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(part => part.type === 'year')?.value ?? '1970';
    const month = parts.find(part => part.type === 'month')?.value ?? '01';
    const day = parts.find(part => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}
function getCommitmentWeekDateKeys(timezone, now = new Date()) {
    const local = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
    }).formatToParts(now);
    const weekday = local.find(part => part.type === 'weekday')?.value ?? 'Mon';
    const dayOffsetByWeekday = {
        Fri: 4,
        Mon: 0,
        Sat: 5,
        Sun: 6,
        Thu: 3,
        Tue: 1,
        Wed: 2,
    };
    const localDate = new Date(Number(local.find(part => part.type === 'year')?.value ?? '1970'), Number(local.find(part => part.type === 'month')?.value ?? '1') - 1, Number(local.find(part => part.type === 'day')?.value ?? '1'));
    const monday = new Date(localDate);
    monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
function getCommitmentPeriodDateKeys(pace, timezone, now = new Date()) {
    if (pace === 'daily') {
        return [getDateKeyForDate(timezone, now)];
    }
    if (pace === 'monthly') {
        return getCommitmentMonthDateKeys(timezone, now);
    }
    return getCommitmentWeekDateKeys(timezone, now);
}
function asCleanString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function asNonNegativeNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.round(value))
        : fallback;
}
function canUpdateQuantityTapIn(circle) {
    const commitmentType = (0, commitments_1.getCommitmentType)(circle);
    return (commitmentType === 'limit' ||
        (commitmentType === 'build' && !(0, commitments_1.isSingleTapInCommitment)(circle)));
}
function getTapInCurrentValue({ circle, existingValue, inputValue, }) {
    const commitmentType = (0, commitments_1.getCommitmentType)(circle);
    if (commitmentType === 'avoid' || (0, commitments_1.isSingleTapInCommitment)(circle)) {
        return 1;
    }
    return asNonNegativeNumber(inputValue, asNonNegativeNumber(existingValue, 0));
}
async function processTapInSideEffectsForCheckIn({ checkIn, circleId, dateKey, status, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const momentumRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('momentum')
        .doc('current');
    const priorMomentumSnapshot = await momentumRef.get();
    const priorMomentumSummary = priorMomentumSnapshot.data();
    const checkInPath = circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .doc(uid).path;
    const [momentumSummary, metrics, priorMetrics] = await Promise.all([
        (0, momentum_1.recalculateMomentumSummaryForUser)(uid).catch(error => {
            console.error('recalculate_momentum_summary_failed', error);
            return undefined;
        }),
        (0, profile_1.calculatePersonalMetricsForUser)({ uid }),
        (0, profile_1.calculatePersonalMetricsForUser)({
            excludedCheckInPath: checkInPath,
            uid,
        }),
    ]);
    const [circleSnapshot, memberSnapshots] = await Promise.all([
        circleRef.get(),
        circleRef.collection('members').where('status', '==', 'active').get(),
    ]);
    const circle = circleSnapshot.data();
    const isPersonal = (0, circle_mode_1.getCircleMode)(circle) === 'personal';
    const timezone = asCleanString(circle?.timezone) ?? 'UTC';
    const commitmentPace = (0, commitments_1.getCommitmentPace)(circle);
    const requiredTapIns = (0, commitments_1.getRequiredTapIns)(circle);
    const periodDateKeys = getCommitmentPeriodDateKeys(commitmentPace, timezone);
    const periodCheckInSnapshots = await Promise.all(periodDateKeys.map(periodDateKey => circleRef
        .collection('days')
        .doc(periodDateKey)
        .collection('checkIns')
        .get()));
    const coveredCounts = new Map();
    const todaySnapshotIndex = periodDateKeys.indexOf(dateKey);
    const todayCheckInSnapshot = periodCheckInSnapshots[todaySnapshotIndex >= 0 ? todaySnapshotIndex : 0];
    const scoringSnapshots = commitmentPace === 'daily' && todayCheckInSnapshot
        ? [todayCheckInSnapshot]
        : periodCheckInSnapshots;
    const periodKey = commitmentPace === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
    const [canonicalPeriodSnapshot, canonicalSlotSnapshots] = await Promise.all([
        circleRef.collection('opportunities').doc(periodKey).get(),
        circleRef
            .collection('opportunities')
            .doc(periodKey)
            .collection('slots')
            .get(),
    ]);
    const canonicalExpectedMemberUids = new Set();
    canonicalSlotSnapshots.docs.forEach(snapshot => {
        const values = snapshot.data().expectedMemberUids;
        if (Array.isArray(values)) {
            values.forEach(value => {
                if (typeof value === 'string') {
                    canonicalExpectedMemberUids.add(value);
                }
            });
        }
    });
    const hasCanonicalExpectations = canonicalSlotSnapshots.size > 0;
    scoringSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if ((0, commitments_1.isCoveredCheckInData)(doc.data())) {
                coveredCounts.set(doc.id, (coveredCounts.get(doc.id) ?? 0) + 1);
            }
        });
    });
    const activeMemberUids = memberSnapshots.docs
        .map(snapshot => {
        const memberUid = snapshot.data().uid;
        return typeof memberUid === 'string' && memberUid.trim().length > 0
            ? memberUid
            : snapshot.id;
    })
        .filter(memberUid => Boolean(memberUid) &&
        (!hasCanonicalExpectations ||
            canonicalExpectedMemberUids.has(memberUid)));
    const canonicalExpectedOpportunityCount = canonicalPeriodSnapshot.data()?.expectedOpportunityCount;
    const canonicalCoveredOpportunityCount = canonicalPeriodSnapshot.data()?.coveredOpportunityCount;
    const totalRemainingCount = typeof canonicalExpectedOpportunityCount === 'number' &&
        typeof canonicalCoveredOpportunityCount === 'number'
        ? Math.max(canonicalExpectedOpportunityCount - canonicalCoveredOpportunityCount, 0)
        : activeMemberUids.reduce((total, memberUid) => total +
            Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0), 0);
    const circleTitle = asCleanString(circle?.title) ?? 'Your circle';
    const coverageRevision = typeof checkIn.coverageRevision === 'number' ? checkIn.coverageRevision : 1;
    const sourceKey = getCheckInEffectSourceKey(circleId, dateKey, uid);
    const actor = {
        avatarUrl: asCleanString(checkIn.avatarUrl) ?? null,
        displayName: asCleanString(checkIn.displayName) ?? 'Someone',
        handle: asCleanString(checkIn.handle) ?? null,
        uid,
    };
    const memberTargets = isPersonal
        ? []
        : await (0, notifications_1.resolveCircleActivityTargets)({
            actorUid: uid,
            circle,
            circleId,
        });
    const mediaImageUrl = asCleanString(checkIn.photoUrl);
    const note = asCleanString(checkIn.note);
    const circleCompleteTargetUids = (0, notification_plan_1.getCircleCompleteNotificationTargets)({
        activeMemberUids,
        remainingTapIns: totalRemainingCount,
    });
    const circleActivityIds = [];
    let milestoneKeys = [];
    if (status === 'done' && !isPersonal) {
        circleActivityIds.push(`tap_in_${dateKey}_${uid}`);
        await (0, thread_1.createCircleThreadActivity)({
            actor,
            circleId,
            createdAt: checkIn.createdAt,
            itemId: `tap_in_${dateKey}_${uid}`,
            mediaImageUrl,
            note,
            text: `${actor.displayName} tapped in`,
            tone: 'success',
            type: 'tap_in',
        }).catch(error => console.error('create_thread_tap_in_activity_failed', error));
        await Promise.all(memberTargets.map(target => (0, notifications_1.notifyMemberTappedIn)({
            actor,
            circleId,
            circleTitle,
            dateKey,
            mediaImageUrl: target.canViewMedia ? mediaImageUrl : undefined,
            targetUid: target.uid,
            sourceKey,
            sourceRevision: coverageRevision,
        }))).catch(error => console.error('notify_member_tapped_in_failed', error));
    }
    if (status === 'skip' && !isPersonal) {
        await (0, notifications_1.notifyMemberSkipped)({
            actor,
            circle,
            circleId,
            circleTitle,
            dateKey,
            sourceKey,
            sourceRevision: coverageRevision,
        }).catch(error => console.error('notify_member_skipped_failed', error));
    }
    if (momentumSummary) {
        const milestoneEvents = (0, notifications_1.getMemberMilestoneEvents)({
            metrics,
            priorMetrics,
            priorSummary: priorMomentumSummary,
            summary: momentumSummary,
        });
        milestoneKeys = milestoneEvents.map(event => event.key);
        const streakMilestones = milestoneEvents.filter(event => event.type === notification_compat_1.legacyCircleActivityNotificationTypes.streakMilestone);
        if (!isPersonal) {
            circleActivityIds.push(...streakMilestones.map(event => `streak_${dateKey}_${uid}_${event.key}`));
            await Promise.all(streakMilestones.map(event => (0, thread_1.createCircleThreadActivity)({
                actor,
                circleId,
                createdAt: checkIn.createdAt,
                itemId: `streak_${dateKey}_${uid}_${event.key}`,
                text: (0, thread_1.getCircleThreadStreakText)(actor.displayName, event.streakDays),
                tone: 'alert',
                type: 'streak_milestone',
            }))).catch(error => console.error('create_thread_streak_activity_failed', error));
        }
        await (0, notifications_1.notifyMemberMilestones)({
            actor,
            circle,
            circleId,
            dateKey,
            events: milestoneEvents,
            sourceKey,
            sourceRevision: coverageRevision,
            targetUid: uid,
        }).catch(error => console.error('notify_member_milestones_failed', error));
    }
    if (!isPersonal && circleCompleteTargetUids.length > 0) {
        await Promise.all(circleCompleteTargetUids.map(targetUid => (0, notifications_1.notifyCircleComplete)({
            actorUid: uid,
            circleId,
            circleTitle,
            commitmentPace,
            periodKey,
            sourceKey,
            sourceRevision: coverageRevision,
            targetUid,
        }))).catch(error => console.error('notify_circle_complete_failed', error));
    }
    const effectRef = circleRef
        .collection('checkInEffects')
        .doc(`${dateKey}_${uid}`);
    const effectPayload = {
        active: true,
        circleActivityIds,
        circleCompletionTargetUids: circleCompleteTargetUids,
        coverageRevision,
        milestoneKeys,
        notificationSourceKey: sourceKey,
        periodKey,
        sourceKey,
        status,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await Promise.all([
        effectRef.set(effectPayload, { merge: true }),
        effectRef
            .collection('revisions')
            .doc(String(coverageRevision))
            .set({
            ...effectPayload,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true }),
    ]);
}
async function submitTapInHandler(request) {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = submitTapInSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        if (memberSnapshot.data()?.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
        }
        const circle = circleSnapshot.data();
        (0, circle_lifecycle_1.ensureActiveCircle)(circle, 'tapping in');
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const effectRef = circleRef
            .collection('checkInEffects')
            .doc(`${dateKey}_${uid}`);
        const [checkInSnapshot, effectSnapshot] = await Promise.all([
            transaction.get(checkInRef),
            transaction.get(effectRef),
        ]);
        const existingCheckIn = checkInSnapshot.data();
        const existingCovered = (0, commitments_1.isCoveredCheckInData)(existingCheckIn);
        const coveredOutcomeChanged = (0, reconciliation_1.isCoveredOutcomeChange)({
            existingCheckIn,
            nextStatus: input.status,
        });
        const quantityUpdateAllowed = input.status === 'done' &&
            checkInSnapshot.exists &&
            canUpdateQuantityTapIn(circle) &&
            existingCheckIn?.status !== 'skip';
        const coveredOutcomeUpdateAllowed = checkInSnapshot.exists && existingCovered && coveredOutcomeChanged;
        if (checkInSnapshot.exists &&
            !quantityUpdateAllowed &&
            !coveredOutcomeUpdateAllowed) {
            throw new https_1.HttpsError('already-exists', 'You already tapped in today.');
        }
        if (input.status === 'skip') {
            const skipRule = circle?.graceRules?.skip;
            const graceRule = {
                allowance: typeof skipRule?.allowance === 'number' ? skipRule.allowance : 0,
                windowDays: typeof skipRule?.windowDays === 'number' ? skipRule.windowDays : 1,
            };
            const rollingDateKeys = (0, grace_1.getRollingDateKeys)(dateKey, graceRule.windowDays);
            const priorSkipSnapshots = await Promise.all(rollingDateKeys.map(windowDateKey => transaction.get(circleRef
                .collection('days')
                .doc(windowDateKey)
                .collection('checkIns')
                .doc(uid))));
            const priorSkipCount = priorSkipSnapshots.filter(snapshot => snapshot.data()?.status === 'skip').length;
            if (!(0, grace_1.canUseSkipGrace)({ graceRule, priorSkipCount })) {
                throw new https_1.HttpsError('resource-exhausted', 'No skips are available for this grace window.');
            }
        }
        const currentValue = input.status === 'done'
            ? getTapInCurrentValue({
                circle,
                existingValue: existingCheckIn?.currentValue,
                inputValue: input.currentValue,
            })
            : undefined;
        const coverageStatus = (0, commitments_1.getCoverageStatusForTapIn)({
            circle,
            currentValue,
            status: input.status,
        });
        const nextStatus = (0, commitments_1.getCheckInStatusForCoverage)(coverageStatus);
        const nextCovered = coverageStatus === 'covered' || coverageStatus === 'skipped';
        const coverageRevision = (0, reconciliation_1.getNextCoverageRevision)({
            existingCovered,
            existingRevision: existingCheckIn?.coverageRevision,
            ledgerRevision: effectSnapshot.data()?.coverageRevision,
            nextCovered,
        });
        const quantityConfig = (0, commitments_1.getQuantityConfig)(circle);
        const commitmentType = (0, commitments_1.getCommitmentType)(circle);
        if (nextCovered && (!existingCovered || coveredOutcomeChanged)) {
            await (0, momentum_1.recordTapInOpportunity)({
                checkInId: uid,
                circle,
                circleId: input.circleId,
                dateKey,
                memberCount: typeof circle?.memberCount === 'number'
                    ? circle.memberCount
                    : undefined,
                member: memberSnapshot.data(),
                profile,
                status: nextStatus === 'skip' ? 'skip' : 'done',
                transaction,
                uid,
            });
        }
        else if (!nextCovered && existingCovered) {
            await (0, momentum_1.removeTapInOpportunity)({
                circle,
                circleId: input.circleId,
                dateKey,
                transaction,
                uid,
            });
        }
        const checkInPayload = {
            avatarUrl: profile.avatarUrl ?? null,
            coverageStatus,
            coverageRevision,
            circleId: input.circleId,
            displayName: profile.displayName,
            handle: profile.handle,
            note: input.note ?? null,
            photoUrl: input.photoUrl ?? null,
            status: nextStatus,
            uid,
            updatedAt: now,
        };
        if (!checkInSnapshot.exists) {
            checkInPayload.createdAt = now;
        }
        if (input.status === 'done') {
            checkInPayload.commitmentType = commitmentType;
            checkInPayload.currentValue = currentValue;
            checkInPayload.stepValue = quantityConfig.stepValue;
            checkInPayload.unitLabel = quantityConfig.unitLabel;
            if (typeof quantityConfig.targetValue === 'number') {
                checkInPayload.targetValue = quantityConfig.targetValue;
            }
            else {
                checkInPayload.targetValue = firestore_1.FieldValue.delete();
            }
            if (typeof quantityConfig.maximumValue === 'number') {
                checkInPayload.maximumValue = quantityConfig.maximumValue;
            }
            else {
                checkInPayload.maximumValue = firestore_1.FieldValue.delete();
            }
            if (typeof quantityConfig.minimumValue === 'number') {
                checkInPayload.minimumValue = quantityConfig.minimumValue;
            }
            else {
                checkInPayload.minimumValue = firestore_1.FieldValue.delete();
            }
        }
        else {
            checkInPayload.commitmentType = commitmentType;
            checkInPayload.currentValue = firestore_1.FieldValue.delete();
            checkInPayload.maximumValue = firestore_1.FieldValue.delete();
            checkInPayload.minimumValue = firestore_1.FieldValue.delete();
            checkInPayload.stepValue = firestore_1.FieldValue.delete();
            checkInPayload.targetValue = firestore_1.FieldValue.delete();
            checkInPayload.unitLabel = firestore_1.FieldValue.delete();
        }
        transaction.set(checkInRef, checkInPayload, { merge: true });
        if (nextCovered && !existingCovered) {
            transaction.set(effectRef, {
                active: false,
                coverageRevision,
                pending: true,
                sourceKey: getCheckInEffectSourceKey(input.circleId, dateKey, uid),
                updatedAt: now,
            }, { merge: true });
        }
        transaction.set(circleRef.collection('days').doc(dateKey), {
            checkInCount: firestore_1.FieldValue.increment(nextCovered === existingCovered ? 0 : nextCovered ? 1 : -1),
            dateKey,
            updatedAt: now,
        }, { merge: true });
        transaction.set(firebase_1.db.collection('userPrivate').doc(uid), {
            lastTapInAt: now,
        }, { merge: true });
        return {
            checkInId: uid,
            coverageStatus,
            currentValue,
            dateKey,
            coverageRevision,
            checkInPath: checkInRef.path,
            shouldReportMomentum: nextCovered && !existingCovered,
            status: nextStatus,
        };
    });
    const momentum = result.shouldReportMomentum
        ? await Promise.all([
            (0, profile_1.calculatePersonalMetricsForUser)({ profile, uid }),
            (0, profile_1.calculatePersonalMetricsForUser)({
                excludedCheckInPath: result.checkInPath,
                profile,
                uid,
            }),
        ]).then(([currentMetrics, priorMetrics]) => ({
            ...(0, profile_1.getPersonalStreakTransition)({ currentMetrics, priorMetrics }),
        }))
        : undefined;
    return {
        checkInId: result.checkInId,
        coverageStatus: result.coverageStatus,
        currentValue: result.currentValue,
        dateKey: result.dateKey,
        momentum,
        coverageRevision: result.coverageRevision,
        status: result.status,
    };
}
exports.submitTapIn = (0, https_1.onCall)(submitTapInHandler);
async function updateTapInDetailsHandler(request) {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = updateTapInDetailsSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        (0, circle_lifecycle_1.ensureActiveCircle)(circle, 'editing this Tap In');
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const checkInSnapshot = await transaction.get(checkInRef);
        const patch = (0, details_1.getTapInDetailsPatch)({
            checkInExists: checkInSnapshot.exists,
            checkInStatus: checkInSnapshot.data()?.status,
            memberStatus: memberSnapshot.data()?.status,
            note: input.note,
            photoUrl: input.photoUrl,
        });
        const shouldDeletePhoto = Boolean(checkInSnapshot.data()?.photoUrl) && patch.photoUrl === null;
        transaction.set(checkInRef, {
            ...patch,
            updatedAt: now,
        }, { merge: true });
        return {
            dateKey,
            note: patch.note,
            photoUrl: patch.photoUrl,
            shouldDeletePhoto,
        };
    });
    if (result.shouldDeletePhoto) {
        await (0, storage_1.getStorage)()
            .bucket()
            .deleteFiles({
            force: true,
            prefix: `circles/${input.circleId}/check-ins/${result.dateKey}/${uid}/proof.jpg`,
        })
            .catch(error => console.error('delete_tap_in_proof_failed', {
            circleId: input.circleId,
            dateKey: result.dateKey,
            error,
            uid,
        }));
    }
    return {
        dateKey: result.dateKey,
        note: result.note,
        photoUrl: result.photoUrl,
    };
}
exports.updateTapInDetails = (0, https_1.onCall)(updateTapInDetailsHandler);
exports.processTapInSideEffects = (0, firestore_2.onDocumentWritten)({
    document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}',
    secrets: [notifications_1.oneSignalRestApiKey],
}, async (event) => {
    const checkIn = event.data?.after.data();
    const priorCheckIn = event.data?.before.data();
    const status = checkIn?.status;
    const wasCovered = (0, commitments_1.isCoveredCheckInData)(priorCheckIn);
    const isCovered = (0, commitments_1.isCoveredCheckInData)(checkIn);
    if (wasCovered && !isCovered) {
        await retractTapInEffects({
            accountDeletion: priorCheckIn?.deletionReason === 'account',
            circleId: event.params.circleId,
            dateKey: event.params.dateKey,
            uid: event.params.uid,
        });
        return;
    }
    if (wasCovered && isCovered && checkIn) {
        await updateCoveredTapInActivity({
            checkIn,
            circleId: event.params.circleId,
            dateKey: event.params.dateKey,
            uid: event.params.uid,
        });
        if ((0, reconciliation_1.getCreditedOutcomeStatus)(priorCheckIn) !==
            (0, reconciliation_1.getCreditedOutcomeStatus)(checkIn)) {
            await reconcileCorrectedMetricEffects({
                circleId: event.params.circleId,
                dateKey: event.params.dateKey,
                uid: event.params.uid,
            });
        }
        return;
    }
    if (!checkIn || !isCovered || (status !== 'done' && status !== 'skip')) {
        return;
    }
    await processTapInSideEffectsForCheckIn({
        checkIn,
        circleId: event.params.circleId,
        dateKey: event.params.dateKey,
        status,
        uid: event.params.uid,
    });
});
exports.removeTapIn = (0, https_1.onCall)(async (request) => {
    const input = removeTapInSchema.parse(request.data);
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid, input.idToken);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        (0, circle_lifecycle_1.ensureActiveCircle)(circle, 'removing this Tap In');
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const checkInSnapshot = await transaction.get(checkInRef);
        const checkIn = checkInSnapshot.data();
        const decision = (0, remove_1.getRemoveTapInDecision)({
            coverageStatus: checkIn?.coverageStatus,
            checkInStatus: checkIn?.status,
            memberStatus: memberSnapshot.data()?.status,
        });
        if (!decision.removed) {
            return { dateKey, removed: false };
        }
        if (decision.checkInCountDelta < 0) {
            await (0, momentum_1.removeTapInOpportunity)({
                circle,
                circleId: input.circleId,
                dateKey,
                transaction,
                uid,
            });
        }
        transaction.delete(checkInRef);
        transaction.set(circleRef.collection('days').doc(dateKey), {
            checkInCount: firestore_1.FieldValue.increment(decision.checkInCountDelta),
            dateKey,
            updatedAt: now,
        }, { merge: true });
        return { dateKey, removed: true };
    });
    if (result.removed) {
        await (0, momentum_1.recalculateMomentumSummaryForUser)(uid).catch(error => console.error('recalculate_momentum_summary_failed', error));
    }
    return result;
});
