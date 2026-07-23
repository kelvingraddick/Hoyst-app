import {
  FieldPath,
  FieldValue,
  type DocumentData,
} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';
import {canUseSkipGrace, getRollingDateKeys} from './grace';
import {getRemoveTapInDecision} from './remove';
import {
  getNextCoverageRevision,
  isCoveredOutcomeChange,
  shouldRetainCorrectedMetricEffect,
} from './reconciliation';
import {
  getTapInMomentumPreview,
  recordTapInOpportunity,
  recalculateMomentumSummaryForUser,
  removeTapInOpportunity,
} from '../momentum';
import {
  getCompanionMilestoneEvents,
  notifyCircleComplete,
  notifyCompanionMilestones,
  notifyCompanionSkipped,
  notifyCompanionTappedIn,
  oneSignalRestApiKey,
  resolveCompanionFeedTargets,
} from '../notifications';
import {
  getCheckInStatusForCoverage,
  getCommitmentCadence,
  getCommitmentType,
  getCoverageStatusForTapIn,
  getQuantityConfig,
  getRequiredTapIns,
  isCoveredCheckInData,
  isSingleTapInCommitment,
} from '../shared/commitments';
import {getCircleMode} from '../shared/circle-mode';
import {createCircleThreadActivity, getCircleThreadStreakText} from '../thread';
import {getCircleCompleteNotificationTargets} from './notification-plan';
import {getTapInDetailsPatch} from './details';

const submitTapInSchema = z.object({
  circleId: z.string().trim().min(1),
  currentValue: z.number().int().min(0).max(100000).optional(),
  note: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().max(2048).optional(),
  status: z.enum(['done', 'skip']).default('done'),
});

const removeTapInSchema = z.object({
  circleId: z.string().trim().min(1),
  idToken: z.string().trim().min(1).optional(),
});

const updateTapInDetailsSchema = z.object({
  circleId: z.string().trim().min(1),
  note: z.string().trim().max(1000).nullable(),
  photoUrl: z.string().trim().url().max(2048).nullable(),
});

type TapInSideEffectInput = {
  checkIn: DocumentData;
  circleId: string;
  dateKey: string;
  status: 'done' | 'skip';
  uid: string;
};

function getCheckInEffectSourceKey(
  circleId: string,
  dateKey: string,
  uid: string,
) {
  return `check_in:${circleId}:${dateKey}:${uid}`;
}

async function deleteSnapshotsInBatches(
  snapshots: Array<{ref: FirebaseFirestore.DocumentReference}>,
) {
  for (let index = 0; index < snapshots.length; index += 400) {
    const batch = db.batch();
    snapshots.slice(index, index + 400).forEach(snapshot => {
      batch.delete(snapshot.ref);
    });
    await batch.commit();
  }
}

async function retractTapInEffects({
  accountDeletion = false,
  circleId,
  dateKey,
  uid,
}: {
  accountDeletion?: boolean;
  circleId: string;
  dateKey: string;
  uid: string;
}) {
  const circleRef = db.collection('circles').doc(circleId);
  const sourceKey = getCheckInEffectSourceKey(circleId, dateKey, uid);
  const streakPrefix = `streak_${dateKey}_${uid}_`;
  const effectRef = circleRef
    .collection('checkInEffects')
    .doc(`${dateKey}_${uid}`);
  const [effectSnapshot, sourceInboxSnapshots, streakSnapshots] =
    await Promise.all([
      effectRef.get(),
      db.collectionGroup('inbox').where('sourceKey', '==', sourceKey).get(),
      circleRef
        .collection('feedItems')
        .where(FieldPath.documentId(), '>=', streakPrefix)
        .where(FieldPath.documentId(), '<', `${streakPrefix}\uf8ff`)
        .get(),
    ]);
  const coverageRevision =
    typeof effectSnapshot.data()?.coverageRevision === 'number'
      ? effectSnapshot.data()?.coverageRevision
      : 1;
  const momentumSummary = accountDeletion
    ? undefined
    : await recalculateMomentumSummaryForUser(uid);
  const retainedInboxSnapshots = momentumSummary
    ? sourceInboxSnapshots.docs.filter(snapshot =>
        shouldRetainCorrectedMetricEffect({
          bestStreak: momentumSummary.bestStreak,
          currentStreak: momentumSummary.currentStreak,
          effectId: snapshot.id,
          momentumStatus: momentumSummary.status,
          type: snapshot.data().type,
        }),
      )
    : [];
  const retainedInboxIds = new Set(
    retainedInboxSnapshots.map(snapshot => snapshot.id),
  );
  const removableInboxSnapshots = sourceInboxSnapshots.docs.filter(
    snapshot => !retainedInboxIds.has(snapshot.id),
  );
  const retainedStreakSnapshots = momentumSummary
    ? streakSnapshots.docs.filter(snapshot =>
        shouldRetainCorrectedMetricEffect({
          bestStreak: momentumSummary.bestStreak,
          currentStreak: momentumSummary.currentStreak,
          effectId: snapshot.id,
          momentumStatus: momentumSummary.status,
          type: 'streak_milestone',
        }),
      )
    : [];
  const retainedStreakIds = new Set(
    retainedStreakSnapshots.map(snapshot => snapshot.id),
  );
  const removableStreakSnapshots = streakSnapshots.docs.filter(
    snapshot => !retainedStreakIds.has(snapshot.id),
  );
  const retainedMetricEventIds = [
    ...retainedInboxSnapshots.map(snapshot => snapshot.id),
    ...retainedStreakSnapshots.map(snapshot => snapshot.id),
  ];

  await Promise.all([
    circleRef.collection('feedItems').doc(`tap_in_${dateKey}_${uid}`).delete(),
    deleteSnapshotsInBatches(removableInboxSnapshots),
    deleteSnapshotsInBatches(removableStreakSnapshots),
  ]);

  if (accountDeletion) {
    await db.recursiveDelete(effectRef);
    return;
  }

  await Promise.all([
    effectRef.set(
      {
        active: false,
        retractedAt: FieldValue.serverTimestamp(),
        retainedMetricEventIds,
        sourceKey,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    ),
    effectRef.collection('revisions').doc(String(coverageRevision)).set(
      {
        active: false,
        retractedAt: FieldValue.serverTimestamp(),
        retainedMetricEventIds,
        sourceKey,
        status: 'retracted',
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    ),
  ]);
}

async function updateCoveredTapInActivity({
  checkIn,
  circleId,
  dateKey,
  uid,
}: {
  checkIn: DocumentData;
  circleId: string;
  dateKey: string;
  uid: string;
}) {
  const circleRef = db.collection('circles').doc(circleId);
  const activityId = `tap_in_${dateKey}_${uid}`;
  const activityRef = circleRef.collection('feedItems').doc(activityId);
  const effectRef = circleRef
    .collection('checkInEffects')
    .doc(`${dateKey}_${uid}`);
  const [circleSnapshot, activitySnapshot, effectSnapshot] = await Promise.all([
    circleRef.get(),
    activityRef.get(),
    effectRef.get(),
  ]);
  const isAccountDeletion = checkIn.deletionReason === 'account';
  const shouldShowActivity =
    !isAccountDeletion &&
    getCircleMode(circleSnapshot.data()) !== 'personal' &&
    checkIn.status === 'done';

  if (!shouldShowActivity) {
    await activityRef.delete();
  } else if (activitySnapshot.exists) {
    await activityRef.set(
      {
        mediaImageUrl: asCleanString(checkIn.photoUrl) ?? null,
        note: asCleanString(checkIn.note) ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  } else {
    await createCircleThreadActivity({
      actor: {
        avatarUrl: asCleanString(checkIn.avatarUrl) ?? null,
        displayName: asCleanString(checkIn.displayName) ?? 'Someone',
        handle: asCleanString(checkIn.handle) ?? null,
        uid,
      },
      circleId,
      createdAt: checkIn.createdAt,
      itemId: activityId,
      mediaImageUrl: asCleanString(checkIn.photoUrl),
      note: asCleanString(checkIn.note),
      text: `${asCleanString(checkIn.displayName) ?? 'Someone'} tapped in`,
      tone: 'success',
      type: 'tap_in',
    });
  }

  if (isAccountDeletion || !effectSnapshot.exists) {
    return;
  }

  const rawActivityIds = effectSnapshot.data()?.circleActivityIds;
  const priorActivityIds: string[] = Array.isArray(rawActivityIds)
    ? rawActivityIds.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : [];
  const circleActivityIds = shouldShowActivity
    ? Array.from(new Set([...priorActivityIds, activityId]))
    : priorActivityIds.filter(value => value !== activityId);
  const coverageRevision =
    typeof checkIn.coverageRevision === 'number'
      ? checkIn.coverageRevision
      : effectSnapshot.data()?.coverageRevision;
  const effectPayload = {
    circleActivityIds,
    status: checkIn.status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const writes: Array<Promise<unknown>> = [
    effectRef.set(effectPayload, {merge: true}),
  ];

  if (typeof coverageRevision === 'number') {
    writes.push(
      effectRef
        .collection('revisions')
        .doc(String(coverageRevision))
        .set(effectPayload, {merge: true}),
    );
  }

  await Promise.all(writes);
}

async function getAuthenticatedUid(uid?: string, idToken?: string) {
  if (uid) {
    return uid;
  }

  if (!idToken) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }
}

async function requireCompletedProfile(uid?: string, idToken?: string) {
  const authenticatedUid = await getAuthenticatedUid(uid, idToken);

  const snapshot = await db.collection('users').doc(authenticatedUid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid: authenticatedUid};
}

function getDateKey(timezone: string) {
  return getDateKeyForDate(timezone, new Date());
}

function getDateKeyForDate(timezone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value ?? '1970';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const day = parts.find(part => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function getCommitmentWeekDateKeys(timezone: string, now = new Date()) {
  const local = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(now);
  const weekday = local.find(part => part.type === 'weekday')?.value ?? 'Mon';
  const dayOffsetByWeekday: Record<string, number> = {
    Fri: 4,
    Mon: 0,
    Sat: 5,
    Sun: 6,
    Thu: 3,
    Tue: 1,
    Wed: 2,
  };
  const localDate = new Date(
    Number(local.find(part => part.type === 'year')?.value ?? '1970'),
    Number(local.find(part => part.type === 'month')?.value ?? '1') - 1,
    Number(local.find(part => part.type === 'day')?.value ?? '1'),
  );
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));

  return Array.from({length: 7}, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });
}

function getCommitmentMonthDateKeys(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(now);
  const year = Number(
    parts.find(part => part.type === 'year')?.value ?? '1970',
  );
  const month = Number(parts.find(part => part.type === 'month')?.value ?? '1');
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({length: dayCount}, (_, index) =>
    [
      String(year),
      String(month).padStart(2, '0'),
      String(index + 1).padStart(2, '0'),
    ].join('-'),
  );
}

function getCommitmentPeriodDateKeys(
  cadence: ReturnType<typeof getCommitmentCadence>,
  timezone: string,
  now = new Date(),
) {
  if (cadence === 'daily') {
    return [getDateKeyForDate(timezone, now)];
  }

  if (cadence === 'monthly') {
    return getCommitmentMonthDateKeys(timezone, now);
  }

  return getCommitmentWeekDateKeys(timezone, now);
}

function asCleanString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function canUpdateQuantityTapIn(circle: DocumentData | undefined) {
  const commitmentType = getCommitmentType(circle);

  return (
    commitmentType === 'limit' ||
    (commitmentType === 'build' && !isSingleTapInCommitment(circle))
  );
}

function getTapInCurrentValue({
  circle,
  existingValue,
  inputValue,
}: {
  circle: DocumentData | undefined;
  existingValue?: unknown;
  inputValue?: unknown;
}) {
  const commitmentType = getCommitmentType(circle);

  if (commitmentType === 'avoid' || isSingleTapInCommitment(circle)) {
    return 1;
  }

  return asNonNegativeNumber(inputValue, asNonNegativeNumber(existingValue, 0));
}

async function processTapInSideEffectsForCheckIn({
  checkIn,
  circleId,
  dateKey,
  status,
  uid,
}: TapInSideEffectInput) {
  const circleRef = db.collection('circles').doc(circleId);
  const momentumRef = db
    .collection('userPrivate')
    .doc(uid)
    .collection('momentum')
    .doc('current');
  const priorMomentumSnapshot = await momentumRef.get();
  const priorMomentumSummary = priorMomentumSnapshot.data();
  const momentumSummary = await recalculateMomentumSummaryForUser(uid).catch(
    error => {
      console.error('recalculate_momentum_summary_failed', error);
      return undefined;
    },
  );

  const [circleSnapshot, memberSnapshots] = await Promise.all([
    circleRef.get(),
    circleRef.collection('members').where('status', '==', 'active').get(),
  ]);
  const circle = circleSnapshot.data();
  const isPersonal = getCircleMode(circle) === 'personal';
  const timezone = asCleanString(circle?.timezone) ?? 'UTC';
  const commitmentCadence = getCommitmentCadence(circle);
  const requiredTapIns = getRequiredTapIns(circle);
  const periodDateKeys = getCommitmentPeriodDateKeys(
    commitmentCadence,
    timezone,
  );
  const periodCheckInSnapshots = await Promise.all(
    periodDateKeys.map(periodDateKey =>
      circleRef
        .collection('days')
        .doc(periodDateKey)
        .collection('checkIns')
        .get(),
    ),
  );
  const coveredCounts = new Map<string, number>();
  const todaySnapshotIndex = periodDateKeys.indexOf(dateKey);
  const todayCheckInSnapshot =
    periodCheckInSnapshots[todaySnapshotIndex >= 0 ? todaySnapshotIndex : 0];
  const scoringSnapshots =
    commitmentCadence === 'daily' && todayCheckInSnapshot
      ? [todayCheckInSnapshot]
      : periodCheckInSnapshots;
  const periodKey =
    commitmentCadence === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
  const [canonicalPeriodSnapshot, canonicalSlotSnapshots] = await Promise.all([
    circleRef.collection('opportunities').doc(periodKey).get(),
    circleRef
      .collection('opportunities')
      .doc(periodKey)
      .collection('slots')
      .get(),
  ]);
  const canonicalExpectedMemberUids = new Set<string>();
  canonicalSlotSnapshots.docs.forEach(snapshot => {
    const values = snapshot.data().expectedMemberUids;
    if (Array.isArray(values)) {
      values.forEach(value => {
        if (typeof value === 'string') {
          canonicalExpectedMemberUids.add(value);
        }
      });
    }
  });
  const hasCanonicalExpectations = canonicalSlotSnapshots.size > 0;

  scoringSnapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      if (isCoveredCheckInData(doc.data())) {
        coveredCounts.set(doc.id, (coveredCounts.get(doc.id) ?? 0) + 1);
      }
    });
  });

  const activeMemberUids = memberSnapshots.docs
    .map(snapshot => {
      const memberUid = snapshot.data().uid;
      return typeof memberUid === 'string' && memberUid.trim().length > 0
        ? memberUid
        : snapshot.id;
    })
    .filter(
      memberUid =>
        Boolean(memberUid) &&
        (!hasCanonicalExpectations ||
          canonicalExpectedMemberUids.has(memberUid)),
    );
  const canonicalExpectedOpportunityCount =
    canonicalPeriodSnapshot.data()?.expectedOpportunityCount;
  const canonicalCoveredOpportunityCount =
    canonicalPeriodSnapshot.data()?.coveredOpportunityCount;
  const totalRemainingCount =
    typeof canonicalExpectedOpportunityCount === 'number' &&
    typeof canonicalCoveredOpportunityCount === 'number'
      ? Math.max(
          canonicalExpectedOpportunityCount - canonicalCoveredOpportunityCount,
          0,
        )
      : activeMemberUids.reduce(
          (total, memberUid) =>
            total +
            Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0),
          0,
        );
  const circleTitle = asCleanString(circle?.title) ?? 'Your circle';
  const coverageRevision =
    typeof checkIn.coverageRevision === 'number' ? checkIn.coverageRevision : 1;
  const sourceKey = getCheckInEffectSourceKey(circleId, dateKey, uid);
  const actor = {
    avatarUrl: asCleanString(checkIn.avatarUrl) ?? null,
    displayName: asCleanString(checkIn.displayName) ?? 'Someone',
    handle: asCleanString(checkIn.handle) ?? null,
    uid,
  };
  const companionTargets = isPersonal
    ? []
    : await resolveCompanionFeedTargets({
        actorUid: uid,
        circle,
        circleId,
      });
  const mediaImageUrl = asCleanString(checkIn.photoUrl);
  const note = asCleanString(checkIn.note);
  const circleCompleteTargetUids = getCircleCompleteNotificationTargets({
    activeMemberUids,
    remainingTapIns: totalRemainingCount,
  });
  const circleActivityIds: string[] = [];
  let milestoneKeys: string[] = [];

  if (status === 'done' && !isPersonal) {
    circleActivityIds.push(`tap_in_${dateKey}_${uid}`);
    await createCircleThreadActivity({
      actor,
      circleId,
      createdAt: checkIn.createdAt,
      itemId: `tap_in_${dateKey}_${uid}`,
      mediaImageUrl,
      note,
      text: `${actor.displayName} tapped in`,
      tone: 'success',
      type: 'tap_in',
    }).catch(error =>
      console.error('create_thread_tap_in_activity_failed', error),
    );

    await Promise.all(
      companionTargets.map(target =>
        notifyCompanionTappedIn({
          actor,
          circleId,
          circleTitle,
          dateKey,
          mediaImageUrl: target.canViewMedia ? mediaImageUrl : undefined,
          targetUid: target.uid,
          sourceKey,
          sourceRevision: coverageRevision,
        }),
      ),
    ).catch(error => console.error('notify_companion_tapped_in_failed', error));
  }

  if (status === 'skip' && !isPersonal) {
    await notifyCompanionSkipped({
      actor,
      circle,
      circleId,
      circleTitle,
      dateKey,
      sourceKey,
      sourceRevision: coverageRevision,
    }).catch(error => console.error('notify_companion_skipped_failed', error));
  }

  if (momentumSummary) {
    const milestoneEvents = getCompanionMilestoneEvents({
      priorSummary: priorMomentumSummary,
      summary: momentumSummary,
    });
    milestoneKeys = milestoneEvents.map(event => event.key);
    const streakMilestones = milestoneEvents.filter(
      event => event.type === 'companion_streak_milestone',
    );

    if (!isPersonal) {
      circleActivityIds.push(
        ...streakMilestones.map(
          event => `streak_${dateKey}_${uid}_${event.key}`,
        ),
      );
      await Promise.all(
        streakMilestones.map(event =>
          createCircleThreadActivity({
            actor,
            circleId,
            createdAt: checkIn.createdAt,
            itemId: `streak_${dateKey}_${uid}_${event.key}`,
            text: getCircleThreadStreakText(event.streakDays),
            tone: 'alert',
            type: 'streak_milestone',
          }),
        ),
      ).catch(error =>
        console.error('create_thread_streak_activity_failed', error),
      );
    }

    await notifyCompanionMilestones({
      actor,
      circle,
      circleId,
      dateKey,
      events: milestoneEvents,
      sourceKey,
      sourceRevision: coverageRevision,
      targetUid: uid,
    }).catch(error =>
      console.error('notify_companion_milestones_failed', error),
    );
  }

  if (!isPersonal && circleCompleteTargetUids.length > 0) {
    await Promise.all(
      circleCompleteTargetUids.map(targetUid =>
        notifyCircleComplete({
          actorUid: uid,
          circleId,
          circleTitle,
          commitmentCadence,
          periodKey,
          sourceKey,
          sourceRevision: coverageRevision,
          targetUid,
        }),
      ),
    ).catch(error => console.error('notify_circle_complete_failed', error));
  }

  const effectRef = circleRef
    .collection('checkInEffects')
    .doc(`${dateKey}_${uid}`);
  const effectPayload = {
    active: true,
    circleActivityIds,
    circleCompletionTargetUids: circleCompleteTargetUids,
    coverageRevision,
    milestoneKeys,
    notificationSourceKey: sourceKey,
    periodKey,
    sourceKey,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await Promise.all([
    effectRef.set(effectPayload, {merge: true}),
    effectRef
      .collection('revisions')
      .doc(String(coverageRevision))
      .set(
        {
          ...effectPayload,
          createdAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      ),
  ]);
}

async function submitTapInHandler(request: CallableRequest) {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = submitTapInSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    if (memberSnapshot.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Join this circle first.');
    }

    const circle = circleSnapshot.data();
    const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
    const checkInRef = circleRef
      .collection('days')
      .doc(dateKey)
      .collection('checkIns')
      .doc(uid);
    const effectRef = circleRef
      .collection('checkInEffects')
      .doc(`${dateKey}_${uid}`);
    const [checkInSnapshot, effectSnapshot] = await Promise.all([
      transaction.get(checkInRef),
      transaction.get(effectRef),
    ]);
    const existingCheckIn = checkInSnapshot.data();
    const existingCovered = isCoveredCheckInData(existingCheckIn);
    const coveredOutcomeChanged = isCoveredOutcomeChange({
      existingCheckIn,
      nextStatus: input.status,
    });
    const quantityUpdateAllowed =
      input.status === 'done' &&
      checkInSnapshot.exists &&
      canUpdateQuantityTapIn(circle) &&
      existingCheckIn?.status !== 'skip';
    const coveredOutcomeUpdateAllowed =
      checkInSnapshot.exists && existingCovered && coveredOutcomeChanged;

    if (
      checkInSnapshot.exists &&
      !quantityUpdateAllowed &&
      !coveredOutcomeUpdateAllowed
    ) {
      throw new HttpsError('already-exists', 'You already tapped in today.');
    }

    if (input.status === 'skip') {
      const skipRule = circle?.graceRules?.skip as
        | {allowance?: unknown; windowDays?: unknown}
        | undefined;
      const graceRule = {
        allowance:
          typeof skipRule?.allowance === 'number' ? skipRule.allowance : 0,
        windowDays:
          typeof skipRule?.windowDays === 'number' ? skipRule.windowDays : 1,
      };
      const rollingDateKeys = getRollingDateKeys(dateKey, graceRule.windowDays);
      const priorSkipSnapshots = await Promise.all(
        rollingDateKeys.map(windowDateKey =>
          transaction.get(
            circleRef
              .collection('days')
              .doc(windowDateKey)
              .collection('checkIns')
              .doc(uid),
          ),
        ),
      );
      const priorSkipCount = priorSkipSnapshots.filter(
        snapshot => snapshot.data()?.status === 'skip',
      ).length;

      if (!canUseSkipGrace({graceRule, priorSkipCount})) {
        throw new HttpsError(
          'resource-exhausted',
          'No skips are available for this grace window.',
        );
      }
    }

    const currentValue =
      input.status === 'done'
        ? getTapInCurrentValue({
            circle,
            existingValue: existingCheckIn?.currentValue,
            inputValue: input.currentValue,
          })
        : undefined;
    const coverageStatus = getCoverageStatusForTapIn({
      circle,
      currentValue,
      status: input.status,
    });
    const nextStatus = getCheckInStatusForCoverage(coverageStatus);
    const nextCovered =
      coverageStatus === 'covered' || coverageStatus === 'skipped';
    const coverageRevision = getNextCoverageRevision({
      existingCovered,
      existingRevision: existingCheckIn?.coverageRevision,
      ledgerRevision: effectSnapshot.data()?.coverageRevision,
      nextCovered,
    });
    const quantityConfig = getQuantityConfig(circle);
    const commitmentType = getCommitmentType(circle);
    let momentum:
      | Awaited<ReturnType<typeof getTapInMomentumPreview>>
      | undefined;

    if (nextCovered && !existingCovered) {
      momentum = await getTapInMomentumPreview({
        circle,
        circleId: input.circleId,
        dateKey,
        member: memberSnapshot.data(),
        status: nextStatus === 'skip' ? 'skip' : 'done',
        transaction,
        uid,
      });
    }

    if (nextCovered && (!existingCovered || coveredOutcomeChanged)) {
      await recordTapInOpportunity({
        checkInId: uid,
        circle,
        circleId: input.circleId,
        dateKey,
        memberCount:
          typeof circle?.memberCount === 'number'
            ? circle.memberCount
            : undefined,
        member: memberSnapshot.data(),
        profile,
        status: nextStatus === 'skip' ? 'skip' : 'done',
        transaction,
        uid,
      });
    } else if (!nextCovered && existingCovered) {
      await removeTapInOpportunity({
        circle,
        circleId: input.circleId,
        dateKey,
        transaction,
        uid,
      });
    }

    const checkInPayload: DocumentData = {
      avatarUrl: profile.avatarUrl ?? null,
      coverageStatus,
      coverageRevision,
      circleId: input.circleId,
      displayName: profile.displayName,
      handle: profile.handle,
      note: input.note ?? null,
      photoUrl: input.photoUrl ?? null,
      status: nextStatus,
      uid,
      updatedAt: now,
    };

    if (!checkInSnapshot.exists) {
      checkInPayload.createdAt = now;
    }

    if (input.status === 'done') {
      checkInPayload.commitmentType = commitmentType;
      checkInPayload.currentValue = currentValue;
      checkInPayload.stepValue = quantityConfig.stepValue;
      checkInPayload.unitLabel = quantityConfig.unitLabel;

      if (typeof quantityConfig.targetValue === 'number') {
        checkInPayload.targetValue = quantityConfig.targetValue;
      } else {
        checkInPayload.targetValue = FieldValue.delete();
      }

      if (typeof quantityConfig.maximumValue === 'number') {
        checkInPayload.maximumValue = quantityConfig.maximumValue;
      } else {
        checkInPayload.maximumValue = FieldValue.delete();
      }

      if (typeof quantityConfig.minimumValue === 'number') {
        checkInPayload.minimumValue = quantityConfig.minimumValue;
      } else {
        checkInPayload.minimumValue = FieldValue.delete();
      }
    } else {
      checkInPayload.commitmentType = commitmentType;
      checkInPayload.currentValue = FieldValue.delete();
      checkInPayload.maximumValue = FieldValue.delete();
      checkInPayload.minimumValue = FieldValue.delete();
      checkInPayload.stepValue = FieldValue.delete();
      checkInPayload.targetValue = FieldValue.delete();
      checkInPayload.unitLabel = FieldValue.delete();
    }

    transaction.set(checkInRef, checkInPayload, {merge: true});
    if (nextCovered && !existingCovered) {
      transaction.set(
        effectRef,
        {
          active: false,
          coverageRevision,
          pending: true,
          sourceKey: getCheckInEffectSourceKey(input.circleId, dateKey, uid),
          updatedAt: now,
        },
        {merge: true},
      );
    }
    transaction.set(
      circleRef.collection('days').doc(dateKey),
      {
        checkInCount: FieldValue.increment(
          nextCovered === existingCovered ? 0 : nextCovered ? 1 : -1,
        ),
        dateKey,
        updatedAt: now,
      },
      {merge: true},
    );
    transaction.set(
      db.collection('userPrivate').doc(uid),
      {
        lastTapInAt: now,
      },
      {merge: true},
    );

    return {
      checkInId: uid,
      coverageStatus,
      currentValue,
      dateKey,
      momentum,
      coverageRevision,
      status: nextStatus,
    };
  });
}

export const submitTapIn = onCall(submitTapInHandler);

async function updateTapInDetailsHandler(request: CallableRequest) {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = updateTapInDetailsSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const now = FieldValue.serverTimestamp();

  const result = await db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    const circle = circleSnapshot.data();
    const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
    const checkInRef = circleRef
      .collection('days')
      .doc(dateKey)
      .collection('checkIns')
      .doc(uid);
    const checkInSnapshot = await transaction.get(checkInRef);
    const patch = getTapInDetailsPatch({
      checkInExists: checkInSnapshot.exists,
      checkInStatus: checkInSnapshot.data()?.status,
      memberStatus: memberSnapshot.data()?.status,
      note: input.note,
      photoUrl: input.photoUrl,
    });
    const shouldDeletePhoto =
      Boolean(checkInSnapshot.data()?.photoUrl) && patch.photoUrl === null;

    transaction.set(
      checkInRef,
      {
        ...patch,
        updatedAt: now,
      },
      {merge: true},
    );

    return {
      dateKey,
      note: patch.note,
      photoUrl: patch.photoUrl,
      shouldDeletePhoto,
    };
  });

  if (result.shouldDeletePhoto) {
    await getStorage()
      .bucket()
      .deleteFiles({
        force: true,
        prefix: `circles/${input.circleId}/check-ins/${result.dateKey}/${uid}/proof.jpg`,
      })
      .catch(error =>
        console.error('delete_tap_in_proof_failed', {
          circleId: input.circleId,
          dateKey: result.dateKey,
          error,
          uid,
        }),
      );
  }

  return {
    dateKey: result.dateKey,
    note: result.note,
    photoUrl: result.photoUrl,
  };
}

export const updateTapInDetails = onCall(updateTapInDetailsHandler);

export const processTapInSideEffects = onDocumentWritten(
  {
    document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}',
    secrets: [oneSignalRestApiKey],
  },
  async event => {
    const checkIn = event.data?.after.data();
    const priorCheckIn = event.data?.before.data();
    const status = checkIn?.status;

    const wasCovered = isCoveredCheckInData(priorCheckIn);
    const isCovered = isCoveredCheckInData(checkIn);

    if (wasCovered && !isCovered) {
      await retractTapInEffects({
        accountDeletion: priorCheckIn?.deletionReason === 'account',
        circleId: event.params.circleId,
        dateKey: event.params.dateKey,
        uid: event.params.uid,
      });
      return;
    }

    if (wasCovered && isCovered && checkIn) {
      await updateCoveredTapInActivity({
        checkIn,
        circleId: event.params.circleId,
        dateKey: event.params.dateKey,
        uid: event.params.uid,
      });
      return;
    }

    if (!checkIn || !isCovered || (status !== 'done' && status !== 'skip')) {
      return;
    }

    await processTapInSideEffectsForCheckIn({
      checkIn,
      circleId: event.params.circleId,
      dateKey: event.params.dateKey,
      status,
      uid: event.params.uid,
    });
  },
);

export const removeTapIn = onCall(async request => {
  const input = removeTapInSchema.parse(request.data);
  const {profile, uid} = await requireCompletedProfile(
    request.auth?.uid,
    input.idToken,
  );
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const now = FieldValue.serverTimestamp();

  const result = await db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    const circle = circleSnapshot.data();
    const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
    const checkInRef = circleRef
      .collection('days')
      .doc(dateKey)
      .collection('checkIns')
      .doc(uid);
    const checkInSnapshot = await transaction.get(checkInRef);
    const checkIn = checkInSnapshot.data();
    const decision = getRemoveTapInDecision({
      coverageStatus: checkIn?.coverageStatus,
      checkInStatus: checkIn?.status,
      memberStatus: memberSnapshot.data()?.status,
    });

    if (!decision.removed) {
      return {dateKey, removed: false};
    }

    if (decision.checkInCountDelta < 0) {
      await removeTapInOpportunity({
        circle,
        circleId: input.circleId,
        dateKey,
        transaction,
        uid,
      });
    }

    transaction.delete(checkInRef);
    transaction.set(
      circleRef.collection('days').doc(dateKey),
      {
        checkInCount: FieldValue.increment(decision.checkInCountDelta),
        dateKey,
        updatedAt: now,
      },
      {merge: true},
    );

    return {dateKey, removed: true};
  });

  if (result.removed) {
    await recalculateMomentumSummaryForUser(uid).catch(error =>
      console.error('recalculate_momentum_summary_failed', error),
    );
  }

  return result;
});
