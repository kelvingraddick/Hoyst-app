import {FieldValue, type DocumentReference} from 'firebase-admin/firestore';

import {db} from '../firebase';
import {isCoveredCheckInData} from '../shared/commitments';
import {getCircleMode} from '../shared/circle-mode';
import {getDateKey, getPreviousDateKey} from '../profile/streak';

type MembershipPeriod = {
  joinedAt?: unknown;
  leftAt?: unknown;
  opportunityEligibility?: unknown;
  uid: string;
};

type GroupDayCoverage = {
  coveredMemberUids: string[];
  expectedMemberUids: string[];
  isKnown: boolean;
};

function asDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (
      'toDate' in value &&
      typeof (value as {toDate?: unknown}).toDate === 'function'
    ) {
      return (value as {toDate: () => Date}).toDate();
    }

    if (
      'seconds' in value &&
      typeof (value as {seconds?: unknown}).seconds === 'number'
    ) {
      return new Date((value as {seconds: number}).seconds * 1000);
    }
  }

  return undefined;
}

function getMembershipDateKey(value: unknown, timezone: string) {
  const date = asDate(value);

  return date ? getDateKey(date, timezone) : undefined;
}

export function isMemberExpectedForGroupDate({
  dateKey,
  period,
  timezone,
}: {
  dateKey: string;
  period: MembershipPeriod;
  timezone: string;
}) {
  const joinedDateKey = getMembershipDateKey(period.joinedAt, timezone);
  const leftDateKey = getMembershipDateKey(period.leftAt, timezone);

  if (!joinedDateKey) {
    return false;
  }

  const joinedBeforeDate = joinedDateKey < dateKey;
  const joinsCurrentDate =
    joinedDateKey === dateKey &&
    period.opportunityEligibility === 'include_current';
  const leftBeforeOrOnDate = Boolean(leftDateKey && leftDateKey <= dateKey);

  return (joinedBeforeDate || joinsCurrentDate) && !leftBeforeOrOnDate;
}

export function calculateGroupDailyStreak({
  completedDateKeys,
  now = new Date(),
  startDateKey,
  timezone,
}: {
  completedDateKeys: Iterable<string>;
  now?: Date;
  startDateKey?: string;
  timezone: string;
}) {
  const completed = new Set(completedDateKeys);
  const todayDateKey = getDateKey(now, timezone);
  let cursor = completed.has(todayDateKey)
    ? todayDateKey
    : getPreviousDateKey(todayDateKey);
  let groupStreakDays = 0;

  while (completed.has(cursor) && (!startDateKey || cursor >= startDateKey)) {
    groupStreakDays += 1;
    cursor = getPreviousDateKey(cursor);
  }

  return groupStreakDays;
}

async function getMembershipPeriods(circleRef: DocumentReference) {
  const historySnapshots = await circleRef
    .collection('membershipHistory')
    .get();

  if (historySnapshots.empty) {
    return {isKnown: false, periods: [] as MembershipPeriod[]};
  }

  const periodSnapshots = await Promise.all(
    historySnapshots.docs.map(history =>
      history.ref.collection('periods').get(),
    ),
  );
  const periods = periodSnapshots.flatMap((snapshot, index) => {
    const history = historySnapshots.docs[index];
    const fallbackUid = history?.id ?? '';

    return snapshot.docs.flatMap(periodSnapshot => {
      const period = periodSnapshot.data();
      const uid =
        typeof period.uid === 'string' && period.uid.trim().length > 0
          ? period.uid
          : fallbackUid;

      return uid && period.joinedAt
        ? [
            {
              joinedAt: period.joinedAt,
              leftAt: period.leftAt,
              opportunityEligibility: period.opportunityEligibility,
              uid,
            },
          ]
        : [];
    });
  });

  return {isKnown: periods.length > 0, periods};
}

async function getGroupDayCoverage({
  dateKey,
  periods,
  periodsKnown,
  timezone,
  dayRef,
}: {
  dateKey: string;
  dayRef: DocumentReference;
  periods: MembershipPeriod[];
  periodsKnown: boolean;
  timezone: string;
}): Promise<GroupDayCoverage> {
  if (!periodsKnown) {
    return {
      coveredMemberUids: [],
      expectedMemberUids: [],
      isKnown: false,
    };
  }

  const expectedMemberUids = Array.from(
    new Set(
      periods
        .filter(period =>
          isMemberExpectedForGroupDate({dateKey, period, timezone}),
        )
        .map(period => period.uid),
    ),
  ).sort();

  if (expectedMemberUids.length === 0) {
    return {coveredMemberUids: [], expectedMemberUids, isKnown: false};
  }

  const checkIns = await dayRef.collection('checkIns').get();
  const expectedUids = new Set(expectedMemberUids);
  const coveredMemberUids = checkIns.docs
    .filter(snapshot => isCoveredCheckInData(snapshot.data()))
    .map(snapshot => {
      const uid = snapshot.data().uid;
      return typeof uid === 'string' && uid.trim().length > 0
        ? uid
        : snapshot.id;
    })
    .filter(uid => expectedUids.has(uid));

  return {
    coveredMemberUids: Array.from(new Set(coveredMemberUids)).sort(),
    expectedMemberUids,
    isKnown: true,
  };
}

async function persistGroupDayCoverage({
  dateKey,
  dayRef,
  periods,
  periodsKnown,
  timezone,
}: {
  dateKey: string;
  dayRef: DocumentReference;
  periods: MembershipPeriod[];
  periodsKnown: boolean;
  timezone: string;
}) {
  const coverage = await getGroupDayCoverage({
    dateKey,
    dayRef,
    periods,
    periodsKnown,
    timezone,
  });
  const isComplete =
    coverage.isKnown &&
    coverage.expectedMemberUids.length > 0 &&
    coverage.coveredMemberUids.length === coverage.expectedMemberUids.length;

  await dayRef.set(
    {
      dateKey,
      groupStreakCohortKnown: coverage.isKnown,
      groupStreakComplete: isComplete,
      groupStreakCoveredMemberCount: coverage.coveredMemberUids.length,
      groupStreakCoveredMemberUids: coverage.coveredMemberUids,
      groupStreakExpectedMemberCount: coverage.expectedMemberUids.length,
      groupStreakExpectedMemberUids: coverage.expectedMemberUids,
      groupStreakUpdatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return isComplete;
}

export async function reconcileCircleGroupStreak({
  circleId,
  dateKey,
  now = new Date(),
}: {
  circleId: string;
  dateKey?: string;
  now?: Date;
}) {
  const circleRef = db.collection('circles').doc(circleId);
  const circleSnapshot = await circleRef.get();
  const circle = circleSnapshot.data();

  if (!circleSnapshot.exists || getCircleMode(circle) !== 'group') {
    return 0;
  }

  const timezone =
    typeof circle?.timezone === 'string' && circle.timezone.trim().length > 0
      ? circle.timezone
      : 'UTC';
  const {isKnown: periodsKnown, periods} = await getMembershipPeriods(
    circleRef,
  );
  const todayDateKey = getDateKey(now, timezone);
  const groupStreakStartDateKey = getMembershipDateKey(
    circle?.convertedAt,
    timezone,
  );
  const affectedDateKey = dateKey ?? todayDateKey;
  const affectedDayRef = circleRef.collection('days').doc(affectedDateKey);
  const affectedDaySnapshot = await affectedDayRef.get();

  if (
    affectedDaySnapshot.exists &&
    (!groupStreakStartDateKey || affectedDateKey >= groupStreakStartDateKey)
  ) {
    await persistGroupDayCoverage({
      dateKey: affectedDateKey,
      dayRef: affectedDayRef,
      periods,
      periodsKnown,
      timezone,
    });
  }

  const completedDateKeys = new Set<string>();
  let cursor = todayDateKey;
  let firstDay = true;

  while (true) {
    if (groupStreakStartDateKey && cursor < groupStreakStartDateKey) {
      break;
    }

    const daySnapshot = await circleRef.collection('days').doc(cursor).get();
    const day = daySnapshot.data();
    const isComplete = day?.groupStreakComplete === true;
    const isKnown = day?.groupStreakCohortKnown === true;

    if (firstDay && !isComplete) {
      cursor = getPreviousDateKey(cursor);
      firstDay = false;
      continue;
    }

    if (!isKnown || !isComplete) {
      break;
    }

    completedDateKeys.add(cursor);
    cursor = getPreviousDateKey(cursor);
    firstDay = false;
  }

  const groupStreakDays = calculateGroupDailyStreak({
    completedDateKeys,
    now,
    startDateKey: groupStreakStartDateKey,
    timezone,
  });
  const write = {
    groupStreakDays,
    groupStreakUpdatedAt: FieldValue.serverTimestamp(),
  };

  await circleRef.set(write, {merge: true});

  if (circle?.privacy === 'public') {
    await db
      .collection('publicCircleIndex')
      .doc(circleId)
      .set(write, {merge: true});
  }

  return groupStreakDays;
}
