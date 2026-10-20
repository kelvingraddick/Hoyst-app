import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from 'firebase-admin/firestore';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {db} from '../firebase';
import {
  calculateCircleProgress,
  readCircleProgressSources,
} from '../circles/progress';
import type {
  CircleProgressResult,
  CircleProgressSummary,
} from '../shared/circle-progress';
import {calculatePersonalTransitionForTapIn} from '../profile/summary';
import {recalculateMomentumSummaryForUser} from '../momentum';
import {reconcileProgress} from '../progress';
import type {TapInCompletionProgress} from '../shared/tap-in-completion';

/** Also callable by emulator tests. Duplicate deliveries may compute, but never credit twice. */
export async function processTapInCompletion(ref: DocumentReference) {
  const startedAt = Date.now();
  const snapshot = await ref.get();
  const job = snapshot.data();
  if (!job || job.status !== 'pending') {
    return;
  }
  const {uid, circleId, dateKey, completionId, checkInPath} = job;
  if (
    ref.path !== `userPrivate/${uid}/tapInCompletions/${completionId}` ||
    checkInPath !== `circles/${circleId}/days/${dateKey}/checkIns/${uid}`
  ) {
    throw new Error('Invalid Tap In completion identity.');
  }
  const userRef = db.doc(`users/${uid}`);
  const checkInRef = db.doc(checkInPath);
  const [profile, checkIn] = await Promise.all([
    userRef.get(),
    checkInRef.get(),
  ]);
  if (!profile.exists || profile.data()?.accountDeletionStartedAt) {
    return;
  }

  const publish = async (data: DocumentData) =>
    db.runTransaction(async transaction => {
      const [currentJob, currentProfile, currentCheckIn] = await Promise.all([
        transaction.get(ref),
        transaction.get(userRef),
        transaction.get(checkInRef),
      ]);
      if (
        !currentJob.exists ||
        currentJob.data()?.status !== 'pending' ||
        !currentProfile.exists ||
        currentProfile.data()?.accountDeletionStartedAt
      ) {
        return;
      }
      transaction.update(
        ref,
        currentCheckIn.data()?.completionId === completionId
          ? {...data, updatedAt: FieldValue.serverTimestamp()}
          : {status: 'superseded', updatedAt: FieldValue.serverTimestamp()},
      );
    });
  if (checkIn.data()?.completionId !== completionId) {
    await publish({status: 'superseded'});
    return;
  }

  // The check-in and base credit already committed. Only derived rewards belong here.
  if (job.outcome === 'done' && checkIn.data()?.coverageStatus === 'covered') {
    await recalculateMomentumSummaryForUser(uid);
    await reconcileProgress(uid, true, completionId);
  }
  const now = new Date();
  const [sources, momentum, bonuses] = await Promise.all([
    readCircleProgressSources(circleId),
    calculatePersonalTransitionForTapIn({
      uid,
      profile: profile.data()!,
      now,
      replacementCheckIn: {
        path: checkInPath,
        data: job.previousCheckIn ?? null,
      },
    }),
    db
      .collection(`userPrivate/${uid}/progressLedger`)
      .where('sourceEventId', '==', completionId)
      .get(),
  ]);
  let circleProgress: CircleProgressResult | undefined;
  if (sources) {
    const current = calculateCircleProgress(sources, now);
    const priorDates = new Map(sources.byDate);
    const priorDay = new Map(priorDates.get(dateKey));
    if (job.previousCheckIn) {
      priorDay.set(uid, job.previousCheckIn);
    } else {
      priorDay.delete(uid);
    }
    priorDates.set(dateKey, priorDay);
    const prior = calculateCircleProgress(
      {...sources, byDate: priorDates},
      now,
    );
    const delta = (
      after?: CircleProgressSummary,
      before?: CircleProgressSummary,
    ) =>
      after?.revision === before?.revision &&
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
  const base = job.baseProgress as TapInCompletionProgress;
  const progress = {
    xpEarned: base.xpEarned,
    rewards: {...base.rewards},
  };
  for (const bonus of bonuses.docs) {
    progress.xpEarned += bonus.data().xp || 0;
    progress.rewards.skips += bonus.data().skips || 0;
    progress.rewards.restores += bonus.data().restores || 0;
  }
  // Omit optional fields before writing. This also leaves unknown deltas unclaimed.
  await publish(
    JSON.parse(
      JSON.stringify({status: 'complete', progress, momentum, circleProgress}),
    ),
  );
  console.info('tap_in_completion_processed', {
    completionId,
    durationMs: Date.now() - startedAt,
  });
}

export const finalizeTapInCompletion = onDocumentCreated(
  {document: 'userPrivate/{uid}/tapInCompletions/{completionId}', retry: true},
  async event => {
    if (event.data) {
      await processTapInCompletion(event.data.ref);
    }
  },
);
