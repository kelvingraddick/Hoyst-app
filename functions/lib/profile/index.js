"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileSummary = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const streak_1 = require("./streak");
async function requireCompletedProfile(uid) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const snapshot = await firebase_1.db.collection('users').doc(uid).get();
    const profile = snapshot.data();
    if (!profile || profile.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { profile, uid };
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
exports.getProfileSummary = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const timezone = typeof profile.timezone === 'string' && profile.timezone.trim()
        ? profile.timezone
        : 'UTC';
    const membershipsSnapshot = await firebase_1.db
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();
    const activeCircleIds = new Set(membershipsSnapshot.docs
        .filter(snapshot => snapshot.data().status === 'active')
        .map(getMembershipCircleId)
        .filter((circleId) => Boolean(circleId)));
    if (activeCircleIds.size === 0) {
        return {
            activeCircleCount: 0,
            hasTappedInToday: false,
            personalStreakDays: 0,
        };
    }
    const checkInsSnapshot = await firebase_1.db
        .collectionGroup('checkIns')
        .where('uid', '==', uid)
        .get();
    const checkInDateKeys = checkInsSnapshot.docs
        .filter(snapshot => {
        const status = snapshot.data().status;
        return status === 'done' || status === 'skip';
    })
        .filter(snapshot => {
        const circleId = getCheckInCircleId(snapshot);
        return Boolean(circleId && activeCircleIds.has(circleId));
    })
        .map(snapshot => getCheckInDateKey(snapshot, timezone))
        .filter((dateKey) => Boolean(dateKey));
    const streak = (0, streak_1.calculatePersonalDailyStreak)({
        checkInDateKeys,
        timezone,
    });
    return {
        activeCircleCount: activeCircleIds.size,
        ...streak,
    };
});
