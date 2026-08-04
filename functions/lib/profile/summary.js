"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalStreakTransition = getPersonalStreakTransition;
exports.summarizeProfileCheckIns = summarizeProfileCheckIns;
exports.summarizeActiveCircleModes = summarizeActiveCircleModes;
exports.calculatePersonalMetricsForUser = calculatePersonalMetricsForUser;
const firebase_1 = require("../firebase");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const circle_mode_1 = require("../shared/circle-mode");
const commitments_1 = require("../shared/commitments");
const streak_1 = require("./streak");
function getPersonalStreakTransition({ currentMetrics, priorMetrics, }) {
    return {
        currentStreak: currentMetrics.personalStreakDays,
        streakDelta: currentMetrics.personalStreakDays - priorMetrics.personalStreakDays,
    };
}
function getMembershipCircleId(snapshot) {
    return snapshot.ref.parent.parent?.id;
}
function getCheckInCircleId(snapshot) {
    const dayRef = snapshot.ref.parent.parent;
    return dayRef?.parent.parent?.id;
}
function getCheckInDateKey(snapshot, timezone) {
    const data = snapshot.data();
    const createdAt = data.createdAt;
    if (createdAt?.toDate) {
        return (0, streak_1.getDateKey)(createdAt.toDate(), timezone);
    }
    return snapshot.ref.parent.parent?.id;
}
function summarizeProfileCheckIns({ activeCircleIds, checkInSnapshots, excludedCheckInPath, timezone, }) {
    const activeCoveredCheckInDateKeys = [];
    const coveredCheckInDateKeys = [];
    let totalTapIns = 0;
    checkInSnapshots.forEach(snapshot => {
        if (excludedCheckInPath && snapshot.ref.path === excludedCheckInPath) {
            return;
        }
        const checkIn = snapshot.data();
        const status = checkIn.status;
        if (status === 'done' && (0, commitments_1.isCoveredCheckInData)(checkIn)) {
            totalTapIns += 1;
        }
        if (!(0, commitments_1.isCoveredCheckInData)(checkIn)) {
            return;
        }
        const dateKey = getCheckInDateKey(snapshot, timezone);
        if (!dateKey) {
            return;
        }
        coveredCheckInDateKeys.push(dateKey);
        const circleId = getCheckInCircleId(snapshot);
        if (circleId && activeCircleIds.has(circleId)) {
            activeCoveredCheckInDateKeys.push(dateKey);
        }
    });
    return {
        activeCoveredCheckInDateKeys,
        coveredCheckInDateKeys,
        totalTapIns,
    };
}
function getProfileTimezone(profile) {
    return typeof profile?.timezone === 'string' && profile.timezone.trim()
        ? profile.timezone.trim()
        : 'UTC';
}
function summarizeActiveCircleModes(circles) {
    const activeCircles = circles.filter(circle => (0, circle_lifecycle_1.getCircleLifecycleStatus)(circle) === 'active');
    return {
        activeCircleCount: activeCircles.filter(circle => (0, circle_mode_1.getCircleMode)(circle) === 'group').length,
        activePersonalCommitmentCount: activeCircles.filter(circle => (0, circle_mode_1.getCircleMode)(circle) === 'personal').length,
    };
}
async function calculatePersonalMetricsForUser({ excludedCheckInPath, now = new Date(), profile, uid, }) {
    const resolvedProfile = profile ?? (await firebase_1.db.collection('users').doc(uid).get()).data();
    const timezone = getProfileTimezone(resolvedProfile);
    const membershipsSnapshot = await firebase_1.db
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();
    const activeCircleIds = new Set(membershipsSnapshot.docs
        .filter(snapshot => snapshot.data().status === 'active')
        .map(getMembershipCircleId)
        .filter((circleId) => Boolean(circleId)));
    const activeCircleSnapshots = await Promise.all(Array.from(activeCircleIds).map(circleId => firebase_1.db.collection('circles').doc(circleId).get()));
    const lifecycleActiveCircleSnapshots = activeCircleSnapshots.filter(snapshot => snapshot.exists && (0, circle_lifecycle_1.getCircleLifecycleStatus)(snapshot.data()) === 'active');
    const { activeCircleCount, activePersonalCommitmentCount } = summarizeActiveCircleModes(activeCircleSnapshots
        .filter(snapshot => snapshot.exists)
        .map(snapshot => snapshot.data()));
    const checkInsSnapshot = await firebase_1.db
        .collectionGroup('checkIns')
        .where('uid', '==', uid)
        .get();
    const { activeCoveredCheckInDateKeys, coveredCheckInDateKeys, totalTapIns } = summarizeProfileCheckIns({
        activeCircleIds: new Set(lifecycleActiveCircleSnapshots.map(snapshot => snapshot.id)),
        checkInSnapshots: checkInsSnapshot.docs,
        excludedCheckInPath,
        timezone,
    });
    const currentStreak = (0, streak_1.calculatePersonalDailyStreak)({
        checkInDateKeys: activeCoveredCheckInDateKeys,
        now,
        timezone,
    });
    return {
        activeCircleCount,
        activePersonalCommitmentCount,
        longestStreakDays: (0, streak_1.calculateLongestPersonalDailyStreak)({
            checkInDateKeys: coveredCheckInDateKeys,
        }),
        totalTapIns,
        ...currentStreak,
    };
}
