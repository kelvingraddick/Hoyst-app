import type {QueryDocumentSnapshot} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {db} from '../firebase';
import {calculatePersonalDailyStreak, getDateKey} from './streak';

export type ProfileSummary = {
  activeCircleCount: number;
  hasTappedInToday: boolean;
  personalStreakDays: number;
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

function getCheckInDateKey(
  snapshot: QueryDocumentSnapshot,
  timezone: string,
) {
  const data = snapshot.data();
  const createdAt = data.createdAt as {toDate?: () => Date} | undefined;

  if (createdAt?.toDate) {
    return getDateKey(createdAt.toDate(), timezone);
  }

  return snapshot.ref.parent.parent?.id;
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

  if (activeCircleIds.size === 0) {
    return {
      activeCircleCount: 0,
      hasTappedInToday: false,
      personalStreakDays: 0,
    } satisfies ProfileSummary;
  }

  const checkInsSnapshot = await db
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .get();
  const checkInDateKeys = checkInsSnapshot.docs
    .filter(snapshot => snapshot.data().status === 'done')
    .filter(snapshot => {
      const circleId = getCheckInCircleId(snapshot);

      return Boolean(circleId && activeCircleIds.has(circleId));
    })
    .map(snapshot => getCheckInDateKey(snapshot, timezone))
    .filter((dateKey): dateKey is string => Boolean(dateKey));
  const streak = calculatePersonalDailyStreak({
    checkInDateKeys,
    timezone,
  });

  return {
    activeCircleCount: activeCircleIds.size,
    ...streak,
  } satisfies ProfileSummary;
});
