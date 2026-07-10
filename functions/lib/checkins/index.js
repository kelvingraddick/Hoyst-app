"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTapIn = exports.processTapInSideEffects = exports.submitTapIn = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const grace_1 = require("./grace");
const remove_1 = require("./remove");
const momentum_1 = require("../momentum");
const notifications_1 = require("../notifications");
const commitments_1 = require("../shared/commitments");
const thread_1 = require("../thread");
const notification_plan_1 = require("./notification-plan");
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
function getCommitmentPeriodDateKeys(cadence, timezone, now = new Date()) {
    if (cadence === 'daily') {
        return [getDateKeyForDate(timezone, now)];
    }
    if (cadence === 'monthly') {
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
    const momentumSummary = await (0, momentum_1.recalculateMomentumSummaryForUser)(uid).catch(error => {
        console.error('recalculate_momentum_summary_failed', error);
        return undefined;
    });
    const [circleSnapshot, memberSnapshots] = await Promise.all([
        circleRef.get(),
        circleRef.collection('members').where('status', '==', 'active').get(),
    ]);
    const circle = circleSnapshot.data();
    const timezone = asCleanString(circle?.timezone) ?? 'UTC';
    const commitmentCadence = (0, commitments_1.getCommitmentCadence)(circle);
    const requiredTapIns = (0, commitments_1.getRequiredTapIns)(circle);
    const periodDateKeys = getCommitmentPeriodDateKeys(commitmentCadence, timezone);
    const periodCheckInSnapshots = await Promise.all(periodDateKeys.map(periodDateKey => circleRef
        .collection('days')
        .doc(periodDateKey)
        .collection('checkIns')
        .get()));
    const coveredCounts = new Map();
    const todaySnapshotIndex = periodDateKeys.indexOf(dateKey);
    const todayCheckInSnapshot = periodCheckInSnapshots[todaySnapshotIndex >= 0 ? todaySnapshotIndex : 0];
    const scoringSnapshots = commitmentCadence === 'daily' && todayCheckInSnapshot
        ? [todayCheckInSnapshot]
        : periodCheckInSnapshots;
    scoringSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if ((0, commitments_1.isCoveredCheckInData)(doc.data())) {
                coveredCounts.set(doc.id, (coveredCounts.get(doc.id) ?? 0) + 1);
            }
        });
    });
    const pendingMembers = memberSnapshots.docs
        .map(snapshot => snapshot.data())
        .filter(memberData => {
        const memberUid = memberData.uid;
        return (typeof memberUid === 'string' &&
            memberUid !== uid &&
            (coveredCounts.get(memberUid) ?? 0) < requiredTapIns);
    });
    const remainingCount = pendingMembers.reduce((total, memberData) => {
        const memberUid = memberData.uid;
        return typeof memberUid === 'string'
            ? total +
                Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0)
            : total;
    }, 0);
    const activeMemberUids = memberSnapshots.docs
        .map(snapshot => {
        const memberUid = snapshot.data().uid;
        return typeof memberUid === 'string' && memberUid.trim().length > 0
            ? memberUid
            : snapshot.id;
    })
        .filter(Boolean);
    const totalRemainingCount = activeMemberUids.reduce((total, memberUid) => total + Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0), 0);
    const periodKey = commitmentCadence === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
    const circleTitle = asCleanString(circle?.title) ?? 'Your circle';
    const actor = {
        avatarUrl: asCleanString(checkIn.avatarUrl) ?? null,
        displayName: asCleanString(checkIn.displayName) ?? 'Someone',
        handle: asCleanString(checkIn.handle) ?? null,
        uid,
    };
    const companionTargets = await (0, notifications_1.resolveCompanionFeedTargets)({
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
    if (status === 'done') {
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
        await Promise.all(companionTargets.map(target => (0, notifications_1.notifyCompanionTappedIn)({
            actor,
            circleId,
            circleTitle,
            dateKey,
            mediaImageUrl: target.canViewMedia ? mediaImageUrl : undefined,
            targetUid: target.uid,
        }))).catch(error => console.error('notify_companion_tapped_in_failed', error));
    }
    if (status === 'skip') {
        await (0, notifications_1.notifyCompanionSkipped)({
            actor,
            circle,
            circleId,
            circleTitle,
            dateKey,
        }).catch(error => console.error('notify_companion_skipped_failed', error));
    }
    if (momentumSummary) {
        const milestoneEvents = (0, notifications_1.getCompanionMilestoneEvents)({
            priorSummary: priorMomentumSummary,
            summary: momentumSummary,
        });
        const streakMilestones = milestoneEvents.filter(event => event.type === 'companion_streak_milestone');
        await Promise.all(streakMilestones.map(event => (0, thread_1.createCircleThreadActivity)({
            actor,
            circleId,
            createdAt: checkIn.createdAt,
            itemId: `streak_${dateKey}_${uid}_${event.key}`,
            text: (0, thread_1.getCircleThreadStreakText)(event.streakDays),
            tone: 'alert',
            type: 'streak_milestone',
        }))).catch(error => console.error('create_thread_streak_activity_failed', error));
        await (0, notifications_1.notifyCompanionMilestones)({
            actor,
            circle,
            circleId,
            dateKey,
            events: milestoneEvents,
            targetUid: uid,
        }).catch(error => console.error('notify_companion_milestones_failed', error));
    }
    if (circleCompleteTargetUids.length > 0) {
        await Promise.all(circleCompleteTargetUids.map(targetUid => (0, notifications_1.notifyCircleComplete)({
            actorUid: uid,
            circleId,
            circleTitle,
            commitmentCadence,
            periodKey,
            targetUid,
        }))).catch(error => console.error('notify_circle_complete_failed', error));
    }
    if (remainingCount > 0 && remainingCount <= 2) {
        await Promise.all(pendingMembers.map(memberData => (0, notifications_1.notifyCircleAtRisk)({
            commitmentCadence,
            circleId,
            circleTitle,
            periodKey,
            remainingCount,
            targetUid: memberData.uid,
        }))).catch(error => console.error('notify_circle_at_risk_failed', error));
    }
}
async function submitTapInHandler(request) {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = submitTapInSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    return firebase_1.db.runTransaction(async (transaction) => {
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
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const checkInSnapshot = await transaction.get(checkInRef);
        const existingCheckIn = checkInSnapshot.data();
        const existingCovered = (0, commitments_1.isCoveredCheckInData)(existingCheckIn);
        const quantityUpdateAllowed = input.status === 'done' &&
            checkInSnapshot.exists &&
            canUpdateQuantityTapIn(circle) &&
            existingCheckIn?.status !== 'skip';
        if (checkInSnapshot.exists && !quantityUpdateAllowed) {
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
        const quantityConfig = (0, commitments_1.getQuantityConfig)(circle);
        const commitmentType = (0, commitments_1.getCommitmentType)(circle);
        let momentum;
        if (nextCovered && !existingCovered) {
            momentum = await (0, momentum_1.getTapInMomentumPreview)({
                circle,
                circleId: input.circleId,
                dateKey,
                status: nextStatus === 'skip' ? 'skip' : 'done',
                transaction,
                uid,
            });
            await (0, momentum_1.recordTapInOpportunity)({
                checkInId: uid,
                circle,
                circleId: input.circleId,
                dateKey,
                memberCount: typeof circle?.memberCount === 'number'
                    ? circle.memberCount
                    : undefined,
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
            momentum,
            status: nextStatus,
        };
    });
}
exports.submitTapIn = (0, https_1.onCall)(submitTapInHandler);
exports.processTapInSideEffects = (0, firestore_2.onDocumentWritten)({
    document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}',
    secrets: [notifications_1.oneSignalRestApiKey],
}, async (event) => {
    const checkIn = event.data?.after.data();
    const priorCheckIn = event.data?.before.data();
    const status = checkIn?.status;
    if (!checkIn ||
        !(0, commitments_1.isCoveredCheckInData)(checkIn) ||
        (0, commitments_1.isCoveredCheckInData)(priorCheckIn) ||
        (status !== 'done' && status !== 'skip')) {
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
