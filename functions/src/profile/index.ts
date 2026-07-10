import type {QueryDocumentSnapshot} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {db} from '../firebase';
import {isCoveredCheckInData} from '../shared/commitments';
import {
  calculateLongestPersonalDailyStreak,
  calculatePersonalDailyStreak,
  getDateKey,
} from './streak';

export type ProfileSummary = {
  activeCircleCount: number;
  hasTappedInToday: boolean;
  longestStreakDays: number;
  personalStreakDays: number;
  totalTapIns: number;
};

async function requireCompletedProfile(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const snapshot = await db.collection('users').doc(uid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid};
}

function getMembershipCircleId(snapshot: QueryDocumentSnapshot) {
  return snapshot.ref.parent.parent?.id;
}

function getCheckInCircleId(snapshot: QueryDocumentSnapshot) {
  const dayRef = snapshot.ref.parent.parent;

  return dayRef?.parent.parent?.id;
}

function getCheckInDateKey(snapshot: QueryDocumentSnapshot, timezone: string) {
  const data = snapshot.data();
  const createdAt = data.createdAt as {toDate?: () => Date} | undefined;

  if (createdAt?.toDate) {
    return getDateKey(createdAt.toDate(), timezone);
  }

  return snapshot.ref.parent.parent?.id;
}

export function summarizeProfileCheckIns({
  activeCircleIds,
  checkInSnapshots,
  timezone,
}: {
  activeCircleIds: Set<string>;
  checkInSnapshots: QueryDocumentSnapshot[];
  timezone: string;
}) {
  const activeCoveredCheckInDateKeys: string[] = [];
  const coveredCheckInDateKeys: string[] = [];
  let totalTapIns = 0;

  checkInSnapshots.forEach(snapshot => {
    const checkIn = snapshot.data();
    const status = checkIn.status;

    if (status === 'done' && isCoveredCheckInData(checkIn)) {
      totalTapIns += 1;
    }

    if (!isCoveredCheckInData(checkIn)) {
      return;
    }

    const dateKey = getCheckInDateKey(snapshot, timezone);

    if (!dateKey) {
      return;
    }

    coveredCheckInDateKeys.push(dateKey);

    const circleId = getCheckInCircleId(snapshot);

    if (circleId && activeCircleIds.has(circleId)) {
      activeCoveredCheckInDateKeys.push(dateKey);
    }
  });

  return {
    activeCoveredCheckInDateKeys,
    coveredCheckInDateKeys,
    totalTapIns,
  };
}

export const getProfileSummary = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const timezone =
    typeof profile.timezone === 'string' && profile.timezone.trim()
      ? profile.timezone
      : 'UTC';
  const membershipsSnapshot = await db
    .collectionGroup('members')
    .where('uid', '==', uid)
    .get();
  const activeCircleIds = new Set(
    membershipsSnapshot.docs
      .filter(snapshot => snapshot.data().status === 'active')
      .map(getMembershipCircleId)
      .filter((circleId): circleId is string => Boolean(circleId)),
  );

  const checkInsSnapshot = await db
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .get();
  const {activeCoveredCheckInDateKeys, coveredCheckInDateKeys, totalTapIns} =
    summarizeProfileCheckIns({
      activeCircleIds,
      checkInSnapshots: checkInsSnapshot.docs,
      timezone,
    });
  const streak = calculatePersonalDailyStreak({
    checkInDateKeys: activeCoveredCheckInDateKeys,
    timezone,
  });
  const longestStreakDays = calculateLongestPersonalDailyStreak({
    checkInDateKeys: coveredCheckInDateKeys,
  });

  return {
    activeCircleCount: activeCircleIds.size,
    longestStreakDays,
    totalTapIns,
    ...streak,
  } satisfies ProfileSummary;
});
