"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMemberExpectedForGroupDate = isMemberExpectedForGroupDate;
exports.calculateGroupDailyStreak = calculateGroupDailyStreak;
exports.reconcileCircleGroupStreak = reconcileCircleGroupStreak;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../firebase");
const commitments_1 = require("../shared/commitments");
const circle_mode_1 = require("../shared/circle-mode");
const streak_1 = require("../profile/streak");
function asDate(value) {
    if (value instanceof Date) {
        return value;
    }
    if (value && typeof value === 'object') {
        if ('toDate' in value &&
            typeof value.toDate === 'function') {
            return value.toDate();
        }
        if ('seconds' in value &&
            typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000);
        }
    }
    return undefined;
}
function getMembershipDateKey(value, timezone) {
    const date = asDate(value);
    return date ? (0, streak_1.getDateKey)(date, timezone) : undefined;
}
function isMemberExpectedForGroupDate({ dateKey, period, timezone, }) {
    const joinedDateKey = getMembershipDateKey(period.joinedAt, timezone);
    const leftDateKey = getMembershipDateKey(period.leftAt, timezone);
    if (!joinedDateKey) {
        return false;
    }
    const joinedBeforeDate = joinedDateKey < dateKey;
    const joinsCurrentDate = joinedDateKey === dateKey &&
        period.opportunityEligibility === 'include_current';
    const leftBeforeOrOnDate = Boolean(leftDateKey && leftDateKey <= dateKey);
    return (joinedBeforeDate || joinsCurrentDate) && !leftBeforeOrOnDate;
}
function calculateGroupDailyStreak({ completedDateKeys, now = new Date(), startDateKey, timezone, }) {
    const completed = new Set(completedDateKeys);
    const todayDateKey = (0, streak_1.getDateKey)(now, timezone);
    let cursor = completed.has(todayDateKey)
        ? todayDateKey
        : (0, streak_1.getPreviousDateKey)(todayDateKey);
    let groupStreakDays = 0;
    while (completed.has(cursor) && (!startDateKey || cursor >= startDateKey)) {
        groupStreakDays += 1;
        cursor = (0, streak_1.getPreviousDateKey)(cursor);
    }
    return groupStreakDays;
}
async function getMembershipPeriods(circleRef) {
    const historySnapshots = await circleRef
        .collection('membershipHistory')
        .get();
    if (historySnapshots.empty) {
        return { isKnown: false, periods: [] };
    }
    const periodSnapshots = await Promise.all(historySnapshots.docs.map(history => history.ref.collection('periods').get()));
    const periods = periodSnapshots.flatMap((snapshot, index) => {
        const history = historySnapshots.docs[index];
        const fallbackUid = history?.id ?? '';
        return snapshot.docs.flatMap(periodSnapshot => {
            const period = periodSnapshot.data();
            const uid = typeof period.uid === 'string' && period.uid.trim().length > 0
                ? period.uid
                : fallbackUid;
            return uid && period.joinedAt
                ? [
                    {
                        joinedAt: period.joinedAt,
                        leftAt: period.leftAt,
                        opportunityEligibility: period.opportunityEligibility,
                        uid,
                    },
                ]
                : [];
        });
    });
    return { isKnown: periods.length > 0, periods };
}
async function getGroupDayCoverage({ dateKey, periods, periodsKnown, timezone, dayRef, }) {
    if (!periodsKnown) {
        return {
            coveredMemberUids: [],
            expectedMemberUids: [],
            isKnown: false,
        };
    }
    const expectedMemberUids = Array.from(new Set(periods
        .filter(period => isMemberExpectedForGroupDate({ dateKey, period, timezone }))
        .map(period => period.uid))).sort();
    if (expectedMemberUids.length === 0) {
        return { coveredMemberUids: [], expectedMemberUids, isKnown: false };
    }
    const checkIns = await dayRef.collection('checkIns').get();
    const expectedUids = new Set(expectedMemberUids);
    const coveredMemberUids = checkIns.docs
        .filter(snapshot => (0, commitments_1.isCoveredCheckInData)(snapshot.data()))
        .map(snapshot => {
        const uid = snapshot.data().uid;
        return typeof uid === 'string' && uid.trim().length > 0
            ? uid
            : snapshot.id;
    })
        .filter(uid => expectedUids.has(uid));
    return {
        coveredMemberUids: Array.from(new Set(coveredMemberUids)).sort(),
        expectedMemberUids,
        isKnown: true,
    };
}
async function persistGroupDayCoverage({ dateKey, dayRef, periods, periodsKnown, timezone, }) {
    const coverage = await getGroupDayCoverage({
        dateKey,
        dayRef,
        periods,
        periodsKnown,
        timezone,
    });
    const isComplete = coverage.isKnown &&
        coverage.expectedMemberUids.length > 0 &&
        coverage.coveredMemberUids.length === coverage.expectedMemberUids.length;
    await dayRef.set({
        dateKey,
        groupStreakCohortKnown: coverage.isKnown,
        groupStreakComplete: isComplete,
        groupStreakCoveredMemberCount: coverage.coveredMemberUids.length,
        groupStreakCoveredMemberUids: coverage.coveredMemberUids,
        groupStreakExpectedMemberCount: coverage.expectedMemberUids.length,
        groupStreakExpectedMemberUids: coverage.expectedMemberUids,
        groupStreakUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return isComplete;
}
async function reconcileCircleGroupStreak({ circleId, dateKey, now = new Date(), }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const circleSnapshot = await circleRef.get();
    const circle = circleSnapshot.data();
    if (!circleSnapshot.exists || (0, circle_mode_1.getCircleMode)(circle) !== 'group') {
        return 0;
    }
    const timezone = typeof circle?.timezone === 'string' && circle.timezone.trim().length > 0
        ? circle.timezone
        : 'UTC';
    const { isKnown: periodsKnown, periods } = await getMembershipPeriods(circleRef);
    const todayDateKey = (0, streak_1.getDateKey)(now, timezone);
    const groupStreakStartDateKey = getMembershipDateKey(circle?.convertedAt, timezone);
    const affectedDateKey = dateKey ?? todayDateKey;
    const affectedDayRef = circleRef.collection('days').doc(affectedDateKey);
    const affectedDaySnapshot = await affectedDayRef.get();
    if (affectedDaySnapshot.exists &&
        (!groupStreakStartDateKey || affectedDateKey >= groupStreakStartDateKey)) {
        await persistGroupDayCoverage({
            dateKey: affectedDateKey,
            dayRef: affectedDayRef,
            periods,
            periodsKnown,
            timezone,
        });
    }
    const completedDateKeys = new Set();
    let cursor = todayDateKey;
    let firstDay = true;
    while (true) {
        if (groupStreakStartDateKey && cursor < groupStreakStartDateKey) {
            break;
        }
        const daySnapshot = await circleRef.collection('days').doc(cursor).get();
        const day = daySnapshot.data();
        const isComplete = day?.groupStreakComplete === true;
        const isKnown = day?.groupStreakCohortKnown === true;
        if (firstDay && !isComplete) {
            cursor = (0, streak_1.getPreviousDateKey)(cursor);
            firstDay = false;
            continue;
        }
        if (!isKnown || !isComplete) {
            break;
        }
        completedDateKeys.add(cursor);
        cursor = (0, streak_1.getPreviousDateKey)(cursor);
        firstDay = false;
    }
    const groupStreakDays = calculateGroupDailyStreak({
        completedDateKeys,
        now,
        startDateKey: groupStreakStartDateKey,
        timezone,
    });
    const write = {
        groupStreakDays,
        groupStreakUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await circleRef.set(write, { merge: true });
    if (circle?.privacy === 'public') {
        await firebase_1.db
            .collection('publicCircleIndex')
            .doc(circleId)
            .set(write, { merge: true });
    }
    return groupStreakDays;
}
