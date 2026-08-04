"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCircleLifecycleStatus = getCircleLifecycleStatus;
exports.ensureActiveCircle = ensureActiveCircle;
exports.getCircleResumeAfterDateKey = getCircleResumeAfterDateKey;
exports.isCircleSlotAfterResumeBoundary = isCircleSlotAfterResumeBoundary;
const https_1 = require("firebase-functions/v2/https");
function getCircleLifecycleStatus(circle) {
    if (circle &&
        typeof circle === 'object' &&
        'lifecycleStatus' in circle &&
        circle.lifecycleStatus === 'archived') {
        return 'archived';
    }
    return 'active';
}
function ensureActiveCircle(circle, operation) {
    if (getCircleLifecycleStatus(circle) === 'archived') {
        throw new https_1.HttpsError('failed-precondition', `Restore this commitment before ${operation}.`);
    }
}
function getCircleResumeAfterDateKey(circle) {
    if (!circle || typeof circle !== 'object') {
        return undefined;
    }
    const value = 'opportunitiesResumeAfterDateKey' in circle
        ? circle.opportunitiesResumeAfterDateKey
        : undefined;
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function isCircleSlotAfterResumeBoundary(circle, availableDateKey) {
    const resumeAfterDateKey = getCircleResumeAfterDateKey(circle);
    return !resumeAfterDateKey || availableDateKey > resumeAfterDateKey;
}
