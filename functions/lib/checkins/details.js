"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTapInDetailsPatch = getTapInDetailsPatch;
const https_1 = require("firebase-functions/v2/https");
function getTapInDetailsPatch({ checkInExists, checkInStatus, memberStatus, note, photoUrl, }) {
    if (memberStatus !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
    }
    if (!checkInExists) {
        throw new https_1.HttpsError('not-found', "Today's Tap In was not found.");
    }
    if (checkInStatus !== 'done' &&
        checkInStatus !== 'partial' &&
        checkInStatus !== 'failed') {
        throw new https_1.HttpsError('failed-precondition', 'Details can only be added to a Tap In.');
    }
    return {
        note: note && note.length > 0 ? note : null,
        photoUrl,
    };
}
