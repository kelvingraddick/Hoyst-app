import {FieldValue, type DocumentData} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
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
  getTapInMomentumPreview,
  recordTapInOpportunity,
  recalculateMomentumSummaryForUser,
  removeTapInOpportunity,
} from '../momentum';
import {
  getCompanionMilestoneEvents,
  notifyCircleAtRisk,
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

type TapInSideEffectInput = {
  checkIn: DocumentData;
  circleId: string;
  dateKey: string;
  status: 'done' | 'skip';
  uid: string;
};

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

  scoringSnapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      if (isCoveredCheckInData(doc.data())) {
        coveredCounts.set(doc.id, (coveredCounts.get(doc.id) ?? 0) + 1);
      }
    });
  });

  const pendingMembers = memberSnapshots.docs
    .map(snapshot => snapshot.data())
    .filter(memberData => {
      const memberUid = memberData.uid;

      return (
        typeof memberUid === 'string' &&
        memberUid !== uid &&
        (coveredCounts.get(memberUid) ?? 0) < requiredTapIns
      );
    });
  const remainingCount = pendingMembers.reduce((total, memberData) => {
    const memberUid = memberData.uid;

    return typeof memberUid === 'string'
      ? total +
          Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0)
      : total;
  }, 0);
  const activeMemberUids = memberSnapshots.docs
    .map(snapshot => {
      const memberUid = snapshot.data().uid;
      return typeof memberUid === 'string' && memberUid.trim().length > 0
        ? memberUid
        : snapshot.id;
    })
    .filter(Boolean);
  const totalRemainingCount = activeMemberUids.reduce(
    (total, memberUid) =>
      total + Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0),
    0,
  );
  const periodKey =
    commitmentCadence === 'daily' ? dateKey : periodDateKeys[0] ?? dateKey;
  const circleTitle = asCleanString(circle?.title) ?? 'Your circle';
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

  if (status === 'done' && !isPersonal) {
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
    }).catch(error => console.error('notify_companion_skipped_failed', error));
  }

  if (momentumSummary) {
    const milestoneEvents = getCompanionMilestoneEvents({
      priorSummary: priorMomentumSummary,
      summary: momentumSummary,
    });
    const streakMilestones = milestoneEvents.filter(
      event => event.type === 'companion_streak_milestone',
    );

    if (!isPersonal) {
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
          targetUid,
        }),
      ),
    ).catch(error => console.error('notify_circle_complete_failed', error));
  }

  if (!isPersonal && remainingCount > 0 && remainingCount <= 2) {
    await Promise.all(
      pendingMembers.map(memberData =>
        notifyCircleAtRisk({
          commitmentCadence,
          circleId,
          circleTitle,
          periodKey,
          remainingCount,
          targetUid: memberData.uid,
        }),
      ),
    ).catch(error => console.error('notify_circle_at_risk_failed', error));
  }
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
    const checkInSnapshot = await transaction.get(checkInRef);
    const existingCheckIn = checkInSnapshot.data();
    const existingCovered = isCoveredCheckInData(existingCheckIn);
    const quantityUpdateAllowed =
      input.status === 'done' &&
      checkInSnapshot.exists &&
      canUpdateQuantityTapIn(circle) &&
      existingCheckIn?.status !== 'skip';

    if (checkInSnapshot.exists && !quantityUpdateAllowed) {
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
        status: nextStatus === 'skip' ? 'skip' : 'done',
        transaction,
        uid,
      });

      await recordTapInOpportunity({
        checkInId: uid,
        circle,
        circleId: input.circleId,
        dateKey,
        memberCount:
          typeof circle?.memberCount === 'number'
            ? circle.memberCount
            : undefined,
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
      status: nextStatus,
    };
  });
}

export const submitTapIn = onCall(submitTapInHandler);

export const processTapInSideEffects = onDocumentWritten(
  {
    document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}',
    secrets: [oneSignalRestApiKey],
  },
  async event => {
    const checkIn = event.data?.after.data();
    const priorCheckIn = event.data?.before.data();
    const status = checkIn?.status;

    if (
      !checkIn ||
      !isCoveredCheckInData(checkIn) ||
      isCoveredCheckInData(priorCheckIn) ||
      (status !== 'done' && status !== 'skip')
    ) {
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
