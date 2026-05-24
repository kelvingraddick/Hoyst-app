import {FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';
import {canUseSkipGrace, getRollingDateKeys} from './grace';
import {getRemoveTapInDecision} from './remove';
import {notifyCircleAtRisk} from '../notifications';
import {getCommitmentCadence, getRequiredTapIns} from '../shared/commitments';

const submitTapInSchema = z.object({
  circleId: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().max(2048).optional(),
  status: z.enum(['done', 'skip']).default('done'),
});

const removeTapInSchema = z.object({
  circleId: z.string().trim().min(1),
  idToken: z.string().trim().min(1).optional(),
});

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

export const submitTapIn = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = submitTapInSchema.parse(request.data);
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

    if (checkInSnapshot.exists) {
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

    transaction.set(checkInRef, {
      avatarUrl: profile.avatarUrl ?? null,
      createdAt: now,
      displayName: profile.displayName,
      handle: profile.handle,
      note: input.note ?? null,
      photoUrl: input.photoUrl ?? null,
      status: input.status,
      uid,
    });
    transaction.set(
      circleRef.collection('days').doc(dateKey),
      {
        checkInCount: FieldValue.increment(1),
        dateKey,
        updatedAt: now,
      },
      {merge: true},
    );

    return {checkInId: uid, dateKey};
  });

  const [circleSnapshot, memberSnapshots] = await Promise.all([
    circleRef.get(),
    circleRef.collection('members').where('status', '==', 'active').get(),
  ]);
  const circle = circleSnapshot.data();
  const timezone = circle?.timezone ?? profile.timezone ?? 'UTC';
  const commitmentCadence = getCommitmentCadence(circle);
  const requiredTapIns = getRequiredTapIns(circle);
  const weekDateKeys = getCommitmentWeekDateKeys(timezone);
  const weeklyCheckInSnapshots = await Promise.all(
    weekDateKeys.map(dateKey =>
      circleRef.collection('days').doc(dateKey).collection('checkIns').get(),
    ),
  );
  const coveredCounts = new Map<string, number>();
  const todaySnapshotIndex = weekDateKeys.indexOf(result.dateKey);
  const todayCheckInSnapshot =
    weeklyCheckInSnapshots[todaySnapshotIndex >= 0 ? todaySnapshotIndex : 0];
  const scoringSnapshots =
    commitmentCadence === 'daily' && todayCheckInSnapshot
      ? [todayCheckInSnapshot]
      : weeklyCheckInSnapshots;

  scoringSnapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      if (['done', 'skip'].includes(doc.data().status)) {
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
      ? total + Math.max(requiredTapIns - (coveredCounts.get(memberUid) ?? 0), 0)
      : total;
  }, 0);

  if (remainingCount > 0 && remainingCount <= 2) {
    const periodKey =
      commitmentCadence === 'daily'
        ? result.dateKey
        : weekDateKeys[0] ?? result.dateKey;

    await Promise.all(
      pendingMembers.map(memberData =>
        notifyCircleAtRisk({
          commitmentCadence,
          circleId: input.circleId,
          circleTitle:
            typeof circle?.title === 'string' ? circle.title : 'Your circle',
          periodKey,
          remainingCount,
          targetUid: memberData.uid,
        }),
      ),
    ).catch(error => console.error('notify_circle_at_risk_failed', error));
  }

  return result;
});

export const removeTapIn = onCall(async request => {
  const input = removeTapInSchema.parse(request.data);
  const {profile, uid} = await requireCompletedProfile(
    request.auth?.uid,
    input.idToken,
  );
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

    const circle = circleSnapshot.data();
    const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
    const checkInRef = circleRef
      .collection('days')
      .doc(dateKey)
      .collection('checkIns')
      .doc(uid);
    const checkInSnapshot = await transaction.get(checkInRef);
    const decision = getRemoveTapInDecision({
      checkInStatus: checkInSnapshot.data()?.status,
      memberStatus: memberSnapshot.data()?.status,
    });

    if (!decision.removed) {
      return {dateKey, removed: false};
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
});
