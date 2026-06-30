import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {DateTime} from 'luxon';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {collections} from '../../../types/firestore';
import type {
  CircleDetailModel,
  CircleGroupProgressDay,
  CircleManagementCard,
  CircleManagementFilter,
  CircleMemberState,
  CircleMemberStatus,
  CircleMembershipStatus,
  CircleProgressDay,
  CircleSummary,
  CheckInStatus,
  CommitmentCadence,
  CommitmentFrequency,
  GraceRule,
  MemberRole,
  ProgressDayState,
} from '../../../types/models';
import {
  canTapInToday,
  getHomeCircleActionVariant,
} from './home-circle-actions';
export {
  canTapInToday,
  getHomeCircleActionVariant,
  type HomeCircleActionVariant,
} from './home-circle-actions';

export type HomeProgressCell = {
  dateKey: string;
  label: string;
  state: ProgressDayState;
};

export type HomeGreetingTimeWindow =
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening';

export type HomeGreetingCircleSummary = {
  atRiskCount: number;
  circleCount: number;
  doneCount: number;
  needsYouCount: number;
  pendingCount: number;
};

export type HomeGreetingContext = {
  circleSummary: HomeGreetingCircleSummary;
  firstName?: string;
  timeWindow: HomeGreetingTimeWindow;
};

export type HomeData = {
  circles: CircleManagementCard[];
  hasLoadedMemberships: boolean;
  hasRealProgress: boolean;
  membershipCount: number;
  personalStreakDays: number;
  progressDays: HomeProgressCell[];
  progressPercent: number;
  todayDateKey: string;
  todayLabel: string;
};

type PlainData = Record<string, unknown>;

export type HomeCircleMappingInput = {
  circleData?: PlainData;
  circleId: string;
  memberProfilesByUid?: ReadonlyMap<string, PlainData>;
  membersData?: PlainData[];
  membershipData?: PlainData;
  periodCheckInStatuses?: ReadonlyMap<string, ReadonlyMap<string, CheckInStatus>>;
  todayCheckInStatuses?: ReadonlyMap<string, CheckInStatus>;
  todayCheckInUids?: ReadonlySet<string>;
};

type CircleSubscriptionState = {
  circleData?: PlainData;
  memberProfiles: Map<string, PlainData>;
  memberProfileUnsubscribes: Map<string, () => void>;
  membersData?: PlainData[];
  periodCheckInStatuses: Map<string, Map<string, CheckInStatus>>;
  periodCheckInKey?: string;
  periodCheckInUnsubscribes: Array<() => void>;
  recentGroupCheckInKey?: string;
  recentGroupCheckInStatuses: Map<string, Map<string, CheckInStatus>>;
  recentGroupCheckInUnsubscribes: Array<() => void>;
  recentUserCheckIns: Map<string, boolean>;
  todayCheckInStatuses: Map<string, CheckInStatus>;
};

type HomeSubscriptionOptions = {
  lookbackDays?: number;
  onData: (data: HomeData) => void;
  onError: (error: Error) => void;
  timezone: string;
  uid: string;
};

type CircleDetailSubscriptionOptions = {
  circleId: string;
  onDetail: (detail?: CircleDetailModel) => void;
  onError: (error: Error) => void;
  timezone: string;
  uid: string;
};

const activeStatuses = new Set(['active', 'pending']);

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampTapInsPerWeek(value: number) {
  return Math.min(7, Math.max(1, Math.round(value)));
}

function normalizeCommitmentFrequency(
  value: unknown,
  cadence: CommitmentCadence = 'weekly',
): CommitmentFrequency {
  if (cadence === 'daily') {
    return {tapInsPerWeek: 7};
  }

  const data = value && typeof value === 'object' ? (value as PlainData) : {};
  const tapInsPerWeek = clampTapInsPerWeek(asNumber(data.tapInsPerWeek, 7));

  if (cadence === 'monthly') {
    return {
      opportunitiesPerPeriod: Math.min(
        31,
        Math.max(1, Math.round(asNumber(data.opportunitiesPerPeriod, 4))),
      ),
      tapInsPerWeek,
    };
  }

  return {
    tapInsPerWeek,
  };
}

function normalizeCommitmentCadence(
  value: unknown,
  frequencyValue: unknown,
): CommitmentCadence {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }

  return normalizeCommitmentFrequency(frequencyValue, 'weekly').tapInsPerWeek >= 7
    ? 'daily'
    : 'weekly';
}

function getCommitmentPeriodLabel(cadence: CommitmentCadence) {
  return cadence === 'daily'
    ? 'Today'
    : cadence === 'monthly'
    ? 'Month'
    : 'Week';
}

function getCleanFirstName(value?: string) {
  const firstName = value
    ?.trim()
    .split(/\s+/)[0]
    ?.replace(/[^A-Za-z'-]/g, '');

  return firstName && firstName.length > 0 ? firstName.slice(0, 24) : undefined;
}

function normalizeMembershipStatus(
  value: unknown,
): CircleMembershipStatus | undefined {
  return value === 'active' || value === 'pending' ? value : undefined;
}

function normalizeMemberRole(value: unknown): MemberRole {
  return value === 'owner' || value === 'admin' || value === 'member'
    ? value
    : 'member';
}

function normalizePrivacy(value: unknown) {
  return value === 'private' || value === 'public' ? value : 'private';
}

function normalizeJoinMode(value: unknown) {
  return value === 'open' ||
    value === 'invite_only' ||
    value === 'request_to_join'
    ? value
    : 'invite_only';
}

function normalizeCheckInStatus(value: unknown): CheckInStatus | undefined {
  return value === 'done' || value === 'skip' ? value : undefined;
}

function isCoveredCheckInStatus(value: unknown) {
  const status = normalizeCheckInStatus(value);

  return status === 'done' || status === 'skip';
}

function normalizeGraceRule(value: unknown): GraceRule {
  const data = value && typeof value === 'object' ? (value as PlainData) : {};
  const allowance = asNumber(data.allowance, 1);
  const windowDays = asNumber(data.windowDays, 7);

  return {
    allowance: Math.min(30, Math.max(0, Math.round(allowance))),
    windowDays: Math.min(365, Math.max(1, Math.round(windowDays))),
  };
}

function normalizeGraceRules(value: unknown) {
  const data = value && typeof value === 'object' ? (value as PlainData) : {};

  return {
    skip: normalizeGraceRule(data.skip),
  };
}

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'HO';
}

function getMemberLabel(memberData: PlainData) {
  return asString(
    memberData.displayName,
    asString(memberData.name, asString(memberData.handle, 'Hoyst member')),
  );
}

function getMemberAvatarUrl(memberData: PlainData) {
  return asString(
    memberData.avatarUrl,
    asString(memberData.photoURL, asString(memberData.photoUrl)),
  );
}

function mergeMemberProfileData(
  memberData: PlainData,
  memberProfilesByUid?: ReadonlyMap<string, PlainData>,
) {
  const uid = asString(memberData.uid, asString(memberData.id));
  const profileData = uid ? memberProfilesByUid?.get(uid) : undefined;

  if (!profileData) {
    return memberData;
  }

  const avatarUrl =
    getMemberAvatarUrl(memberData) || getMemberAvatarUrl(profileData);
  const displayName = asString(
    memberData.displayName,
    asString(
      memberData.name,
      asString(profileData.displayName, asString(profileData.name)),
    ),
  );
  const handle = asString(memberData.handle, asString(profileData.handle));

  return {
    ...profileData,
    ...memberData,
    ...(avatarUrl ? {avatarUrl} : {}),
    ...(displayName ? {displayName} : {}),
    ...(handle ? {handle} : {}),
  };
}

function getMemberState(
  memberData: PlainData,
  memberCoveredCounts: ReadonlyMap<string, number>,
  todayCheckInStatuses: ReadonlyMap<string, CheckInStatus>,
  requiredTapIns: number,
): CircleMemberState {
  const status = normalizeMembershipStatus(memberData.status);
  const uid = asString(memberData.uid);

  if (status !== 'active') {
    return 'pending';
  }

  const checkInStatus = uid ? todayCheckInStatuses.get(uid) : undefined;
  const coveredCount = uid ? memberCoveredCounts.get(uid) ?? 0 : 0;

  if (checkInStatus === 'skip') {
    return 'skipped';
  }

  if (coveredCount >= requiredTapIns) {
    return 'done';
  }

  return 'pending';
}

function mapMemberStatus(
  memberData: PlainData,
  memberCoveredCounts: ReadonlyMap<string, number>,
  todayCheckInStatuses: ReadonlyMap<string, CheckInStatus>,
  requiredTapIns: number,
): CircleMemberStatus | undefined {
  const status = normalizeMembershipStatus(memberData.status);
  const uid = asString(memberData.uid, asString(memberData.id));
  const name = getMemberLabel(memberData);

  if (!uid) {
    return undefined;
  }

  const avatarUrl = getMemberAvatarUrl(memberData);

  return {
    ...(avatarUrl ? {avatarUrl} : {}),
    id: uid,
    initials: getInitials(name),
    membershipStatus: status,
    name,
    state: getMemberState(
      memberData,
      memberCoveredCounts,
      todayCheckInStatuses,
      requiredTapIns,
    ),
  };
}

function getInviteUrl(circleData: PlainData) {
  const inviteUrl = asString(circleData.inviteUrl);
  const inviteCode = asString(circleData.inviteCode);

  if (inviteUrl) {
    return inviteUrl;
  }

  return inviteCode ? `https://hoyst.app/join/${inviteCode}` : undefined;
}

export function getDateKey(date: Date, timezone: string) {
  return DateTime.fromJSDate(date, {zone: timezone}).toFormat('yyyy-LL-dd');
}

function normalizeLookbackDays(lookbackDays = 7) {
  return Number.isInteger(lookbackDays) && lookbackDays > 0 ? lookbackDays : 7;
}

function getRecentDates(
  timezone: string,
  now = new Date(),
  lookbackDays = 7,
) {
  const today = DateTime.fromJSDate(now, {zone: timezone}).startOf('day');
  const dayCount = normalizeLookbackDays(lookbackDays);

  return Array.from({length: dayCount}, (_, index) => {
    const date = today.minus({days: dayCount - 1 - index});
    return {
      dateKey: date.toFormat('yyyy-LL-dd'),
      label: date.toFormat('dd'),
    };
  });
}

function getCommitmentWeekDateKeys(timezone: string, now = new Date()) {
  const startOfWeek = DateTime.fromJSDate(now, {zone: timezone})
    .startOf('week')
    .startOf('day');

  return Array.from({length: 7}, (_, index) =>
    startOfWeek.plus({days: index}).toFormat('yyyy-LL-dd'),
  );
}

function getCommitmentMonthDateKeys(timezone: string, now = new Date()) {
  const startOfMonth = DateTime.fromJSDate(now, {zone: timezone})
    .startOf('month')
    .startOf('day');
  const dayCount = startOfMonth.daysInMonth ?? 31;

  return Array.from({length: dayCount}, (_, index) =>
    startOfMonth.plus({days: index}).toFormat('yyyy-LL-dd'),
  );
}

function getCommitmentPeriodDateKeys(
  cadence: CommitmentCadence,
  timezone: string,
  now = new Date(),
) {
  if (cadence === 'daily') {
    return [getDateKey(now, timezone)];
  }

  if (cadence === 'monthly') {
    return getCommitmentMonthDateKeys(timezone, now);
  }

  return getCommitmentWeekDateKeys(timezone, now);
}

function buildProgressDays(
  timezone: string,
  completedDateKeys: ReadonlySet<string>,
  now?: Date,
  lookbackDays = 7,
): HomeProgressCell[] {
  const recentDates = getRecentDates(timezone, now, lookbackDays);
  const todayDateKey = recentDates[recentDates.length - 1]?.dateKey ?? '';

  return recentDates.map(day => ({
    ...day,
    state: completedDateKeys.has(day.dateKey)
      ? 'done'
      : day.dateKey === todayDateKey
      ? 'today'
      : 'future',
  }));
}

export function buildCircleGroupProgressDays({
  memberRecords,
  now,
  recentCheckInStatuses,
  timezone,
}: {
  memberRecords: ReadonlyArray<Record<string, unknown>>;
  now?: Date;
  recentCheckInStatuses: ReadonlyMap<
    string,
    ReadonlyMap<string, CheckInStatus>
  >;
  timezone: string;
}): CircleGroupProgressDay[] {
  const memberUids = memberRecords
    .map(memberData => asString(memberData.uid, asString(memberData.id)))
    .filter(Boolean);
  const totalCount = memberUids.length;

  return getRecentDates(timezone, now).map(day => {
    const dayStatuses = recentCheckInStatuses.get(day.dateKey);
    const coveredCount = memberUids.reduce(
      (total, memberUid) =>
        isCoveredCheckInStatus(dayStatuses?.get(memberUid)) ? total + 1 : total,
      0,
    );

    return {
      ...day,
      coveredCount,
      state: totalCount > 0 && coveredCount >= totalCount ? 'done' : 'future',
      totalCount,
    };
  });
}

function calculatePersonalStreak(
  completedDateKeys: ReadonlySet<string>,
  timezone: string,
  now = new Date(),
) {
  let cursor = DateTime.fromJSDate(now, {zone: timezone}).startOf('day');
  let count = 0;

  if (!completedDateKeys.has(cursor.toFormat('yyyy-LL-dd'))) {
    cursor = cursor.minus({days: 1});
  }

  while (completedDateKeys.has(cursor.toFormat('yyyy-LL-dd'))) {
    count += 1;
    cursor = cursor.minus({days: 1});
  }

  return count;
}

export function getHomeGreetingTimeWindow({
  now = new Date(),
  timezone,
}: {
  now?: Date;
  timezone: string;
}): HomeGreetingTimeWindow {
  const hour = DateTime.fromJSDate(now, {zone: timezone}).hour;

  if (hour >= 5 && hour < 11) {
    return 'morning';
  }
  if (hour >= 11 && hour < 15) {
    return 'midday';
  }
  if (hour >= 15 && hour < 18) {
    return 'afternoon';
  }
  return 'evening';
}

export function getHomeGreetingCircleSummary(
  circles: readonly CircleManagementCard[],
): HomeGreetingCircleSummary {
  return circles.reduce(
    (summary, circle) => {
      if (circle.viewerMembershipStatus === 'pending') {
        summary.pendingCount += 1;
        return summary;
      }

      if (canTapInToday(circle)) {
        summary.needsYouCount += 1;
      }
      if (circle.state === 'risk') {
        summary.atRiskCount += 1;
      }
      if (circle.state === 'done') {
        summary.doneCount += 1;
      }

      return summary;
    },
    {
      atRiskCount: 0,
      circleCount: circles.length,
      doneCount: 0,
      needsYouCount: 0,
      pendingCount: 0,
    },
  );
}

export function getHomeGreetingContext({
  circles,
  firstName,
  now,
  timezone,
}: {
  circles: readonly CircleManagementCard[];
  firstName?: string;
  now?: Date;
  timezone: string;
}): HomeGreetingContext {
  return {
    circleSummary: getHomeGreetingCircleSummary(circles),
    firstName: getCleanFirstName(firstName),
    timeWindow: getHomeGreetingTimeWindow({now, timezone}),
  };
}

function buildGreetingWithName(
  firstName: string | undefined,
  copy: string,
  copyWithoutName?: string,
) {
  return firstName ? `${firstName}, ${copy}` : copyWithoutName ?? copy;
}

export function getHomeGreetingFallback({
  circles,
  firstName,
  now,
  timezone,
}: {
  circles: readonly CircleManagementCard[];
  firstName?: string;
  now?: Date;
  timezone: string;
}) {
  const context = getHomeGreetingContext({circles, firstName, now, timezone});
  const {circleSummary, timeWindow} = context;

  if (circleSummary.circleCount === 0) {
    return buildGreetingWithName(
      context.firstName,
      'no circles yet. Bold strategy, let us fix it.',
      'No circles yet. Bold strategy, let us fix it.',
    );
  }

  if (circleSummary.needsYouCount > 0) {
    return buildGreetingWithName(
      context.firstName,
      'your circles are waiting. Make it quick and undeniable.',
      'Your circles are waiting. Make it quick and undeniable.',
    );
  }

  if (circleSummary.atRiskCount > 0) {
    return buildGreetingWithName(
      context.firstName,
      'pressure is up. Perfect, now it counts.',
      'Pressure is up. Perfect, now it counts.',
    );
  }

  if (circleSummary.pendingCount > 0) {
    return buildGreetingWithName(
      context.firstName,
      'pending approval. Patience, but make it productive.',
      'Pending approval. Patience, but make it productive.',
    );
  }

  if (circleSummary.doneCount === circleSummary.circleCount) {
    return buildGreetingWithName(
      context.firstName,
      'all checked in. Try not to act surprised.',
      'All checked in. Try not to act surprised.',
    );
  }

  if (timeWindow === 'morning') {
    return buildGreetingWithName(
      context.firstName,
      'morning. New day, same Commitment, fewer excuses.',
      'Morning. New day, same Commitment, fewer excuses.',
    );
  }

  if (timeWindow === 'midday') {
    return buildGreetingWithName(
      context.firstName,
      'midday check. Winning, or just looking busy?',
      'Midday check. Winning, or just looking busy?',
    );
  }

  if (timeWindow === 'afternoon') {
    return buildGreetingWithName(
      context.firstName,
      'afternoon test. Finish strong so tonight feels earned.',
      'Afternoon test. Finish strong so tonight feels earned.',
    );
  }

  return buildGreetingWithName(
    context.firstName,
    'last lap. Make the day look planned.',
    'Last lap. Make the day look planned.',
  );
}

export function createEmptyHomeData(
  timezone = 'UTC',
  now = new Date(),
  lookbackDays = 7,
) {
  const completedDateKeys = new Set<string>();
  const progressDays = buildProgressDays(
    timezone,
    completedDateKeys,
    now,
    lookbackDays,
  );
  const today = DateTime.fromJSDate(now, {zone: timezone});

  return {
    circles: [],
    hasLoadedMemberships: false,
    hasRealProgress: false,
    membershipCount: 0,
    personalStreakDays: 0,
    progressDays,
    progressPercent: 0,
    todayDateKey: today.toFormat('yyyy-LL-dd'),
    todayLabel: today.toFormat('cccc, LLLL d'),
  } satisfies HomeData;
}

export function buildHomeDataFromCircles({
  circles,
  completedDateKeys,
  hasLoadedMemberships = true,
  lookbackDays = 7,
  membershipCount = circles.length,
  timezone,
  now = new Date(),
}: {
  circles: CircleManagementCard[];
  completedDateKeys: ReadonlySet<string>;
  hasLoadedMemberships?: boolean;
  lookbackDays?: number;
  membershipCount?: number;
  now?: Date;
  timezone: string;
}) {
  const progressDays = buildProgressDays(
    timezone,
    completedDateKeys,
    now,
    lookbackDays,
  );
  const completedDays = progressDays.filter(day => day.state === 'done').length;
  const today = DateTime.fromJSDate(now, {zone: timezone});

  return {
    circles,
    hasLoadedMemberships,
    hasRealProgress: completedDateKeys.size > 0,
    membershipCount,
    personalStreakDays: calculatePersonalStreak(
      completedDateKeys,
      timezone,
      now,
    ),
    progressDays,
    progressPercent: Math.round((completedDays / progressDays.length) * 100),
    todayDateKey: today.toFormat('yyyy-LL-dd'),
    todayLabel: today.toFormat('cccc, LLLL d'),
  } satisfies HomeData;
}

function getPeriodCoveredCounts(
  periodCheckInStatuses: ReadonlyMap<
    string,
    ReadonlyMap<string, CheckInStatus>
  >,
) {
  const counts = new Map<string, number>();

  periodCheckInStatuses.forEach(dayStatuses => {
    dayStatuses.forEach((status, uid) => {
      if (isCoveredCheckInStatus(status)) {
        counts.set(uid, (counts.get(uid) ?? 0) + 1);
      }
    });
  });

  return counts;
}

function getPeriodCoveredTotal(
  memberRecords: PlainData[],
  memberCoveredCounts: ReadonlyMap<string, number>,
  requiredTapIns: number,
) {
  return memberRecords.reduce((total, memberData) => {
    if (normalizeMembershipStatus(memberData.status) !== 'active') {
      return total;
    }

    const uid = asString(memberData.uid, asString(memberData.id));
    return total + Math.min(memberCoveredCounts.get(uid) ?? 0, requiredTapIns);
  }, 0);
}

function getNudgeTargetCount({
  memberCoveredCounts,
  memberRecords,
  requiredTapIns,
  todayCheckInStatuses,
  viewerUid,
}: {
  memberCoveredCounts: ReadonlyMap<string, number>;
  memberRecords: PlainData[];
  requiredTapIns: number;
  todayCheckInStatuses: ReadonlyMap<string, CheckInStatus>;
  viewerUid: string;
}) {
  return memberRecords.reduce((total, memberData) => {
    if (normalizeMembershipStatus(memberData.status) !== 'active') {
      return total;
    }

    const uid = asString(memberData.uid, asString(memberData.id));

    if (!uid || uid === viewerUid) {
      return total;
    }

    if (isCoveredCheckInStatus(todayCheckInStatuses.get(uid))) {
      return total;
    }

    return (memberCoveredCounts.get(uid) ?? 0) >= requiredTapIns
      ? total
      : total + 1;
  }, 0);
}

export function mapHomeCircleFromData({
  circleData,
  circleId,
  memberProfilesByUid,
  membersData = [],
  membershipData,
  periodCheckInStatuses,
  todayCheckInStatuses,
  todayCheckInUids = new Set<string>(),
}: HomeCircleMappingInput): CircleManagementCard | undefined {
  const membershipStatus = normalizeMembershipStatus(membershipData?.status);

  if (!circleData || !membershipData || !membershipStatus) {
    return undefined;
  }

  const title = asString(circleData.title);
  const commitment = asString(circleData.commitment);

  if (!title || !commitment) {
    return undefined;
  }

  const uid = asString(membershipData.uid);
  const coveredCheckIns =
    todayCheckInStatuses ??
    new Map(
      Array.from(todayCheckInUids).map(checkInUid => [
        checkInUid,
        'done' as CheckInStatus,
      ]),
    );
  const periodStatuses =
    periodCheckInStatuses ??
    new Map<string, ReadonlyMap<string, CheckInStatus>>([
      ['today', coveredCheckIns],
    ]);
  const commitmentCadence = normalizeCommitmentCadence(
    circleData.commitmentCadence,
    circleData.commitmentFrequency,
  );
  const commitmentFrequency = normalizeCommitmentFrequency(
    circleData.commitmentFrequency,
    commitmentCadence,
  );
  const tapInsPerWeek = commitmentFrequency.tapInsPerWeek;
  const requiredTapIns =
    commitmentCadence === 'daily'
      ? 1
      : commitmentCadence === 'monthly'
      ? commitmentFrequency.opportunitiesPerPeriod ?? tapInsPerWeek
      : tapInsPerWeek;
  const scoringStatuses =
    commitmentCadence === 'daily'
      ? new Map<string, ReadonlyMap<string, CheckInStatus>>([
          ['today', coveredCheckIns],
        ])
      : periodStatuses;
  const memberCoveredCounts = getPeriodCoveredCounts(scoringStatuses);
  const isPending = membershipStatus === 'pending';
  const memberRecords = membersData.length > 0 ? membersData : [membershipData];
  const activeMemberCount = memberRecords.filter(
    memberData => normalizeMembershipStatus(memberData.status) === 'active',
  ).length;
  const visibleMembers = memberRecords
    .map(memberData => mergeMemberProfileData(memberData, memberProfilesByUid))
    .map(memberData =>
      mapMemberStatus(
        memberData,
        memberCoveredCounts,
        coveredCheckIns,
        requiredTapIns,
      ),
    )
    .filter((member): member is CircleMemberStatus => Boolean(member));
  const memberCount = asNumber(
    circleData.memberCount,
    Math.max(memberRecords.length, visibleMembers.length),
  );
  const progressBase =
    Math.max(activeMemberCount, isPending ? 0 : memberCount) * requiredTapIns;
  const periodCoveredCount = getPeriodCoveredTotal(
    memberRecords,
    memberCoveredCounts,
    requiredTapIns,
  );
  const progressPercent =
    progressBase > 0
      ? Math.min(100, Math.round((periodCoveredCount / progressBase) * 100))
      : 0;
  const nudgeTargetCount = getNudgeTargetCount({
    memberCoveredCounts,
    memberRecords,
    requiredTapIns,
    todayCheckInStatuses: coveredCheckIns,
    viewerUid: uid,
  });
  const viewerTodayStatus = uid ? coveredCheckIns.get(uid) : undefined;
  const viewerCoveredCount = uid ? memberCoveredCounts.get(uid) ?? 0 : 0;
  const viewerHasTappedInToday = Boolean(viewerTodayStatus);
  const viewerRemainingTapIns = isPending
    ? 0
    : Math.max(requiredTapIns - viewerCoveredCount, 0);
  const viewerHasCheckedIn = isPending ? true : viewerRemainingTapIns === 0;
  const remainingCheckIns = isPending
    ? 0
    : Math.max(progressBase - periodCoveredCount, 0);
  const streakDays = asNumber(membershipData.streakDays, 0);
  const state = isPending
    ? 'active'
    : remainingCheckIns === 0 && progressBase > 0
    ? 'done'
    : !viewerHasCheckedIn && progressPercent < 50
    ? 'risk'
    : 'active';
  const matchCopy = isPending
    ? 'Pending approval before Tap In unlocks.'
    : asString(circleData.matchCopy);
  const periodLabel = getCommitmentPeriodLabel(commitmentCadence);
  const progressLabel = `${periodLabel} · ${progressPercent}%`;

  return {
    category: asString(circleData.category, 'General'),
    completionRate: progressPercent,
    commitmentCadence,
    commitment,
    commitmentFrequency,
    graceRules: normalizeGraceRules(circleData.graceRules),
    id: circleId,
    inviteUrl: getInviteUrl(circleData),
    joinMode: normalizeJoinMode(circleData.joinMode),
    matchCopy: matchCopy || undefined,
    maxSize: asNumber(circleData.maxSize, Math.max(memberCount, 1)),
    memberCount,
    members: visibleMembers,
    nudgeTargetCount,
    privacy: normalizePrivacy(circleData.privacy),
    completionLabel: isPending ? 'Pending approval' : progressLabel,
    progressLabel: isPending ? 'Pending approval' : progressLabel,
    progressPercent,
    remainingCheckIns,
    state,
    streakDays,
    streakLabel: isPending
      ? 'Pending approval'
      : streakDays > 0
      ? `${streakDays}d streak`
      : viewerHasCheckedIn
      ? 'Already tapped in'
      : viewerHasTappedInToday
      ? 'Tapped today'
      : 'Start today',
    title,
    timezone: asString(circleData.timezone, 'UTC'),
    viewerHasCheckedIn,
    viewerHasTappedInToday,
    viewerMembershipStatus: membershipStatus,
    viewerRemainingTapIns,
    viewerRole: normalizeMemberRole(membershipData.role),
    viewerTodayStatus,
  };
}

export function getHomeCircleUrgencyRank(circle: CircleManagementCard) {
  if (circle.viewerMembershipStatus === 'pending') {
    return 6;
  }

  const needsViewer = canTapInToday(circle);
  const isAtRisk = circle.state === 'risk';
  const hasPendingToday =
    circle.state !== 'done' && circle.remainingCheckIns > 0;

  if (needsViewer && isAtRisk) {
    return 0;
  }
  if (needsViewer) {
    return 1;
  }
  if (isAtRisk) {
    return 2;
  }
  if (hasPendingToday) {
    return 3;
  }
  if (circle.state === 'done') {
    return 5;
  }
  return 4;
}

export function getTodayAttentionCircles(circles: CircleManagementCard[]) {
  return sortHomeCircles(
    circles.filter(circle =>
      ['check_in', 'nudge'].includes(getHomeCircleActionVariant(circle)),
    ),
  );
}

function needsUpcomingAttention(circle: CircleManagementCard) {
  if (circle.viewerMembershipStatus === 'pending') {
    return true;
  }

  const actionVariant = getHomeCircleActionVariant(circle);

  if (actionVariant === 'check_in' || actionVariant === 'nudge') {
    return false;
  }

  if (circle.commitmentCadence === 'daily') {
    return Boolean(circle.viewerHasCheckedIn || circle.viewerHasTappedInToday);
  }

  return (
    (circle.viewerRemainingTapIns ?? 0) > 0 || circle.remainingCheckIns > 0
  );
}

export function getUpcomingAttentionCircles(circles: CircleManagementCard[]) {
  return sortHomeCircles(circles.filter(needsUpcomingAttention));
}

export function matchesHomeCircleFilter(
  circle: CircleManagementCard,
  filter: CircleManagementFilter,
) {
  if (circle.viewerMembershipStatus === 'pending') {
    return filter === 'all';
  }

  if (filter === 'needsYou') {
    return canTapInToday(circle);
  }
  if (filter === 'atRisk') {
    return circle.state === 'risk';
  }
  if (filter === 'done') {
    return circle.state === 'done';
  }
  return true;
}

export function sortHomeCircles(circles: CircleManagementCard[]) {
  return [...circles].sort((left, right) => {
    const rankDelta =
      getHomeCircleUrgencyRank(left) - getHomeCircleUrgencyRank(right);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    const progressDelta = left.progressPercent - right.progressPercent;

    if (progressDelta !== 0) {
      return progressDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getHomeFilterCounts(circles: CircleManagementCard[]) {
  const filters: CircleManagementFilter[] = [
    'all',
    'needsYou',
    'atRisk',
    'done',
  ];

  return filters.reduce(
    (counts, filter) => ({
      ...counts,
      [filter]: circles.filter(circle =>
        matchesHomeCircleFilter(circle, filter),
      ).length,
    }),
    {} as Record<CircleManagementFilter, number>,
  );
}

export function shouldShowHomeCreateCircleButton({
  isAuthenticatedHome,
  showAccountPrompt,
}: {
  isAuthenticatedHome: boolean;
  showAccountPrompt: boolean;
}) {
  return isAuthenticatedHome || showAccountPrompt;
}

export function shouldShowAuthenticatedHomeEmptyState({
  circleCount,
  hasHomeDataError,
  hasLoadedMemberships,
  isAuthenticatedHome,
  isLoadingHomeData,
  membershipCount,
}: {
  circleCount: number;
  hasHomeDataError: boolean;
  hasLoadedMemberships: boolean;
  isAuthenticatedHome: boolean;
  isLoadingHomeData: boolean;
  membershipCount: number;
}) {
  return (
    isAuthenticatedHome &&
    !isLoadingHomeData &&
    circleCount === 0 &&
    membershipCount === 0 &&
    (hasLoadedMemberships || !hasHomeDataError)
  );
}

export function shouldShowHomeDataErrorPanel({
  circleCount,
  hasHomeDataError,
  hasLoadedMemberships,
  isLoadingHomeData,
  membershipCount,
}: {
  circleCount: number;
  hasHomeDataError: boolean;
  hasLoadedMemberships: boolean;
  isLoadingHomeData: boolean;
  membershipCount: number;
}) {
  return (
    hasHomeDataError &&
    !isLoadingHomeData &&
    circleCount === 0 &&
    (!hasLoadedMemberships || membershipCount > 0)
  );
}

function getMembershipCircleId(
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
) {
  return snapshot.ref.parent.parent?.id;
}

function snapshotData(
  snapshot:
    | FirebaseFirestoreTypes.DocumentSnapshot
    | FirebaseFirestoreTypes.QueryDocumentSnapshot,
) {
  const data = snapshot.data();
  return data ? ({...data, id: snapshot.id} as PlainData) : undefined;
}

function buildCircleFromState(
  circleId: string,
  membershipData: PlainData,
  state?: CircleSubscriptionState,
) {
  return mapHomeCircleFromData({
    circleData: state?.circleData,
    circleId,
    memberProfilesByUid: state?.memberProfiles,
    membersData: state?.membersData,
    membershipData,
    periodCheckInStatuses: state?.periodCheckInStatuses,
    todayCheckInStatuses: state?.todayCheckInStatuses,
  });
}

function syncMemberProfileListeners({
  memberRecords,
  onError,
  onUpdate,
  state,
}: {
  memberRecords: PlainData[];
  onError: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
}) {
  const firestore = firebaseFirestore();
  const nextUids = new Set(
    memberRecords
      .map(memberData => asString(memberData.uid, asString(memberData.id)))
      .filter(Boolean),
  );

  state.memberProfileUnsubscribes.forEach((unsubscribe, memberUid) => {
    if (!nextUids.has(memberUid)) {
      unsubscribe();
      state.memberProfileUnsubscribes.delete(memberUid);
      state.memberProfiles.delete(memberUid);
    }
  });

  nextUids.forEach(memberUid => {
    if (state.memberProfileUnsubscribes.has(memberUid)) {
      return;
    }

    const unsubscribe = firestore
      .collection(collections.users)
      .doc(memberUid)
      .onSnapshot(snapshot => {
        const profileData = snapshotData(snapshot);

        if (profileData) {
          state.memberProfiles.set(memberUid, profileData);
        } else {
          state.memberProfiles.delete(memberUid);
        }

        onUpdate();
      }, onError);

    state.memberProfileUnsubscribes.set(memberUid, unsubscribe);
  });
}

function clearMemberProfileListeners(state: CircleSubscriptionState) {
  state.memberProfileUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.memberProfileUnsubscribes.clear();
  state.memberProfiles.clear();
}

function getCoveredStatusesFromSnapshot(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot,
) {
  return new Map(
    snapshot.docs
      .map(doc => {
        const uidValue = asString(doc.data().uid, doc.id);
        const status = normalizeCheckInStatus(doc.data().status) ?? 'done';

        return uidValue && isCoveredCheckInStatus(status)
          ? ([uidValue, status] as const)
          : undefined;
      })
      .filter((entry): entry is readonly [string, CheckInStatus] =>
        Boolean(entry),
      ),
  );
}

function clearPeriodCheckInListeners(state: CircleSubscriptionState) {
  state.periodCheckInUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.periodCheckInUnsubscribes = [];
  state.periodCheckInKey = undefined;
  state.periodCheckInStatuses.clear();
  state.todayCheckInStatuses = new Map();
}

function clearRecentGroupCheckInListeners(state: CircleSubscriptionState) {
  state.recentGroupCheckInUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.recentGroupCheckInUnsubscribes = [];
  state.recentGroupCheckInKey = undefined;
  state.recentGroupCheckInStatuses.clear();
}

function syncPeriodCheckInListeners({
  cadence,
  circleRef,
  onError,
  onUpdate,
  state,
  timezone,
}: {
  cadence: CommitmentCadence;
  circleRef: FirebaseFirestoreTypes.DocumentReference;
  onError: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
  timezone: string;
}) {
  const periodDateKeys = getCommitmentPeriodDateKeys(cadence, timezone);
  const todayDateKey = getDateKey(new Date(), timezone);
  const periodCheckInKey = `${timezone}:${cadence}:${periodDateKeys.join('|')}`;

  if (state.periodCheckInKey === periodCheckInKey) {
    return;
  }

  clearPeriodCheckInListeners(state);
  state.periodCheckInKey = periodCheckInKey;

  periodDateKeys.forEach(dateKey => {
    state.periodCheckInUnsubscribes.push(
      circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .onSnapshot(snapshot => {
          const dayStatuses = getCoveredStatusesFromSnapshot(snapshot);

          state.periodCheckInStatuses.set(dateKey, dayStatuses);
          if (dateKey === todayDateKey) {
            state.todayCheckInStatuses = dayStatuses;
          }
          onUpdate();
        }, onError),
    );
  });
}

function syncRecentGroupCheckInListeners({
  circleRef,
  onError,
  onUpdate,
  state,
  timezone,
}: {
  circleRef: FirebaseFirestoreTypes.DocumentReference;
  onError: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
  timezone: string;
}) {
  const recentDateKeys = getRecentDates(timezone).map(day => day.dateKey);
  const recentGroupCheckInKey = `${timezone}:${recentDateKeys.join('|')}`;

  if (state.recentGroupCheckInKey === recentGroupCheckInKey) {
    return;
  }

  clearRecentGroupCheckInListeners(state);
  state.recentGroupCheckInKey = recentGroupCheckInKey;

  recentDateKeys.forEach(dateKey => {
    state.recentGroupCheckInUnsubscribes.push(
      circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .onSnapshot(snapshot => {
          state.recentGroupCheckInStatuses.set(
            dateKey,
            getCoveredStatusesFromSnapshot(snapshot),
          );
          onUpdate();
        }, onError),
    );
  });
}

function recentCompletedDateKeys(
  states: Map<string, CircleSubscriptionState>,
  recentDateKeys: string[],
) {
  return new Set(
    recentDateKeys.filter(dateKey =>
      Array.from(states.values()).some(
        state => state.recentUserCheckIns.get(dateKey) === true,
      ),
    ),
  );
}

export function subscribeToHomeData({
  lookbackDays = 7,
  onData,
  onError,
  timezone,
  uid,
}: HomeSubscriptionOptions) {
  const firestore = firebaseFirestore();
  const recentDateKeys = getRecentDates(timezone, new Date(), lookbackDays).map(
    day => day.dateKey,
  );
  const memberships = new Map<string, PlainData>();
  const states = new Map<string, CircleSubscriptionState>();
  let circleUnsubscribes: Array<() => void> = [];

  const emit = () => {
    const circles = sortHomeCircles(
      Array.from(memberships.entries())
        .map(([circleId, membershipData]) =>
          buildCircleFromState(circleId, membershipData, states.get(circleId)),
        )
        .filter((circle): circle is CircleManagementCard => Boolean(circle)),
    );

    onData(
      buildHomeDataFromCircles({
        circles,
        completedDateKeys: recentCompletedDateKeys(states, recentDateKeys),
        hasLoadedMemberships: true,
        lookbackDays,
        membershipCount: memberships.size,
        timezone,
      }),
    );
  };

  const stopCircleListeners = () => {
    circleUnsubscribes.forEach(unsubscribe => unsubscribe());
    circleUnsubscribes = [];
    states.forEach(state => {
      clearMemberProfileListeners(state);
      clearPeriodCheckInListeners(state);
      clearRecentGroupCheckInListeners(state);
    });
    states.clear();
  };

  const startCircleListeners = () => {
    stopCircleListeners();

    memberships.forEach((membershipData, circleId) => {
      const membershipStatus = normalizeMembershipStatus(membershipData.status);
      const circleRef = firestore.collection(collections.circles).doc(circleId);
      const state: CircleSubscriptionState = {
        memberProfiles: new Map(),
        memberProfileUnsubscribes: new Map(),
        membersData: [membershipData],
        periodCheckInStatuses: new Map(),
        periodCheckInUnsubscribes: [],
        recentGroupCheckInStatuses: new Map(),
        recentGroupCheckInUnsubscribes: [],
        recentUserCheckIns: new Map(),
        todayCheckInStatuses: new Map(),
      };

      states.set(circleId, state);
      syncMemberProfileListeners({
        memberRecords: [membershipData],
        onError,
        onUpdate: emit,
        state,
      });

      circleUnsubscribes.push(
        circleRef.onSnapshot(snapshot => {
          state.circleData = snapshotData(snapshot);
          if (membershipStatus === 'active') {
            syncPeriodCheckInListeners({
              cadence: normalizeCommitmentCadence(
                state.circleData?.commitmentCadence,
                state.circleData?.commitmentFrequency,
              ),
              circleRef,
              onError,
              onUpdate: emit,
              state,
              timezone: asString(state.circleData?.timezone, 'UTC'),
            });
          }
          emit();
        }, onError),
      );

      if (membershipStatus !== 'active') {
        return;
      }

      circleUnsubscribes.push(
        circleRef.collection('members').onSnapshot(snapshot => {
          state.membersData = snapshot.docs
            .map(snapshotData)
            .filter((memberData): memberData is PlainData =>
              Boolean(
                memberData && activeStatuses.has(asString(memberData.status)),
              ),
            );
          syncMemberProfileListeners({
            memberRecords: state.membersData,
            onError,
            onUpdate: emit,
            state,
          });
          emit();
        }, onError),
      );

      if (state.circleData) {
        syncPeriodCheckInListeners({
          cadence: normalizeCommitmentCadence(
            state.circleData.commitmentCadence,
            state.circleData.commitmentFrequency,
          ),
          circleRef,
          onError,
          onUpdate: emit,
          state,
          timezone: asString(state.circleData.timezone, 'UTC'),
        });
      }

      recentDateKeys.forEach(dateKey => {
        circleUnsubscribes.push(
          circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid)
            .onSnapshot(snapshot => {
              state.recentUserCheckIns.set(
                dateKey,
                snapshot.exists() &&
                  isCoveredCheckInStatus(snapshot.data()?.status),
              );
              emit();
            }, onError),
        );
      });
    });

    emit();
  };

  const unsubscribeMemberships = firestore
    .collectionGroup('members')
    .where('uid', '==', uid)
    .onSnapshot(snapshot => {
      memberships.clear();
      snapshot.docs.forEach(doc => {
        const circleId = getMembershipCircleId(doc);
        const data = snapshotData(doc);
        const status = normalizeMembershipStatus(data?.status);

        if (circleId && data && status) {
          memberships.set(circleId, data);
        }
      });
      startCircleListeners();
    }, onError);

  return () => {
    unsubscribeMemberships();
    stopCircleListeners();
  };
}

export function subscribeToMemberCircleDetail({
  circleId,
  onDetail,
  onError,
  timezone,
  uid,
}: CircleDetailSubscriptionOptions) {
  const firestore = firebaseFirestore();
  const recentDateKeys = getRecentDates(timezone).map(day => day.dateKey);
  const circleRef = firestore.collection(collections.circles).doc(circleId);
  const state: CircleSubscriptionState = {
    memberProfiles: new Map(),
    memberProfileUnsubscribes: new Map(),
    periodCheckInStatuses: new Map(),
    periodCheckInUnsubscribes: [],
    recentGroupCheckInStatuses: new Map(),
    recentGroupCheckInUnsubscribes: [],
    recentUserCheckIns: new Map(),
    todayCheckInStatuses: new Map(),
  };
  let membershipData: PlainData | undefined;
  let activeUnsubscribes: Array<() => void> = [];

  const emit = () => {
    if (!membershipData) {
      onDetail(undefined);
      return;
    }

    const circle = mapHomeCircleFromData({
      circleData: state.circleData,
      circleId,
      memberProfilesByUid: state.memberProfiles,
      membersData: state.membersData,
      membershipData,
      periodCheckInStatuses: state.periodCheckInStatuses,
      todayCheckInStatuses: state.todayCheckInStatuses,
    });
    const groupProgressDays = buildCircleGroupProgressDays({
      memberRecords: state.membersData ?? [],
      recentCheckInStatuses: state.recentGroupCheckInStatuses,
      timezone: asString(state.circleData?.timezone, timezone),
    });

    onDetail(
      circle
        ? buildCircleDetailFromHomeCircle(circle, groupProgressDays)
        : undefined,
    );
  };

  const stopActiveListeners = () => {
    activeUnsubscribes.forEach(unsubscribe => unsubscribe());
    activeUnsubscribes = [];
    state.membersData = membershipData ? [membershipData] : undefined;
    syncMemberProfileListeners({
      memberRecords: state.membersData ?? [],
      onError,
      onUpdate: emit,
      state,
    });
    state.todayCheckInStatuses = new Map();
    clearPeriodCheckInListeners(state);
    clearRecentGroupCheckInListeners(state);
    state.recentUserCheckIns.clear();
  };

  const startActiveListeners = () => {
    stopActiveListeners();

    if (normalizeMembershipStatus(membershipData?.status) !== 'active') {
      emit();
      return;
    }

    activeUnsubscribes.push(
      circleRef.collection('members').onSnapshot(snapshot => {
        state.membersData = snapshot.docs
          .map(snapshotData)
          .filter((memberData): memberData is PlainData =>
            Boolean(
              memberData && activeStatuses.has(asString(memberData.status)),
            ),
          );
        syncMemberProfileListeners({
          memberRecords: state.membersData,
          onError,
          onUpdate: emit,
          state,
        });
        emit();
      }, onError),
    );

    if (state.circleData) {
      syncPeriodCheckInListeners({
        cadence: normalizeCommitmentCadence(
          state.circleData.commitmentCadence,
          state.circleData.commitmentFrequency,
        ),
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData.timezone, 'UTC'),
      });
      syncRecentGroupCheckInListeners({
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData.timezone, 'UTC'),
      });
    }

    recentDateKeys.forEach(dateKey => {
      activeUnsubscribes.push(
        circleRef
          .collection('days')
          .doc(dateKey)
          .collection('checkIns')
          .doc(uid)
          .onSnapshot(snapshot => {
            state.recentUserCheckIns.set(
              dateKey,
              snapshot.exists() &&
                isCoveredCheckInStatus(snapshot.data()?.status),
            );
            emit();
          }, onError),
      );
    });
  };

  const unsubscribeCircle = circleRef.onSnapshot(snapshot => {
    state.circleData = snapshotData(snapshot);
    if (normalizeMembershipStatus(membershipData?.status) === 'active') {
      syncPeriodCheckInListeners({
        cadence: normalizeCommitmentCadence(
          state.circleData?.commitmentCadence,
          state.circleData?.commitmentFrequency,
        ),
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData?.timezone, 'UTC'),
      });
      syncRecentGroupCheckInListeners({
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData?.timezone, 'UTC'),
      });
    }
    emit();
  }, onError);
  const unsubscribeMembership = circleRef
    .collection('members')
    .doc(uid)
    .onSnapshot(snapshot => {
      membershipData = snapshotData(snapshot);
      startActiveListeners();
      emit();
    }, onError);

  return () => {
    unsubscribeCircle();
    unsubscribeMembership();
    stopActiveListeners();
    clearMemberProfileListeners(state);
    clearRecentGroupCheckInListeners(state);
  };
}

export function buildCircleDetailFromHomeCircle(
  circle: CircleManagementCard,
  groupProgressDays?: CircleGroupProgressDay[],
): CircleDetailModel {
  const monthProgress = Array.from({length: 7}, (_, index) => ({
    day: index + 1,
    state: index === 6 ? 'today' : 'future',
  })) satisfies CircleProgressDay[];

  return {
    ...circle,
    activity: [],
    completionRate: circle.completionRate ?? circle.progressPercent,
    commitmentLabel: `Commitment: ${circle.commitment}`,
    ...(groupProgressDays ? {groupProgressDays} : {}),
    memberCount: circle.memberCount,
    monthProgress,
    maxSize: circle.maxSize,
  };
}

export function buildPublicCircleDetail(
  summary: CircleSummary,
): CircleDetailModel {
  const progressPercent =
    summary.progressPercent ?? summary.completionRate ?? 0;
  const commitmentCadence = normalizeCommitmentCadence(
    summary.commitmentCadence,
    summary.commitmentFrequency,
  );
  const progressLabel =
    summary.progressLabel ??
    `${getCommitmentPeriodLabel(commitmentCadence)} · ${progressPercent}%`;

  return {
    ...summary,
    activity: [],
    completionRate: summary.completionRate ?? progressPercent,
    commitmentCadence,
    commitmentFrequency: normalizeCommitmentFrequency(
      summary.commitmentFrequency ?? {tapInsPerWeek: 7},
      commitmentCadence,
    ),
    commitmentLabel: `Commitment: ${summary.commitment}`,
    completionLabel: summary.completionLabel ?? progressLabel,
    memberCount: summary.memberCount ?? summary.members.length,
    monthProgress: Array.from({length: 7}, (_, index) => ({
      day: index + 1,
      state: index === 6 ? 'today' : 'future',
    })),
    maxSize: summary.maxSize ?? Math.max(summary.members.length, 1),
    nudgeTargetCount: summary.nudgeTargetCount ?? 0,
    progressLabel,
    progressPercent,
    remainingCheckIns: summary.remainingCheckIns ?? 0,
    state: summary.state ?? 'active',
    streakDays: summary.streakDays ?? 0,
    viewerHasCheckedIn: summary.viewerHasCheckedIn ?? true,
  };
}
