"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeTapInCompletion = void 0;
exports.processTapInCompletion = processTapInCompletion;
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const firebase_1 = require("../firebase");
const progress_1 = require("../circles/progress");
const summary_1 = require("../profile/summary");
const momentum_1 = require("../momentum");
const progress_2 = require("../progress");
/** Also callable by emulator tests. Duplicate deliveries may compute, but never credit twice. */
async function processTapInCompletion(ref) {
    const startedAt = Date.now();
    const snapshot = await ref.get();
    const job = snapshot.data();
    if (!job || job.status !== 'pending') {
        return;
    }
    const { uid, circleId, dateKey, completionId, checkInPath } = job;
    if (ref.path !== `userPrivate/${uid}/tapInCompletions/${completionId}` ||
        checkInPath !== `circles/${circleId}/days/${dateKey}/checkIns/${uid}`) {
        throw new Error('Invalid Tap In completion identity.');
    }
    const userRef = firebase_1.db.doc(`users/${uid}`);
    const checkInRef = firebase_1.db.doc(checkInPath);
    const [profile, checkIn] = await Promise.all([
        userRef.get(),
        checkInRef.get(),
    ]);
    if (!profile.exists || profile.data()?.accountDeletionStartedAt) {
        return;
    }
    const publish = async (data) => firebase_1.db.runTransaction(async (transaction) => {
        const [currentJob, currentProfile, currentCheckIn] = await Promise.all([
            transaction.get(ref),
            transaction.get(userRef),
            transaction.get(checkInRef),
        ]);
        if (!currentJob.exists ||
            currentJob.data()?.status !== 'pending' ||
            !currentProfile.exists ||
            currentProfile.data()?.accountDeletionStartedAt) {
            return;
        }
        transaction.update(ref, currentCheckIn.data()?.completionId === completionId
            ? { ...data, updatedAt: firestore_1.FieldValue.serverTimestamp() }
            : { status: 'superseded', updatedAt: firestore_1.FieldValue.serverTimestamp() });
    });
    if (checkIn.data()?.completionId !== completionId) {
        await publish({ status: 'superseded' });
        return;
    }
    // The check-in and base credit already committed. Only derived rewards belong here.
    if (job.outcome === 'done' && checkIn.data()?.coverageStatus === 'covered') {
        await (0, momentum_1.recalculateMomentumSummaryForUser)(uid);
        await (0, progress_2.reconcileProgress)(uid, true, completionId);
    }
    const now = new Date();
    const [sources, momentum, bonuses] = await Promise.all([
        (0, progress_1.readCircleProgressSources)(circleId),
        (0, summary_1.calculatePersonalTransitionForTapIn)({
            uid,
            profile: profile.data(),
            now,
            replacementCheckIn: {
                path: checkInPath,
                data: job.previousCheckIn ?? null,
            },
        }),
        firebase_1.db
            .collection(`userPrivate/${uid}/progressLedger`)
            .where('sourceEventId', '==', completionId)
            .get(),
    ]);
    let circleProgress;
    if (sources) {
        const current = (0, progress_1.calculateCircleProgress)(sources, now);
        const priorDates = new Map(sources.byDate);
        const priorDay = new Map(priorDates.get(dateKey));
        if (job.previousCheckIn) {
            priorDay.set(uid, job.previousCheckIn);
        }
        else {
            priorDay.delete(uid);
        }
        priorDates.set(dateKey, priorDay);
        const prior = (0, progress_1.calculateCircleProgress)({ ...sources, byDate: priorDates }, now);
        const delta = (after, before) => after?.revision === before?.revision &&
            after?.streak.availability === 'ready' &&
            before?.streak.availability === 'ready' &&
            after.streak.count != null &&
            before.streak.count != null
            ? after.streak.count - before.streak.count
            : undefined;
        const viewer = current.viewers.get(uid);
        const isGroup = sources.circle.circleMode !== 'personal';
        circleProgress = {
            viewer,
            group: isGroup ? current.group : undefined,
            viewerStreakDelta: delta(viewer, prior.viewers.get(uid)),
            groupStreakDelta: isGroup ? delta(current.group, prior.group) : undefined,
        };
    }
    const base = job.baseProgress;
    const progress = {
        xpEarned: base.xpEarned,
        rewards: { ...base.rewards },
    };
    for (const bonus of bonuses.docs) {
        progress.xpEarned += bonus.data().xp || 0;
        progress.rewards.skips += bonus.data().skips || 0;
        progress.rewards.restores += bonus.data().restores || 0;
    }
    // Omit optional fields before writing. This also leaves unknown deltas unclaimed.
    await publish(JSON.parse(JSON.stringify({ status: 'complete', progress, momentum, circleProgress })));
    console.info('tap_in_completion_processed', {
        completionId,
        durationMs: Date.now() - startedAt,
    });
}
exports.finalizeTapInCompletion = (0, firestore_2.onDocumentCreated)({ document: 'userPrivate/{uid}/tapInCompletions/{completionId}', retry: true }, async (event) => {
    if (event.data) {
        await processTapInCompletion(event.data.ref);
    }
});
