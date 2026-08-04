import type {
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import {db} from '../firebase';
import {getCircleLifecycleStatus} from '../shared/circle-lifecycle';
import {getCircleMode} from '../shared/circle-mode';
import {isCoveredCheckInData} from '../shared/commitments';
import {
  calculateLongestPersonalDailyStreak,
  calculatePersonalDailyStreak,
  getDateKey,
} from './streak';

export type PersonalMetrics = {
  activeCircleCount: number;
  activePersonalCommitmentCount: number;
  hasTappedInToday: boolean;
  longestStreakDays: number;
  personalStreakDays: number;
  totalTapIns: number;
};

export function getPersonalStreakTransition({
  currentMetrics,
  priorMetrics,
}: {
  currentMetrics: Pick<PersonalMetrics, 'personalStreakDays'>;
  priorMetrics: Pick<PersonalMetrics, 'personalStreakDays'>;
}) {
  return {
    currentStreak: currentMetrics.personalStreakDays,
    streakDelta:
      currentMetrics.personalStreakDays - priorMetrics.personalStreakDays,
  };
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
  excludedCheckInPath,
  timezone,
}: {
  activeCircleIds: Set<string>;
  checkInSnapshots: QueryDocumentSnapshot[];
  excludedCheckInPath?: string;
  timezone: string;
}) {
  const activeCoveredCheckInDateKeys: string[] = [];
  const coveredCheckInDateKeys: string[] = [];
  let totalTapIns = 0;

  checkInSnapshots.forEach(snapshot => {
    if (excludedCheckInPath && snapshot.ref.path === excludedCheckInPath) {
      return;
    }

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

function getProfileTimezone(profile: DocumentData | undefined) {
  return typeof profile?.timezone === 'string' && profile.timezone.trim()
    ? profile.timezone.trim()
    : 'UTC';
}

export function summarizeActiveCircleModes(circles: unknown[]) {
  const activeCircles = circles.filter(
    circle => getCircleLifecycleStatus(circle) === 'active',
  );

  return {
    activeCircleCount: activeCircles.filter(
      circle => getCircleMode(circle) === 'group',
    ).length,
    activePersonalCommitmentCount: activeCircles.filter(
      circle => getCircleMode(circle) === 'personal',
    ).length,
  };
}

export async function calculatePersonalMetricsForUser({
  excludedCheckInPath,
  now = new Date(),
  profile,
  uid,
}: {
  excludedCheckInPath?: string;
  now?: Date;
  profile?: DocumentData;
  uid: string;
}): Promise<PersonalMetrics> {
  const resolvedProfile =
    profile ?? (await db.collection('users').doc(uid).get()).data();
  const timezone = getProfileTimezone(resolvedProfile);
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
  const activeCircleSnapshots = await Promise.all(
    Array.from(activeCircleIds).map(circleId =>
      db.collection('circles').doc(circleId).get(),
    ),
  );
  const lifecycleActiveCircleSnapshots = activeCircleSnapshots.filter(
    snapshot =>
      snapshot.exists && getCircleLifecycleStatus(snapshot.data()) === 'active',
  );
  const {activeCircleCount, activePersonalCommitmentCount} =
    summarizeActiveCircleModes(
      activeCircleSnapshots
        .filter(snapshot => snapshot.exists)
        .map(snapshot => snapshot.data()),
    );
  const checkInsSnapshot = await db
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .get();
  const {activeCoveredCheckInDateKeys, coveredCheckInDateKeys, totalTapIns} =
    summarizeProfileCheckIns({
      activeCircleIds: new Set(
        lifecycleActiveCircleSnapshots.map(snapshot => snapshot.id),
      ),
      checkInSnapshots: checkInsSnapshot.docs,
      excludedCheckInPath,
      timezone,
    });
  const currentStreak = calculatePersonalDailyStreak({
    checkInDateKeys: activeCoveredCheckInDateKeys,
    now,
    timezone,
  });

  return {
    activeCircleCount,
    activePersonalCommitmentCount,
    longestStreakDays: calculateLongestPersonalDailyStreak({
      checkInDateKeys: coveredCheckInDateKeys,
    }),
    totalTapIns,
    ...currentStreak,
  };
}
