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
  CheckInCoverageStatus,
  CommitmentPace,
  CommitmentFrequency,
  GraceRule,
  MemberRole,
  ProgressDayState,
  ViewerTodayCheckIn,
} from '../../../types/models';
import {canTapInToday, getHomeCircleActionVariant} from './home-circle-actions';
import {getCircleLifecycleStatus} from '../../circles/services/circle-lifecycle';
import {
  formatQuantityValue,
  getCommitmentType,
  getQuantityConfig,
  isCoveredCheckInData,
  isSingleTapInCommitment,
} from '../../commitments/commitment-logic';
export {
  canTapInToday,
  getHomeCircleActionVariant,
  type HomeCircleActionVariant,
} from './home-circle-actions';

export type HomeProgressCell = {
  dateKey: string;
  label: string;
  quantityLabel?: string;
  quantityValue?: number;
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
  groupCircleCount?: number;
  needsYouCount: number;
  pendingCount: number;
  personalCommitmentCount?: number;
};

export type HomeGreetingPrimaryActionKind =
  | 'tap_in'
  | 'update_tap_in'
  | 'nudge'
  | 'pending_approval'
  | 'no_commitments'
  | 'momentum';

export type HomeGreetingPrimaryAction = {
  circleMode?: 'group' | 'personal';
  circleTitle?: string;
  isAtRisk: boolean;
  kind: HomeGreetingPrimaryActionKind;
  remainingActionCount: number;
  urgency?: 'deadline' | 'routine';
};

export type HomePrimaryAction = {
  circle?: CircleManagementCard;
  context: HomeGreetingPrimaryAction;
};

export type HomeGreetingContext = {
  circleSummary: HomeGreetingCircleSummary;
  firstName?: string;
  primaryAction?: HomeGreetingPrimaryAction;
  timeWindow: HomeGreetingTimeWindow;
};

export type HomeData = {
  circles: CircleManagementCard[];
  hasLoadedMemberships: boolean;
  hasRealProgress: boolean;
  hasResolvedGreetingContext: boolean;
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
  includeArchived?: boolean;
  memberProfilesByUid?: ReadonlyMap<string, PlainData>;
  membersData?: PlainData[];
  membershipData?: PlainData;
  periodOpportunityData?: PlainData;
  periodCheckInStatuses?: ReadonlyMap<
    string,
    ReadonlyMap<string, CheckInStatus>
  >;
  todayCheckInStatuses?: ReadonlyMap<string, CheckInStatus>;
  todayCheckInUids?: ReadonlySet<string>;
  viewerSkipGraceDateKeys?: readonly string[];
  viewerSkipGraceLoadedDateKeys?: ReadonlySet<string>;
  viewerSkipGraceStatuses?: ReadonlyMap<string, CheckInStatus | undefined>;
  viewerOpenOpportunityExpiresDateKey?: string;
  viewerTodayCheckIn?: ViewerTodayCheckIn;
};

type CircleSubscriptionState = {
  circleData?: PlainData;
  hasLoadedCircle: boolean;
  hasLoadedMembers: boolean;
  hasLoadedOpportunity: boolean;
  circleOpportunityData?: PlainData;
  circleOpportunityKey?: string;
  circleOpportunityUnsubscribe?: () => void;
  memberProfiles: Map<string, PlainData>;
  memberProfileUnsubscribes: Map<string, () => void>;
  membersData?: PlainData[];
  periodCheckInStatuses: Map<string, Map<string, CheckInStatus>>;
  periodCheckInExpectedDateKeys: Set<string>;
  periodCheckInLoadedDateKeys: Set<string>;
  periodCheckInKey?: string;
  periodCheckInUnsubscribes: Array<() => void>;
  recentGroupCheckInKey?: string;
  recentGroupQuantityMarkers: Map<string, QuantityProgressMarker>;
  recentGroupCheckInStatuses: Map<string, Map<string, CheckInStatus>>;
  recentGroupCheckInUnsubscribes: Array<() => void>;
  recentUserCheckIns: Map<string, RecentUserCheckInMarker>;
  skipGraceCheckInStatuses: Map<string, CheckInStatus | undefined>;
  skipGraceDateKeys: string[];
  skipGraceKey?: string;
  skipGraceLoadedDateKeys: Set<string>;
  skipGraceUnsubscribes: Array<() => void>;
  todayCheckInStatuses: Map<string, CheckInStatus>;
  viewerTodayCheckIn?: ViewerTodayCheckIn;
};

type RecentUserCheckInMarker = {
  covered: boolean;
  quantityLabel?: string;
  quantityValue?: number;
};

type QuantityProgressMarker = Pick<
  HomeProgressCell,
  'quantityLabel' | 'quantityValue'
>;

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

export function isHomeCircleGreetingContextReady({
  expectedPeriodSnapshotCount,
  hasLoadedCircle,
  hasLoadedMembers,
  hasLoadedOpportunity,
  hasLoadedViewerOpportunities = true,
  loadedPeriodSnapshotCount,
  membershipStatus,
}: {
  expectedPeriodSnapshotCount: number;
  hasLoadedCircle: boolean;
  hasLoadedMembers: boolean;
  hasLoadedOpportunity: boolean;
  hasLoadedViewerOpportunities?: boolean;
  loadedPeriodSnapshotCount: number;
  membershipStatus?: CircleMembershipStatus;
}) {
  if (!hasLoadedCircle || !hasLoadedViewerOpportunities) {
    return false;
  }

  if (membershipStatus === 'pending') {
    return true;
  }

  if (membershipStatus !== 'active') {
    return false;
  }

  return (
    hasLoadedMembers &&
    hasLoadedOpportunity &&
    expectedPeriodSnapshotCount > 0 &&
    loadedPeriodSnapshotCount >= expectedPeriodSnapshotCount
  );
}

const activeStatuses = new Set(['active', 'pending']);

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDate(value: unknown) {
  return value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
    ? value.toDate()
    : undefined;
}

function clampTapInsPerWeek(value: number) {
  return Math.min(7, Math.max(1, Math.round(value)));
}

function normalizeCommitmentFrequency(
  value: unknown,
  pace: CommitmentPace = 'weekly',
): CommitmentFrequency {
  if (pace === 'daily') {
    return {tapInsPerWeek: 7};
  }

  const data = value && typeof value === 'object' ? (value as PlainData) : {};
  const tapInsPerWeek = clampTapInsPerWeek(asNumber(data.tapInsPerWeek, 7));

  if (pace === 'monthly') {
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

function normalizeCommitmentPace(
  value: unknown,
  frequencyValue: unknown,
): CommitmentPace {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }

  return normalizeCommitmentFrequency(frequencyValue, 'weekly').tapInsPerWeek >=
    7
    ? 'daily'
    : 'weekly';
}

function getCurrentCycleLabel(_pace: CommitmentPace) {
  return 'this Cycle';
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
  return value === 'done' ||
    value === 'skip' ||
    value === 'partial' ||
    value === 'failed'
    ? value
    : undefined;
}

function normalizeCoverageStatus(
  value: unknown,
): CheckInCoverageStatus | undefined {
  return value === 'covered' ||
    value === 'skipped' ||
    value === 'partial' ||
    value === 'failed'
    ? value
    : undefined;
}

function isCoveredCheckInStatus(value: unknown) {
  const status = normalizeCheckInStatus(value);

  return status === 'done' || status === 'skip';
}

function asOptionalNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function getCommitmentSource(
  circleData?: PlainData,
  checkInData?: PlainData,
): Partial<CircleSummary> {
  return {
    commitmentType: getCommitmentType(
      (checkInData ?? circleData) as Partial<CircleSummary> | undefined,
    ),
    maximumValue: asOptionalNonNegativeNumber(
      checkInData?.maximumValue ?? circleData?.maximumValue,
    ),
    minimumValue: asOptionalNonNegativeNumber(
      checkInData?.minimumValue ?? circleData?.minimumValue,
    ),
    stepValue: asOptionalNonNegativeNumber(
      checkInData?.stepValue ?? circleData?.stepValue,
    ),
    targetValue: asOptionalNonNegativeNumber(
      checkInData?.targetValue ?? circleData?.targetValue,
    ),
    unitLabel: asString(checkInData?.unitLabel ?? circleData?.unitLabel),
  };
}

function getQuantityMarkerForCheckIn(
  checkInData?: PlainData,
  circleData?: PlainData,
): Omit<RecentUserCheckInMarker, 'covered'> | undefined {
  if (!checkInData) {
    return undefined;
  }

  const status = normalizeCheckInStatus(checkInData.status);

  if (status !== 'done' && status !== 'partial' && status !== 'failed') {
    return undefined;
  }

  const commitmentSource = getCommitmentSource(circleData, checkInData);

  if (
    getCommitmentType(commitmentSource) === 'avoid' ||
    isSingleTapInCommitment(commitmentSource)
  ) {
    return undefined;
  }

  const quantityConfig = getQuantityConfig(commitmentSource);
  const requiredQuantity =
    getCommitmentType(commitmentSource) === 'limit'
      ? quantityConfig.maximumValue ?? 1
      : quantityConfig.targetValue ?? 1;
  const quantityValue = asOptionalNonNegativeNumber(checkInData.currentValue);

  if (requiredQuantity <= 1 || typeof quantityValue !== 'number') {
    return undefined;
  }

  return {
    quantityLabel: formatQuantityValue(quantityValue),
    quantityValue,
  };
}

function getRecentUserCheckInMarker(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
  circleData?: PlainData,
): RecentUserCheckInMarker {
  const data = snapshotData(snapshot);

  if (!snapshot.exists() || !data) {
    return {covered: false};
  }

  const status = normalizeCheckInStatus(data.status) ?? 'done';
  const quantityMarker = getQuantityMarkerForCheckIn(data, circleData);

  return {
    covered: isCoveredCheckInData({
      coverageStatus: normalizeCoverageStatus(data.coverageStatus),
      status,
    }),
    ...(quantityMarker ?? {}),
  };
}

function getGroupQuantityMarkerFromSnapshot(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot,
  circleData?: PlainData,
): QuantityProgressMarker | undefined {
  const quantityValues = snapshot.docs
    .map(doc => getQuantityMarkerForCheckIn(snapshotData(doc), circleData))
    .map(marker => marker?.quantityValue)
    .filter((value): value is number => typeof value === 'number');

  if (quantityValues.length === 0) {
    return undefined;
  }

  const totalQuantity = quantityValues.reduce(
    (total, value) => total + value,
    0,
  );

  return {
    quantityLabel: formatQuantityValue(totalQuantity),
    quantityValue: totalQuantity,
  };
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
    asString(memberData.name, asString(memberData.handle, 'Hoyst Member')),
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

function getRecentDates(timezone: string, now = new Date(), lookbackDays = 7) {
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
  pace: CommitmentPace,
  timezone: string,
  now = new Date(),
) {
  if (pace === 'daily') {
    return [getDateKey(now, timezone)];
  }

  if (pace === 'monthly') {
    return getCommitmentMonthDateKeys(timezone, now);
  }

  return getCommitmentWeekDateKeys(timezone, now);
}

function getCommitmentPeriodKey(
  pace: CommitmentPace,
  timezone: string,
  now = new Date(),
) {
  const firstDateKey =
    getCommitmentPeriodDateKeys(pace, timezone, now)[0] ??
    getDateKey(now, timezone);

  return pace === 'monthly' ? firstDateKey.slice(0, 7) : firstDateKey;
}

function getRollingGraceDateKeys(
  timezone: string,
  windowDays: number,
  now = new Date(),
) {
  const today = DateTime.fromJSDate(now, {zone: timezone}).startOf('day');
  const dayCount = Math.min(365, Math.max(1, Math.round(windowDays)));

  return Array.from({length: dayCount}, (_, index) =>
    today.minus({days: index}).toFormat('yyyy-LL-dd'),
  );
}

function getViewerAvailableSkips({
  graceRule,
  viewerSkipGraceDateKeys,
  viewerSkipGraceLoadedDateKeys,
  viewerSkipGraceStatuses,
}: {
  graceRule: GraceRule;
  viewerSkipGraceDateKeys?: readonly string[];
  viewerSkipGraceLoadedDateKeys?: ReadonlySet<string>;
  viewerSkipGraceStatuses?: ReadonlyMap<string, CheckInStatus | undefined>;
}) {
  const allowance = Math.max(0, Math.round(graceRule.allowance));

  if (allowance <= 0) {
    return 0;
  }

  if (
    !viewerSkipGraceDateKeys ||
    viewerSkipGraceDateKeys.length === 0 ||
    !viewerSkipGraceLoadedDateKeys ||
    !viewerSkipGraceStatuses ||
    viewerSkipGraceDateKeys.some(
      dateKey => !viewerSkipGraceLoadedDateKeys.has(dateKey),
    )
  ) {
    return undefined;
  }

  const usedSkips = viewerSkipGraceDateKeys.reduce(
    (total, dateKey) =>
      viewerSkipGraceStatuses.get(dateKey) === 'skip' ? total + 1 : total,
    0,
  );

  return Math.max(allowance - usedSkips, 0);
}

function buildProgressDays(
  timezone: string,
  completedDateKeys: ReadonlySet<string>,
  now?: Date,
  lookbackDays = 7,
  quantityMarkers?: ReadonlyMap<
    string,
    Pick<HomeProgressCell, 'quantityLabel' | 'quantityValue'>
  >,
): HomeProgressCell[] {
  const recentDates = getRecentDates(timezone, now, lookbackDays);
  const todayDateKey = recentDates[recentDates.length - 1]?.dateKey ?? '';

  return recentDates.map(day => {
    const quantityMarker = quantityMarkers?.get(day.dateKey);

    return {
      ...day,
      ...(quantityMarker?.quantityLabel
        ? {
            quantityLabel: quantityMarker.quantityLabel,
            quantityValue: quantityMarker.quantityValue,
          }
        : {}),
      state: completedDateKeys.has(day.dateKey)
        ? 'done'
        : day.dateKey === todayDateKey
        ? 'today'
        : 'future',
    };
  });
}

export function buildCircleGroupProgressDays({
  memberRecords,
  now,
  recentQuantityMarkers,
  recentCheckInStatuses,
  timezone,
}: {
  memberRecords: ReadonlyArray<Record<string, unknown>>;
  now?: Date;
  recentQuantityMarkers?: ReadonlyMap<string, QuantityProgressMarker>;
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
    const quantityMarker = recentQuantityMarkers?.get(day.dateKey);
    const coveredCount = memberUids.reduce(
      (total, memberUid) =>
        isCoveredCheckInStatus(dayStatuses?.get(memberUid)) ? total + 1 : total,
      0,
    );

    return {
      ...day,
      coveredCount,
      ...(quantityMarker?.quantityLabel
        ? {
            quantityLabel: quantityMarker.quantityLabel,
            quantityValue: quantityMarker.quantityValue,
          }
        : {}),
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
  now = new Date(),
): HomeGreetingCircleSummary {
  return circles.reduce(
    (summary, circle) => {
      if (circle.circleMode === 'personal') {
        summary.personalCommitmentCount =
          (summary.personalCommitmentCount ?? 0) + 1;
      } else {
        summary.groupCircleCount = (summary.groupCircleCount ?? 0) + 1;
      }

      if (circle.viewerMembershipStatus === 'pending') {
        summary.pendingCount += 1;
        return summary;
      }

      const viewerCanTapInToday = canTapInToday(circle);

      if (viewerCanTapInToday) {
        summary.needsYouCount += 1;
      }
      if (viewerCanTapInToday && isHomeCircleDeadlineUrgent(circle, now)) {
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
      groupCircleCount: 0,
      needsYouCount: 0,
      pendingCount: 0,
      personalCommitmentCount: 0,
    },
  );
}

function getHomeCircleDeadlineDateKey(circle: CircleManagementCard, now: Date) {
  if (circle.viewerOpenOpportunityExpiresDateKey) {
    return circle.viewerOpenOpportunityExpiresDateKey;
  }

  if (circle.commitmentCadence === 'daily' && !circle.viewerHasTappedInToday) {
    return getDateKey(now, circle.timezone ?? 'UTC');
  }

  return undefined;
}

export function isHomeCircleDeadlineUrgent(
  circle: CircleManagementCard,
  now = new Date(),
) {
  if (
    circle.viewerMembershipStatus !== 'active' ||
    circle.viewerHasTappedInToday ||
    !canTapInToday(circle)
  ) {
    return false;
  }

  const expiresDateKey = getHomeCircleDeadlineDateKey(circle, now);
  if (!expiresDateKey) {
    return false;
  }

  const localNow = DateTime.fromJSDate(now, {
    zone: circle.timezone ?? 'UTC',
  });

  return (
    localNow.toFormat('yyyy-LL-dd') === expiresDateKey && localNow.hour >= 18
  );
}

export function getNextHomeActionBoundary({
  circles,
  now = new Date(),
  timezone,
}: {
  circles: readonly CircleManagementCard[];
  now?: Date;
  timezone: string;
}) {
  const nowMs = now.getTime();
  const profileMidnight = DateTime.fromJSDate(now, {zone: timezone})
    .plus({days: 1})
    .startOf('day')
    .toMillis();
  const boundaries = [profileMidnight];

  circles.forEach(circle => {
    if (
      circle.viewerMembershipStatus !== 'active' ||
      circle.viewerHasTappedInToday ||
      !canTapInToday(circle)
    ) {
      return;
    }

    const expiresDateKey = getHomeCircleDeadlineDateKey(circle, now);
    if (!expiresDateKey) {
      return;
    }

    const deadlineDay = DateTime.fromISO(expiresDateKey, {
      zone: circle.timezone ?? 'UTC',
    }).startOf('day');
    const warningBoundary = deadlineDay.plus({hours: 18}).toMillis();
    const expirationBoundary = deadlineDay.plus({days: 1}).toMillis();

    if (warningBoundary > nowMs) {
      boundaries.push(warningBoundary);
    } else if (expirationBoundary > nowMs) {
      boundaries.push(expirationBoundary);
    }
  });

  return Math.min(...boundaries);
}

function getPrimaryActionCopySuffix(
  action: Omit<HomeGreetingPrimaryAction, 'circleTitle'>,
) {
  const remainingCopy =
    action.remainingActionCount > 0
      ? ` ${action.remainingActionCount} more need attention.`
      : '';

  if (action.kind === 'tap_in') {
    return action.urgency === 'deadline'
      ? ` needs your Tap In before midnight.${remainingCopy}`
      : ` needs your Tap In today.${remainingCopy}`;
  }
  if (action.kind === 'update_tap_in') {
    return action.isAtRisk
      ? ` is at risk. Update your Tap In.${remainingCopy}`
      : ` needs a Tap In update.${remainingCopy}`;
  }
  if (action.kind === 'nudge') {
    return ` needs a nudge.${remainingCopy}`;
  }

  return ` is pending approval.${remainingCopy}`;
}

export function normalizeHomeGreetingCircleTitle(
  value: string,
  maxLength = 36,
) {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const candidate = normalized.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = candidate.lastIndexOf(' ');
  const wordBoundaryCandidate =
    lastSpace >= Math.min(10, Math.floor(maxLength / 2))
      ? candidate.slice(0, lastSpace)
      : candidate;

  return `${wordBoundaryCandidate.trimEnd()}…`;
}

export function getHomePrimaryAction({
  circles,
  firstName,
  now = new Date(),
}: {
  circles: readonly CircleManagementCard[];
  firstName?: string;
  now?: Date;
}): HomePrimaryAction {
  const sortedCircles = sortHomeCircles([...circles]);
  const actionCircles = sortedCircles
    .filter(circle => {
      const variant = getHomeCircleActionVariant(circle);

      return (
        variant === 'check_in' ||
        variant === 'nudge' ||
        circle.viewerMembershipStatus === 'pending'
      );
    })
    .sort(
      (left, right) =>
        Number(isHomeCircleDeadlineUrgent(right, now)) -
        Number(isHomeCircleDeadlineUrgent(left, now)),
    );
  const primaryCircle = actionCircles[0];

  if (!primaryCircle) {
    return {
      context: {
        isAtRisk: false,
        kind: circles.length === 0 ? 'no_commitments' : 'momentum',
        remainingActionCount: 0,
      },
    };
  }

  const variant = getHomeCircleActionVariant(primaryCircle);
  const kind: HomeGreetingPrimaryActionKind =
    primaryCircle.viewerMembershipStatus === 'pending'
      ? 'pending_approval'
      : variant === 'nudge'
      ? 'nudge'
      : primaryCircle.viewerHasTappedInToday
      ? 'update_tap_in'
      : 'tap_in';
  const actionWithoutTitle = {
    circleMode: primaryCircle.circleMode,
    isAtRisk:
      kind === 'tap_in'
        ? isHomeCircleDeadlineUrgent(primaryCircle, now)
        : kind === 'update_tap_in'
        ? false
        : primaryCircle.state === 'risk',
    kind,
    remainingActionCount: Math.max(0, actionCircles.length - 1),
    urgency:
      kind === 'tap_in' && isHomeCircleDeadlineUrgent(primaryCircle, now)
        ? 'deadline'
        : 'routine',
  } satisfies Omit<HomeGreetingPrimaryAction, 'circleTitle'>;
  const cleanName = getCleanFirstName(firstName);
  const namePrefixLength = cleanName ? cleanName.length + 2 : 0;
  const titleBudget = Math.max(
    4,
    Math.min(
      36,
      90 -
        namePrefixLength -
        getPrimaryActionCopySuffix(actionWithoutTitle).length,
    ),
  );

  return {
    circle: primaryCircle,
    context: {
      ...actionWithoutTitle,
      circleTitle: normalizeHomeGreetingCircleTitle(
        primaryCircle.title,
        titleBudget,
      ),
    },
  };
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
    circleSummary: getHomeGreetingCircleSummary(circles, now),
    firstName: getCleanFirstName(firstName),
    primaryAction: getHomePrimaryAction({circles, firstName, now}).context,
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
  return buildHomeGreetingFallback(context);
}

export function buildHomeGreetingFallback(context: HomeGreetingContext) {
  const {circleSummary, primaryAction, timeWindow} = context;

  if (primaryAction?.circleTitle) {
    const directCopy = getPrimaryActionCopySuffix(primaryAction);
    const playfulCandidate =
      primaryAction.remainingActionCount > 0
        ? ''
        : primaryAction.kind === 'tap_in'
        ? primaryAction.isAtRisk
          ? ' Steady it.'
          : ' Finish the day clean.'
        : primaryAction.kind === 'update_tap_in'
        ? ' Finish what you started.'
        : primaryAction.kind === 'nudge'
        ? ' Wake the crew up.'
        : ' Check where it stands.';
    const directGreeting = buildGreetingWithName(
      context.firstName,
      `${primaryAction.circleTitle}${directCopy}`,
      `${primaryAction.circleTitle}${directCopy}`,
    );
    const playfulCopy =
      directGreeting.length + playfulCandidate.length <= 90
        ? playfulCandidate
        : '';

    return `${directGreeting}${playfulCopy}`;
  }

  if (
    primaryAction?.kind === 'no_commitments' ||
    circleSummary.circleCount === 0
  ) {
    return buildGreetingWithName(
      context.firstName,
      'no commitments yet. Bold strategy, let us fix it.',
      'No commitments yet. Bold strategy, let us fix it.',
    );
  }

  if (circleSummary.atRiskCount > 0) {
    return buildGreetingWithName(
      context.firstName,
      'pressure is up. Perfect, now it counts.',
      'Pressure is up. Perfect, now it counts.',
    );
  }

  if (circleSummary.needsYouCount > 0) {
    const waitingLabel =
      (circleSummary.groupCircleCount ?? circleSummary.circleCount) === 0
        ? 'commitments'
        : 'circles';

    return buildGreetingWithName(
      context.firstName,
      `your ${waitingLabel} are waiting. Make it quick and undeniable.`,
      `Your ${waitingLabel} are waiting. Make it quick and undeniable.`,
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
    hasResolvedGreetingContext: false,
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
  hasResolvedGreetingContext = hasLoadedMemberships,
  lookbackDays = 7,
  membershipCount = circles.length,
  quantityMarkers,
  timezone,
  now = new Date(),
}: {
  circles: CircleManagementCard[];
  completedDateKeys: ReadonlySet<string>;
  hasLoadedMemberships?: boolean;
  hasResolvedGreetingContext?: boolean;
  lookbackDays?: number;
  membershipCount?: number;
  now?: Date;
  quantityMarkers?: ReadonlyMap<
    string,
    Pick<HomeProgressCell, 'quantityLabel' | 'quantityValue'>
  >;
  timezone: string;
}) {
  const progressDays = buildProgressDays(
    timezone,
    completedDateKeys,
    now,
    lookbackDays,
    quantityMarkers,
  );
  const completedDays = progressDays.filter(day => day.state === 'done').length;
  const today = DateTime.fromJSDate(now, {zone: timezone});

  return {
    circles,
    hasLoadedMemberships,
    hasRealProgress: completedDateKeys.size > 0,
    hasResolvedGreetingContext,
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
  includeArchived = false,
  memberProfilesByUid,
  membersData = [],
  membershipData,
  periodOpportunityData,
  periodCheckInStatuses,
  todayCheckInStatuses,
  todayCheckInUids = new Set<string>(),
  viewerSkipGraceDateKeys,
  viewerSkipGraceLoadedDateKeys,
  viewerSkipGraceStatuses,
  viewerOpenOpportunityExpiresDateKey,
  viewerTodayCheckIn,
}: HomeCircleMappingInput): CircleManagementCard | undefined {
  const membershipStatus = normalizeMembershipStatus(membershipData?.status);

  if (!circleData || !membershipData || !membershipStatus) {
    return undefined;
  }

  const lifecycleStatus = getCircleLifecycleStatus(circleData);

  if (lifecycleStatus === 'archived' && !includeArchived) {
    return undefined;
  }

  const title = asString(circleData.title);
  const commitment = asString(circleData.commitment);
  const circleMode =
    circleData.circleMode === 'personal' ? 'personal' : 'group';

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
  const commitmentPace = normalizeCommitmentPace(
    circleData.commitmentCadence,
    circleData.commitmentFrequency,
  );
  const commitmentFrequency = normalizeCommitmentFrequency(
    circleData.commitmentFrequency,
    commitmentPace,
  );
  const commitmentSource = getCommitmentSource(circleData);
  const commitmentType = getCommitmentType(commitmentSource);
  const quantityConfig = getQuantityConfig(commitmentSource);
  const tapInsPerWeek = commitmentFrequency.tapInsPerWeek;
  const requiredTapIns =
    commitmentPace === 'daily'
      ? 1
      : commitmentPace === 'monthly'
      ? commitmentFrequency.opportunitiesPerPeriod ?? tapInsPerWeek
      : tapInsPerWeek;
  const scoringStatuses =
    commitmentPace === 'daily'
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
  const fallbackProgressBase =
    Math.max(activeMemberCount, isPending ? 0 : memberCount) * requiredTapIns;
  const fallbackPeriodCoveredCount = getPeriodCoveredTotal(
    memberRecords,
    memberCoveredCounts,
    requiredTapIns,
  );
  const canonicalExpectedCount = asNumber(
    periodOpportunityData?.expectedOpportunityCount,
    -1,
  );
  const canonicalCoveredCount = asNumber(
    periodOpportunityData?.coveredOpportunityCount,
    -1,
  );
  const progressBase =
    canonicalExpectedCount >= 0 ? canonicalExpectedCount : fallbackProgressBase;
  const periodCoveredCount =
    canonicalCoveredCount >= 0
      ? canonicalCoveredCount
      : fallbackPeriodCoveredCount;
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
  const coveredViewerTodayStatus = uid ? coveredCheckIns.get(uid) : undefined;
  const rawViewerTodayStatus = viewerTodayCheckIn?.status;
  const viewerTodayStatus = rawViewerTodayStatus ?? coveredViewerTodayStatus;
  const visibleViewerTodayCheckIn =
    viewerTodayCheckIn && viewerTodayCheckIn.status === viewerTodayStatus
      ? viewerTodayCheckIn
      : undefined;
  const viewerCoveredCount = uid ? memberCoveredCounts.get(uid) ?? 0 : 0;
  const viewerHasTappedInToday = Boolean(
    visibleViewerTodayCheckIn ?? viewerTodayStatus,
  );
  const viewerRemainingTapIns = isPending
    ? 0
    : Math.max(requiredTapIns - viewerCoveredCount, 0);
  const viewerHasCheckedIn = isPending ? true : viewerRemainingTapIns === 0;
  const viewerCurrentValue =
    visibleViewerTodayCheckIn?.currentValue ??
    (commitmentType === 'avoid' && viewerTodayStatus === 'done'
      ? 1
      : undefined);
  const viewerCanUpdateTapIn =
    !isPending &&
    membershipStatus === 'active' &&
    viewerHasTappedInToday &&
    viewerTodayStatus !== 'skip' &&
    (commitmentType === 'limit' ||
      (commitmentType === 'build' &&
        !isSingleTapInCommitment(commitmentSource)));
  const viewerRemainingAmount =
    commitmentType === 'build' && typeof viewerCurrentValue === 'number'
      ? Math.max((quantityConfig.targetValue ?? 1) - viewerCurrentValue, 0)
      : undefined;
  const quantityLabel =
    typeof viewerCurrentValue === 'number'
      ? formatQuantityValue(viewerCurrentValue)
      : undefined;
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
  const cycleLabel = getCurrentCycleLabel(commitmentPace);
  const progressLabel = `${cycleLabel} · ${progressPercent}%`;
  const graceRules = normalizeGraceRules(circleData.graceRules);
  const viewerAvailableSkips = getViewerAvailableSkips({
    graceRule: graceRules.skip,
    viewerSkipGraceDateKeys,
    viewerSkipGraceLoadedDateKeys,
    viewerSkipGraceStatuses,
  });

  return {
    category: asString(circleData.category, 'General'),
    circleMode,
    completionRate: progressPercent,
    commitmentCadence: commitmentPace,
    commitment,
    commitmentFrequency,
    commitmentType,
    ...(typeof viewerCurrentValue === 'number'
      ? {currentValue: viewerCurrentValue}
      : {}),
    graceRules,
    id: circleId,
    lifecycleStatus,
    ...(lifecycleStatus === 'archived' && asDate(circleData.archivedAt)
      ? {archivedAt: asDate(circleData.archivedAt)}
      : {}),
    inviteUrl: circleMode === 'personal' ? undefined : getInviteUrl(circleData),
    joinMode: normalizeJoinMode(circleData.joinMode),
    matchCopy: matchCopy || undefined,
    ...(typeof quantityConfig.maximumValue === 'number'
      ? {maximumValue: quantityConfig.maximumValue}
      : {}),
    maxSize: asNumber(circleData.maxSize, Math.max(memberCount, 1)),
    memberCount,
    members: visibleMembers,
    ...(typeof quantityConfig.minimumValue === 'number'
      ? {minimumValue: quantityConfig.minimumValue}
      : {}),
    nudgeTargetCount: circleMode === 'personal' ? 0 : nudgeTargetCount,
    periodTapInCount: periodCoveredCount,
    privacy: normalizePrivacy(circleData.privacy),
    ...(quantityLabel ? {quantityLabel} : {}),
    completionLabel: isPending ? 'Pending approval' : progressLabel,
    progressLabel: isPending ? 'Pending approval' : progressLabel,
    progressPercent,
    remainingCheckIns,
    state,
    stepValue: quantityConfig.stepValue,
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
    ...(typeof quantityConfig.targetValue === 'number'
      ? {targetValue: quantityConfig.targetValue}
      : {}),
    unitLabel: quantityConfig.unitLabel,
    ...(typeof viewerAvailableSkips === 'number' ? {viewerAvailableSkips} : {}),
    ...(viewerCanUpdateTapIn ? {viewerCanUpdateTapIn} : {}),
    viewerHasCheckedIn,
    viewerHasTappedInToday,
    viewerMembershipStatus: membershipStatus,
    ...(viewerOpenOpportunityExpiresDateKey
      ? {viewerOpenOpportunityExpiresDateKey}
      : {}),
    ...(typeof viewerRemainingAmount === 'number'
      ? {viewerRemainingAmount}
      : {}),
    viewerRemainingTapIns,
    viewerRole: normalizeMemberRole(membershipData.role),
    ...(visibleViewerTodayCheckIn
      ? {viewerTodayCheckIn: visibleViewerTodayCheckIn}
      : {}),
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

function isCompletedDailyStackCard(circle: CircleManagementCard) {
  return Boolean(
    circle.commitmentCadence === 'daily' &&
      circle.viewerHasTappedInToday &&
      getHomeCircleActionVariant(circle) !== 'nudge',
  );
}

export function getHomeCommitmentStackCircles({
  personalCommitments,
  todayAttentionCircles,
  upcomingAttentionCircles,
}: {
  personalCommitments: readonly CircleManagementCard[];
  todayAttentionCircles: readonly CircleManagementCard[];
  upcomingAttentionCircles: readonly CircleManagementCard[];
}) {
  const uniqueCircles = new Map<string, CircleManagementCard>();

  [
    ...personalCommitments,
    ...todayAttentionCircles,
    ...upcomingAttentionCircles,
  ].forEach(circle => {
    if (!uniqueCircles.has(circle.id)) {
      uniqueCircles.set(circle.id, circle);
    }
  });

  return sortHomeCircles([...uniqueCircles.values()]).sort((left, right) => {
    const leftCompleted = isCompletedDailyStackCard(left);
    const rightCompleted = isCompletedDailyStackCard(right);

    if (leftCompleted !== rightCompleted) {
      return leftCompleted ? 1 : -1;
    }

    return 0;
  });
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
  viewerOpenOpportunity?: PlainData,
) {
  return mapHomeCircleFromData({
    circleData: state?.circleData,
    circleId,
    memberProfilesByUid: state?.memberProfiles,
    membersData: state?.membersData,
    membershipData,
    periodOpportunityData: state?.circleOpportunityData,
    periodCheckInStatuses: state?.periodCheckInStatuses,
    todayCheckInStatuses: state?.todayCheckInStatuses,
    viewerSkipGraceDateKeys: state?.skipGraceDateKeys,
    viewerSkipGraceLoadedDateKeys: state?.skipGraceLoadedDateKeys,
    viewerSkipGraceStatuses: state?.skipGraceCheckInStatuses,
    viewerOpenOpportunityExpiresDateKey: asString(
      viewerOpenOpportunity?.expiresDateKey,
    ),
    viewerTodayCheckIn: state?.viewerTodayCheckIn,
  });
}

function clearCircleOpportunityListener(state: CircleSubscriptionState) {
  state.circleOpportunityUnsubscribe?.();
  state.circleOpportunityUnsubscribe = undefined;
  state.circleOpportunityData = undefined;
  state.circleOpportunityKey = undefined;
  state.hasLoadedOpportunity = false;
}

function syncCircleOpportunityListener({
  circleRef,
  onError,
  onUpdate,
  state,
}: {
  circleRef: FirebaseFirestoreTypes.DocumentReference;
  onError?: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
}) {
  if (!state.circleData) {
    clearCircleOpportunityListener(state);
    return;
  }

  const pace = normalizeCommitmentPace(
    state.circleData.commitmentCadence,
    state.circleData.commitmentFrequency,
  );
  const timezone = asString(state.circleData.timezone, 'UTC');
  const periodKey = getCommitmentPeriodKey(pace, timezone);

  if (state.circleOpportunityKey === periodKey) {
    return;
  }

  clearCircleOpportunityListener(state);
  state.circleOpportunityKey = periodKey;
  state.circleOpportunityUnsubscribe = circleRef
    .collection('opportunities')
    .doc(periodKey)
    .onSnapshot(snapshot => {
      state.circleOpportunityData = snapshotData(snapshot);
      state.hasLoadedOpportunity = true;
      onUpdate();
    }, onError);
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
        const data = doc.data();
        const uidValue = asString(doc.data().uid, doc.id);
        const status = normalizeCheckInStatus(data.status) ?? 'done';
        const checkIn = {
          coverageStatus: normalizeCoverageStatus(data.coverageStatus),
          status,
        };

        return uidValue && isCoveredCheckInData(checkIn)
          ? ([uidValue, status] as const)
          : undefined;
      })
      .filter((entry): entry is readonly [string, CheckInStatus] =>
        Boolean(entry),
      ),
  );
}

function getViewerTodayCheckInFromSnapshot(
  snapshot: FirebaseFirestoreTypes.QuerySnapshot,
  dateKey: string,
  uid: string,
): ViewerTodayCheckIn | undefined {
  const checkInSnapshot = snapshot.docs.find(doc => {
    const data = doc.data();
    const docUid = asString(data.uid, doc.id);

    return docUid === uid;
  });

  if (!checkInSnapshot) {
    return undefined;
  }

  const data = checkInSnapshot.data();
  const status = normalizeCheckInStatus(data.status);

  if (
    status !== 'done' &&
    status !== 'skip' &&
    status !== 'partial' &&
    status !== 'failed'
  ) {
    return undefined;
  }

  const note = asString(data.note);
  const photoUrl = asString(data.photoUrl);
  const coverageStatus = normalizeCoverageStatus(data.coverageStatus);
  const currentValue = asOptionalNonNegativeNumber(data.currentValue);
  const maximumValue = asOptionalNonNegativeNumber(data.maximumValue);
  const minimumValue = asOptionalNonNegativeNumber(data.minimumValue);
  const stepValue = asOptionalNonNegativeNumber(data.stepValue);
  const targetValue = asOptionalNonNegativeNumber(data.targetValue);
  const unitLabel = asString(data.unitLabel);

  return {
    dateKey,
    status,
    ...(coverageStatus ? {coverageStatus} : {}),
    ...(typeof currentValue === 'number' ? {currentValue} : {}),
    ...(typeof maximumValue === 'number' ? {maximumValue} : {}),
    ...(typeof minimumValue === 'number' ? {minimumValue} : {}),
    ...(note ? {note} : {}),
    ...(photoUrl ? {photoUrl} : {}),
    ...(typeof stepValue === 'number' ? {stepValue} : {}),
    ...(typeof targetValue === 'number' ? {targetValue} : {}),
    ...(unitLabel ? {unitLabel} : {}),
  };
}

function clearPeriodCheckInListeners(state: CircleSubscriptionState) {
  state.periodCheckInUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.periodCheckInUnsubscribes = [];
  state.periodCheckInKey = undefined;
  state.periodCheckInExpectedDateKeys.clear();
  state.periodCheckInLoadedDateKeys.clear();
  state.periodCheckInStatuses.clear();
  state.todayCheckInStatuses = new Map();
  state.viewerTodayCheckIn = undefined;
}

function clearRecentGroupCheckInListeners(state: CircleSubscriptionState) {
  state.recentGroupCheckInUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.recentGroupCheckInUnsubscribes = [];
  state.recentGroupCheckInKey = undefined;
  state.recentGroupQuantityMarkers?.clear();
  state.recentGroupCheckInStatuses.clear();
}

function clearSkipGraceCheckInListeners(state: CircleSubscriptionState) {
  state.skipGraceUnsubscribes.forEach(unsubscribe => unsubscribe());
  state.skipGraceUnsubscribes = [];
  state.skipGraceKey = undefined;
  state.skipGraceDateKeys = [];
  state.skipGraceCheckInStatuses.clear();
  state.skipGraceLoadedDateKeys.clear();
}

function syncPeriodCheckInListeners({
  pace,
  circleRef,
  onError,
  onUpdate,
  state,
  timezone,
  uid,
}: {
  pace: CommitmentPace;
  circleRef: FirebaseFirestoreTypes.DocumentReference;
  onError: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
  timezone: string;
  uid: string;
}) {
  const periodDateKeys = getCommitmentPeriodDateKeys(pace, timezone);
  const todayDateKey = getDateKey(new Date(), timezone);
  const periodCheckInKey = `${timezone}:${pace}:${periodDateKeys.join('|')}`;

  if (state.periodCheckInKey === periodCheckInKey) {
    return;
  }

  clearPeriodCheckInListeners(state);
  state.periodCheckInKey = periodCheckInKey;
  state.periodCheckInExpectedDateKeys = new Set(periodDateKeys);

  periodDateKeys.forEach(dateKey => {
    state.periodCheckInUnsubscribes.push(
      circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .onSnapshot(snapshot => {
          const dayStatuses = getCoveredStatusesFromSnapshot(snapshot);

          state.periodCheckInStatuses.set(dateKey, dayStatuses);
          state.periodCheckInLoadedDateKeys.add(dateKey);
          if (dateKey === todayDateKey) {
            state.todayCheckInStatuses = dayStatuses;
            state.viewerTodayCheckIn = getViewerTodayCheckInFromSnapshot(
              snapshot,
              dateKey,
              uid,
            );
          }
          onUpdate();
        }, onError),
    );
  });
}

function syncSkipGraceCheckInListeners({
  circleRef,
  graceRule,
  onError,
  onUpdate,
  state,
  timezone,
  uid,
}: {
  circleRef: FirebaseFirestoreTypes.DocumentReference;
  graceRule: GraceRule;
  onError: (error: Error) => void;
  onUpdate: () => void;
  state: CircleSubscriptionState;
  timezone: string;
  uid: string;
}) {
  const allowance = Math.max(0, Math.round(graceRule.allowance));

  if (allowance <= 0) {
    clearSkipGraceCheckInListeners(state);
    return;
  }

  const dateKeys = getRollingGraceDateKeys(timezone, graceRule.windowDays);
  const skipGraceKey = `${uid}:${timezone}:${allowance}:${
    graceRule.windowDays
  }:${dateKeys.join('|')}`;

  if (state.skipGraceKey === skipGraceKey) {
    return;
  }

  clearSkipGraceCheckInListeners(state);
  state.skipGraceKey = skipGraceKey;
  state.skipGraceDateKeys = dateKeys;

  dateKeys.forEach(dateKey => {
    state.skipGraceUnsubscribes.push(
      circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .doc(uid)
        .onSnapshot(snapshot => {
          state.skipGraceCheckInStatuses.set(
            dateKey,
            normalizeCheckInStatus(snapshot.data()?.status),
          );
          state.skipGraceLoadedDateKeys.add(dateKey);
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
          const quantityMarkers =
            state.recentGroupQuantityMarkers ??
            (state.recentGroupQuantityMarkers = new Map());
          const quantityMarker = getGroupQuantityMarkerFromSnapshot(
            snapshot,
            state.circleData,
          );

          state.recentGroupCheckInStatuses.set(
            dateKey,
            getCoveredStatusesFromSnapshot(snapshot),
          );
          if (quantityMarker) {
            quantityMarkers.set(dateKey, quantityMarker);
          } else {
            quantityMarkers.delete(dateKey);
          }
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
        state => state.recentUserCheckIns.get(dateKey)?.covered === true,
      ),
    ),
  );
}

function getRecentQuantityMarkers(
  states: Map<string, CircleSubscriptionState>,
  recentDateKeys: string[],
) {
  const markers = new Map<
    string,
    Pick<HomeProgressCell, 'quantityLabel' | 'quantityValue'>
  >();

  recentDateKeys.forEach(dateKey => {
    const quantityValues = Array.from(states.values())
      .map(state => state.recentUserCheckIns.get(dateKey)?.quantityValue)
      .filter((value): value is number => typeof value === 'number');

    if (quantityValues.length === 0) {
      return;
    }

    const totalQuantity = quantityValues.reduce(
      (total, value) => total + value,
      0,
    );

    markers.set(dateKey, {
      quantityLabel: formatQuantityValue(totalQuantity),
      quantityValue: totalQuantity,
    });
  });

  return markers;
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
  const viewerOpenOpportunities = new Map<string, PlainData>();
  let hasLoadedViewerOpportunities = false;
  let circleUnsubscribes: Array<() => void> = [];

  const hasResolvedGreetingContext = () =>
    hasLoadedViewerOpportunities &&
    Array.from(memberships.entries()).every(([circleId, membershipData]) => {
      const state = states.get(circleId);
      const membershipStatus = normalizeMembershipStatus(membershipData.status);

      if (!state) {
        return false;
      }

      if (
        state.hasLoadedCircle &&
        getCircleLifecycleStatus(state.circleData) === 'archived'
      ) {
        return true;
      }

      const loadedExpectedPeriodSnapshotCount = Array.from(
        state.periodCheckInExpectedDateKeys,
      ).filter(dateKey =>
        state.periodCheckInLoadedDateKeys.has(dateKey),
      ).length;

      return isHomeCircleGreetingContextReady({
        expectedPeriodSnapshotCount: state.periodCheckInExpectedDateKeys.size,
        hasLoadedCircle: state.hasLoadedCircle,
        hasLoadedMembers: state.hasLoadedMembers,
        hasLoadedOpportunity: state.hasLoadedOpportunity,
        hasLoadedViewerOpportunities,
        loadedPeriodSnapshotCount: loadedExpectedPeriodSnapshotCount,
        membershipStatus,
      });
    });

  const emit = () => {
    const circles = sortHomeCircles(
      Array.from(memberships.entries())
        .map(([circleId, membershipData]) =>
          buildCircleFromState(
            circleId,
            membershipData,
            states.get(circleId),
            viewerOpenOpportunities.get(circleId),
          ),
        )
        .filter((circle): circle is CircleManagementCard => Boolean(circle)),
    );

    const activeStates = new Map(
      Array.from(states.entries()).filter(
        ([, state]) =>
          getCircleLifecycleStatus(state.circleData) !== 'archived',
      ),
    );

    onData(
      buildHomeDataFromCircles({
        circles,
        completedDateKeys: recentCompletedDateKeys(
          activeStates,
          recentDateKeys,
        ),
        hasLoadedMemberships: true,
        hasResolvedGreetingContext: hasResolvedGreetingContext(),
        lookbackDays,
        membershipCount: circles.length,
        quantityMarkers: getRecentQuantityMarkers(
          activeStates,
          recentDateKeys,
        ),
        timezone,
      }),
    );
  };

  const stopCircleListeners = () => {
    circleUnsubscribes.forEach(unsubscribe => unsubscribe());
    circleUnsubscribes = [];
    states.forEach(state => {
      clearMemberProfileListeners(state);
      clearCircleOpportunityListener(state);
      clearPeriodCheckInListeners(state);
      clearRecentGroupCheckInListeners(state);
      clearSkipGraceCheckInListeners(state);
    });
    states.clear();
  };

  const startCircleListeners = () => {
    stopCircleListeners();

    memberships.forEach((membershipData, circleId) => {
      const membershipStatus = normalizeMembershipStatus(membershipData.status);
      const circleRef = firestore.collection(collections.circles).doc(circleId);
      const state: CircleSubscriptionState = {
        hasLoadedCircle: false,
        hasLoadedMembers: false,
        hasLoadedOpportunity: false,
        memberProfiles: new Map(),
        memberProfileUnsubscribes: new Map(),
        membersData: [membershipData],
        periodCheckInExpectedDateKeys: new Set(),
        periodCheckInLoadedDateKeys: new Set(),
        periodCheckInStatuses: new Map(),
        periodCheckInUnsubscribes: [],
        recentGroupQuantityMarkers: new Map(),
        recentGroupCheckInStatuses: new Map(),
        recentGroupCheckInUnsubscribes: [],
        recentUserCheckIns: new Map(),
        skipGraceCheckInStatuses: new Map(),
        skipGraceDateKeys: [],
        skipGraceLoadedDateKeys: new Set(),
        skipGraceUnsubscribes: [],
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
          state.hasLoadedCircle = true;
          if (membershipStatus === 'active') {
            syncCircleOpportunityListener({
              circleRef,
              onError,
              onUpdate: emit,
              state,
            });
            syncPeriodCheckInListeners({
              pace: normalizeCommitmentPace(
                state.circleData?.commitmentCadence,
                state.circleData?.commitmentFrequency,
              ),
              circleRef,
              onError,
              onUpdate: emit,
              state,
              timezone: asString(state.circleData?.timezone, 'UTC'),
              uid,
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
          state.hasLoadedMembers = true;
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
          pace: normalizeCommitmentPace(
            state.circleData.commitmentCadence,
            state.circleData.commitmentFrequency,
          ),
          circleRef,
          onError,
          onUpdate: emit,
          state,
          timezone: asString(state.circleData.timezone, 'UTC'),
          uid,
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
                getRecentUserCheckInMarker(snapshot, state.circleData),
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
  const unsubscribeViewerOpportunities = firestore
    .collection(collections.userPrivate)
    .doc(uid)
    .collection('opportunities')
    .where('isCurrentPeriod', '==', true)
    .onSnapshot(snapshot => {
      viewerOpenOpportunities.clear();
      snapshot.docs.forEach(doc => {
        const data = snapshotData(doc);
        const circleId = asString(data?.circleId);

        if (!circleId || data?.status !== 'available') {
          return;
        }

        const currentOpportunity = viewerOpenOpportunities.get(circleId);
        if (
          !currentOpportunity ||
          asString(data.expiresDateKey) <
            asString(currentOpportunity.expiresDateKey, '9999-12-31')
        ) {
          viewerOpenOpportunities.set(circleId, data);
        }
      });
      hasLoadedViewerOpportunities = true;
      emit();
    }, onError);

  return () => {
    unsubscribeMemberships();
    unsubscribeViewerOpportunities();
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
    hasLoadedCircle: false,
    hasLoadedMembers: false,
    hasLoadedOpportunity: false,
    memberProfiles: new Map(),
    memberProfileUnsubscribes: new Map(),
    periodCheckInExpectedDateKeys: new Set(),
    periodCheckInLoadedDateKeys: new Set(),
    periodCheckInStatuses: new Map(),
    periodCheckInUnsubscribes: [],
    recentGroupQuantityMarkers: new Map(),
    recentGroupCheckInStatuses: new Map(),
    recentGroupCheckInUnsubscribes: [],
    recentUserCheckIns: new Map(),
    skipGraceCheckInStatuses: new Map(),
    skipGraceDateKeys: [],
    skipGraceLoadedDateKeys: new Set(),
    skipGraceUnsubscribes: [],
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
      includeArchived: true,
      memberProfilesByUid: state.memberProfiles,
      membersData: state.membersData,
      membershipData,
      periodOpportunityData: state.circleOpportunityData,
      periodCheckInStatuses: state.periodCheckInStatuses,
      todayCheckInStatuses: state.todayCheckInStatuses,
      viewerSkipGraceDateKeys: state.skipGraceDateKeys,
      viewerSkipGraceLoadedDateKeys: state.skipGraceLoadedDateKeys,
      viewerSkipGraceStatuses: state.skipGraceCheckInStatuses,
      viewerTodayCheckIn: state.viewerTodayCheckIn,
    });
    const groupProgressDays = buildCircleGroupProgressDays({
      memberRecords: state.membersData ?? [],
      recentQuantityMarkers: state.recentGroupQuantityMarkers ?? new Map(),
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
    clearCircleOpportunityListener(state);
    clearPeriodCheckInListeners(state);
    clearRecentGroupCheckInListeners(state);
    clearSkipGraceCheckInListeners(state);
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
      syncCircleOpportunityListener({
        circleRef,
        onError,
        onUpdate: emit,
        state,
      });
      syncPeriodCheckInListeners({
        pace: normalizeCommitmentPace(
          state.circleData.commitmentCadence,
          state.circleData.commitmentFrequency,
        ),
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData.timezone, 'UTC'),
        uid,
      });
      syncRecentGroupCheckInListeners({
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData.timezone, 'UTC'),
      });
      syncSkipGraceCheckInListeners({
        circleRef,
        graceRule: normalizeGraceRules(state.circleData.graceRules).skip,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData.timezone, 'UTC'),
        uid,
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
              getRecentUserCheckInMarker(snapshot, state.circleData),
            );
            emit();
          }, onError),
      );
    });
  };

  const unsubscribeCircle = circleRef.onSnapshot(snapshot => {
    state.circleData = snapshotData(snapshot);
    if (normalizeMembershipStatus(membershipData?.status) === 'active') {
      syncCircleOpportunityListener({
        circleRef,
        onError,
        onUpdate: emit,
        state,
      });
      syncPeriodCheckInListeners({
        pace: normalizeCommitmentPace(
          state.circleData?.commitmentCadence,
          state.circleData?.commitmentFrequency,
        ),
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData?.timezone, 'UTC'),
        uid,
      });
      syncRecentGroupCheckInListeners({
        circleRef,
        onError,
        onUpdate: emit,
        state,
        timezone: asString(state.circleData?.timezone, 'UTC'),
      });
      if (state.circleData) {
        syncSkipGraceCheckInListeners({
          circleRef,
          graceRule: normalizeGraceRules(state.circleData.graceRules).skip,
          onError,
          onUpdate: emit,
          state,
          timezone: asString(state.circleData.timezone, 'UTC'),
          uid,
        });
      } else {
        clearSkipGraceCheckInListeners(state);
      }
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
    clearCircleOpportunityListener(state);
    clearRecentGroupCheckInListeners(state);
    clearSkipGraceCheckInListeners(state);
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
  const commitmentPace = normalizeCommitmentPace(
    summary.commitmentCadence,
    summary.commitmentFrequency,
  );
  const progressLabel =
    summary.progressLabel ??
    `${getCurrentCycleLabel(commitmentPace)} · ${progressPercent}%`;

  return {
    ...summary,
    activity: [],
    completionRate: summary.completionRate ?? progressPercent,
    commitmentCadence: commitmentPace,
    commitmentFrequency: normalizeCommitmentFrequency(
      summary.commitmentFrequency ?? {tapInsPerWeek: 7},
      commitmentPace,
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
