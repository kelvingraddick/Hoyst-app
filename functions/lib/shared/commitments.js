"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampOpportunitiesPerPeriod = clampOpportunitiesPerPeriod;
exports.getTapInsPerWeek = getTapInsPerWeek;
exports.getCommitmentCadence = getCommitmentCadence;
exports.getRequiredTapIns = getRequiredTapIns;
exports.getStoredCommitmentFrequency = getStoredCommitmentFrequency;
exports.getInputCommitmentCadence = getInputCommitmentCadence;
function clampOpportunitiesPerPeriod(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(31, Math.max(1, Math.round(value)))
        : fallback;
}
function getTapInsPerWeek(circle) {
    const value = circle?.commitmentFrequency?.tapInsPerWeek;
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(7, Math.max(1, Math.round(value)))
        : 7;
}
function getCommitmentCadence(circle) {
    const value = circle?.commitmentCadence;
    if (value === 'daily' || value === 'weekly' || value === 'monthly') {
        return value;
    }
    return getTapInsPerWeek(circle) >= 7 ? 'daily' : 'weekly';
}
function getRequiredTapIns(circle) {
    const cadence = getCommitmentCadence(circle);
    if (cadence === 'daily') {
        return 1;
    }
    if (cadence === 'monthly') {
        return clampOpportunitiesPerPeriod(circle?.commitmentFrequency?.opportunitiesPerPeriod, getTapInsPerWeek(circle));
    }
    return getTapInsPerWeek(circle);
}
function getStoredCommitmentFrequency(cadence, frequency) {
    if (cadence === 'daily') {
        return { tapInsPerWeek: 7 };
    }
    const value = frequency?.tapInsPerWeek;
    const opportunitiesPerPeriod = cadence === 'monthly'
        ? clampOpportunitiesPerPeriod(frequency
            ?.opportunitiesPerPeriod, typeof value === 'number' && Number.isFinite(value)
            ? Math.min(7, Math.max(1, Math.round(value)))
            : 4)
        : undefined;
    return {
        ...(opportunitiesPerPeriod ? { opportunitiesPerPeriod } : {}),
        tapInsPerWeek: typeof value === 'number' && Number.isFinite(value)
            ? Math.min(7, Math.max(1, Math.round(value)))
            : 7,
    };
}
function getInputCommitmentCadence(cadence, frequency) {
    if (cadence === 'daily' || cadence === 'weekly' || cadence === 'monthly') {
        return cadence;
    }
    return getTapInsPerWeek({ commitmentFrequency: frequency }) >= 7
        ? 'daily'
        : 'weekly';
}
