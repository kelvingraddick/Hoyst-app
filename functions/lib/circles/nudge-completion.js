"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordNudgeCompletion = recordNudgeCompletion;
/** Only call after notifications succeed. A group send earns one daily receipt. */
async function recordNudgeCompletion(firestore, memberRef, nudged, sentAt) {
    if (nudged <= 0) {
        return;
    }
    await firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(memberRef);
        const previous = latest.data()?.lastNudgedAt?.toDate?.();
        // Concurrent sends must not move the receipt back across a day boundary.
        if (latest.exists && (!previous || previous.getTime() < sentAt.getTime())) {
            transaction.set(memberRef, { lastNudgedAt: sentAt }, { merge: true });
        }
    });
}
