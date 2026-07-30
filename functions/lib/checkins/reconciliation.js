"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextCoverageRevision = getNextCoverageRevision;
exports.getCreditedOutcomeStatus = getCreditedOutcomeStatus;
exports.isCoveredOutcomeChange = isCoveredOutcomeChange;
exports.shouldRetainCorrectedMetricEffect = shouldRetainCorrectedMetricEffect;
function getNextCoverageRevision({ existingCovered, existingRevision, ledgerRevision, nextCovered, }) {
    const priorRevision = Math.max(typeof existingRevision === 'number' && Number.isFinite(existingRevision)
        ? Math.max(0, Math.round(existingRevision))
        : 0, typeof ledgerRevision === 'number' && Number.isFinite(ledgerRevision)
        ? Math.max(0, Math.round(ledgerRevision))
        : 0);
    return nextCovered && !existingCovered ? priorRevision + 1 : priorRevision;
}
function getCreditedOutcomeStatus(checkIn) {
    if (checkIn?.status === 'skip' || checkIn?.coverageStatus === 'skipped') {
        return 'skip';
    }
    if (checkIn?.status === 'done' || checkIn?.coverageStatus === 'covered') {
        return 'done';
    }
    return undefined;
}
function isCoveredOutcomeChange({ existingCheckIn, nextStatus, }) {
    const existingStatus = getCreditedOutcomeStatus(existingCheckIn);
    return Boolean(existingStatus && existingStatus !== nextStatus);
}
const achievementThresholds = [
    { key: '7-days-straight', metric: 'longestStreakDays', threshold: 7 },
    { key: '10-day-streak', metric: 'longestStreakDays', threshold: 10 },
    { key: '20-day-streak', metric: 'longestStreakDays', threshold: 20 },
    { key: '30-day-streak', metric: 'longestStreakDays', threshold: 30 },
    { key: '50-taps', metric: 'totalTapIns', threshold: 50 },
];
const momentumStatusRanks = [
    'getting_started',
    'building_momentum',
    'strong_momentum',
    'peak_momentum',
];
function shouldRetainCorrectedMetricEffect({ currentStreakDays, effectId, longestStreakDays, rollingMomentumStatus, totalTapIns, type, }) {
    if (type === 'companion_achievement_unlocked') {
        const achievement = achievementThresholds.find(candidate => effectId.includes(candidate.key));
        const value = achievement?.metric === 'totalTapIns' ? totalTapIns : longestStreakDays;
        return Boolean(achievement && value >= achievement.threshold);
    }
    if (type === 'companion_streak_milestone' || type === 'streak_milestone') {
        const threshold = Number(effectId.match(/(\d+)-day-streak/)?.[1]);
        return Number.isFinite(threshold) && currentStreakDays >= threshold;
    }
    if (type === 'companion_momentum_level_up') {
        const targetRank = momentumStatusRanks.findIndex(status => effectId.includes(status));
        const currentRank = momentumStatusRanks.indexOf(rollingMomentumStatus ?? '');
        return targetRank >= 0 && currentRank >= targetRank;
    }
    return false;
}
