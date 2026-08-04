"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileSummary = exports.summarizeProfileCheckIns = exports.summarizeActiveCircleModes = exports.getPersonalStreakTransition = exports.calculatePersonalMetricsForUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const summary_1 = require("./summary");
var summary_2 = require("./summary");
Object.defineProperty(exports, "calculatePersonalMetricsForUser", { enumerable: true, get: function () { return summary_2.calculatePersonalMetricsForUser; } });
Object.defineProperty(exports, "getPersonalStreakTransition", { enumerable: true, get: function () { return summary_2.getPersonalStreakTransition; } });
Object.defineProperty(exports, "summarizeActiveCircleModes", { enumerable: true, get: function () { return summary_2.summarizeActiveCircleModes; } });
Object.defineProperty(exports, "summarizeProfileCheckIns", { enumerable: true, get: function () { return summary_2.summarizeProfileCheckIns; } });
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
exports.getProfileSummary = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    return (0, summary_1.calculatePersonalMetricsForUser)({ profile, uid });
});
