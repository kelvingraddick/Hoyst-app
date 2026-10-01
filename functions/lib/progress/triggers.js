"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileProgressRestore = exports.reconcileProgressReminders = exports.reconcileProgressMembership = exports.initializeProgressAccount = exports.reconcileProgressTapIn = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const restores_1 = require("./restores");
const index_1 = require("./index");
const momentum_1 = require("../momentum");
const commitments_1 = require("../shared/commitments");
async function reconcileEligible(uid, successful = false, sourceEventId) {
    try {
        return await (0, index_1.reconcileProgress)(uid, successful, sourceEventId);
    }
    catch (error) {
        if (error instanceof https_1.HttpsError &&
            (error.code === 'failed-precondition' || error.code === 'unauthenticated'))
            return;
        throw error;
    }
}
exports.reconcileProgressTapIn = (0, firestore_1.onDocumentWritten)({ document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true }, async (event) => {
    const before = event.data?.before.data(), after = event.data?.after.data();
    if (after?.uid !== event.params.uid ||
        after?.status !== 'done' ||
        !(0, commitments_1.isCoveredCheckInData)(after) ||
        (before?.status === 'done' && (0, commitments_1.isCoveredCheckInData)(before)))
        return;
    await (0, momentum_1.recalculateMomentumSummaryForUser)(event.params.uid);
    await reconcileEligible(event.params.uid, true, after.progressEventId);
});
exports.initializeProgressAccount = (0, firestore_1.onDocumentWritten)({ document: 'users/{uid}', retry: true }, async (event) => {
    if (event.data?.after.data()?.onboardingStatus !== 'complete' ||
        event.data?.before.data()?.onboardingStatus === 'complete')
        return;
    await reconcileEligible(event.params.uid);
});
exports.reconcileProgressMembership = (0, firestore_1.onDocumentWritten)({ document: 'circles/{circleId}/members/{uid}', retry: true }, async (event) => {
    if (event.data?.after.data()?.status !== 'active' ||
        event.data?.before.data()?.status === 'active')
        return;
    await reconcileEligible(event.params.uid);
});
exports.reconcileProgressReminders = (0, firestore_1.onDocumentWritten)({ document: 'userPrivate/{uid}', retry: true }, async (event) => {
    const saved = event.data?.after
        .data()
        ?.reminderPreferenceSavedAt?.toMillis?.();
    if (!saved ||
        saved ===
            event.data?.before.data()?.reminderPreferenceSavedAt?.toMillis?.())
        return;
    await reconcileEligible(event.params.uid);
});
exports.reconcileProgressRestore = (0, firestore_1.onDocumentWritten)({ document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true }, async (event) => {
    const before = event.data?.before.data(), after = event.data?.after.data();
    if (after?.protectionKind !== 'restore' ||
        before?.protectionKind === 'restore')
        return;
    await (0, restores_1.reconcileRestoreEffects)(event.params.uid, event.params.circleId, event.params.dateKey);
});
