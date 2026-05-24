"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTapInsPerWeek = getTapInsPerWeek;
exports.getCommitmentCadence = getCommitmentCadence;
exports.getRequiredTapIns = getRequiredTapIns;
exports.getStoredCommitmentFrequency = getStoredCommitmentFrequency;
exports.getInputCommitmentCadence = getInputCommitmentCadence;
function getTapInsPerWeek(circle) {
    const value = circle?.commitmentFrequency?.tapInsPerWeek;
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(7, Math.max(1, Math.round(value)))
        : 7;
}
function getCommitmentCadence(circle) {
    const value = circle?.commitmentCadence;
    if (value === 'daily' || value === 'weekly') {
        return value;
    }
    return getTapInsPerWeek(circle) >= 7 ? 'daily' : 'weekly';
}
function getRequiredTapIns(circle) {
    return getCommitmentCadence(circle) === 'daily' ? 1 : getTapInsPerWeek(circle);
}
function getStoredCommitmentFrequency(cadence, frequency) {
    if (cadence === 'daily') {
        return { tapInsPerWeek: 7 };
    }
    const value = frequency?.tapInsPerWeek;
    return {
        tapInsPerWeek: typeof value === 'number' && Number.isFinite(value)
            ? Math.min(7, Math.max(1, Math.round(value)))
            : 7,
    };
}
function getInputCommitmentCadence(cadence, frequency) {
    if (cadence === 'daily' || cadence === 'weekly') {
        return cadence;
    }
    return getTapInsPerWeek({ commitmentFrequency: frequency }) >= 7
        ? 'daily'
        : 'weekly';
}
