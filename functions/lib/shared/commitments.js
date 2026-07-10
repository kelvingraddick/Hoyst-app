"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampOpportunitiesPerPeriod = clampOpportunitiesPerPeriod;
exports.getCommitmentType = getCommitmentType;
exports.getQuantityConfig = getQuantityConfig;
exports.isSingleTapInCommitment = isSingleTapInCommitment;
exports.getCoverageStatusForTapIn = getCoverageStatusForTapIn;
exports.getCheckInStatusForCoverage = getCheckInStatusForCoverage;
exports.isCoveredCheckInData = isCoveredCheckInData;
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
function clampPositiveNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.round(value))
        : fallback;
}
function clampStepValue() {
    return 1;
}
function getUnitLabel(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim().slice(0, 32)
        : 'Tap In';
}
function getCommitmentType(circle) {
    const value = circle?.commitmentType;
    if (value === 'limit' || value === 'avoid' || value === 'build') {
        return value;
    }
    return 'build';
}
function getQuantityConfig(circle) {
    const commitmentType = getCommitmentType(circle);
    const stepValue = clampStepValue();
    const unitLabel = getUnitLabel(circle?.unitLabel);
    if (commitmentType === 'avoid') {
        return { stepValue: 1, targetValue: 1, unitLabel };
    }
    if (commitmentType === 'limit') {
        const maximumValue = clampPositiveNumber(circle?.maximumValue ?? circle?.targetValue, 1);
        const minimumValue = typeof circle?.minimumValue === 'number' &&
            Number.isFinite(circle.minimumValue)
            ? Math.max(0, Math.round(Math.min(circle.minimumValue, maximumValue)))
            : undefined;
        return {
            maximumValue,
            ...(typeof minimumValue === 'number' ? { minimumValue } : {}),
            stepValue,
            unitLabel,
        };
    }
    return {
        stepValue,
        targetValue: clampPositiveNumber(circle?.targetValue, 1),
        unitLabel,
    };
}
function isSingleTapInCommitment(circle) {
    const commitmentType = getCommitmentType(circle);
    const quantityConfig = getQuantityConfig(circle);
    return (commitmentType === 'build' &&
        (quantityConfig.targetValue ?? 1) <= 1 &&
        quantityConfig.stepValue === 1);
}
function getCoverageStatusForTapIn({ circle, currentValue, status, }) {
    if (status === 'skip') {
        return 'skipped';
    }
    const commitmentType = getCommitmentType(circle);
    const quantityConfig = getQuantityConfig(circle);
    if (commitmentType === 'avoid' || isSingleTapInCommitment(circle)) {
        return 'covered';
    }
    const value = clampPositiveNumber(currentValue, 0);
    if (commitmentType === 'limit') {
        const maximumValue = quantityConfig.maximumValue ?? 1;
        const minimumValue = quantityConfig.minimumValue;
        if ((typeof minimumValue === 'number' && value < minimumValue) ||
            value > maximumValue) {
            return 'failed';
        }
        return 'covered';
    }
    return value >= (quantityConfig.targetValue ?? 1) ? 'covered' : 'partial';
}
function getCheckInStatusForCoverage(coverageStatus) {
    if (coverageStatus === 'skipped') {
        return 'skip';
    }
    if (coverageStatus === 'covered') {
        return 'done';
    }
    return coverageStatus;
}
function isCoveredCheckInData(checkIn) {
    if (!checkIn) {
        return false;
    }
    if (checkIn.status === 'skip') {
        return true;
    }
    if (checkIn.status !== 'done') {
        return false;
    }
    return (checkIn.coverageStatus === undefined || checkIn.coverageStatus === 'covered');
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
