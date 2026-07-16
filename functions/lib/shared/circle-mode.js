"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCircleMode = getCircleMode;
exports.ensureGroupCircle = ensureGroupCircle;
const https_1 = require("firebase-functions/v2/https");
function getCircleMode(circle) {
    if (circle &&
        typeof circle === 'object' &&
        'circleMode' in circle &&
        circle.circleMode === 'personal') {
        return 'personal';
    }
    return 'group';
}
function ensureGroupCircle(circle, operation) {
    if (getCircleMode(circle) === 'personal') {
        throw new https_1.HttpsError('failed-precondition', `Convert this personal commitment to a Circle before ${operation}.`);
    }
}
