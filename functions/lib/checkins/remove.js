"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemoveTapInDecision = getRemoveTapInDecision;
const https_1 = require("firebase-functions/v2/https");
function getRemoveTapInDecision({ coverageStatus, checkInStatus, memberStatus, }) {
    if (memberStatus !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
    }
    if (checkInStatus !== 'done' &&
        checkInStatus !== 'skip' &&
        checkInStatus !== 'partial' &&
        checkInStatus !== 'failed') {
        return {
            checkInCountDelta: 0,
            removed: false,
        };
    }
    if (checkInStatus === 'partial' ||
        checkInStatus === 'failed' ||
        (checkInStatus === 'done' &&
            coverageStatus !== undefined &&
            coverageStatus !== 'covered')) {
        return {
            checkInCountDelta: 0,
            removed: true,
        };
    }
    return {
        checkInCountDelta: -1,
        removed: true,
    };
}
