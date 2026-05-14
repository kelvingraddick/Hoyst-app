import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {DateTime} from 'luxon';

import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {collections} from '../../../types/firestore';
import type {
  CircleDetailModel,
  CircleManagementCard,
  CircleManagementFilter,
  CircleMemberState,
  CircleMemberStatus,
  CircleMembershipStatus,
  CircleProgressDay,
  CircleSummary,
  CheckInStatus,
  GraceRule,
  MemberRole,
  ProgressDayState,
} from '../../../types/models';

export type HomeProgressCell = {
  dateKey: string;
  label: string;
  state: ProgressDayState;
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
  todayCheckInStatuses?: ReadonlyMap<string, CheckInStatus>;
  todayCheckInUids?: ReadonlySet<string>;
};

type CircleSubscriptionState = {
  circleData?: PlainData;
  memberProfiles: Map<string, PlainData>;
  memberProfileUnsubscribes: Map<string, () => void>;
  membersData?: PlainData[];
  recentUserCheckIns: Map<string, boolean>;
  todayCheckInStatuses: Map<string, CheckInStatus>;
};

type HomeSubscriptionOptions = {
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
  todayCheckInStatuses: ReadonlyMap<string, CheckInStatus>,
): CircleMemberState {
  const status = normalizeMembershipStatus(memberData.status);
  const uid = asString(memberData.uid);

  if (status !== 'active') {
    return 'pending';
  }

  const checkInStatus = uid ? todayCheckInStatuses.get(uid) : undefined;

  if (checkInStatus === 'skip') {
    return 'skipped';
  }

  return checkInStatus === 'done' ? 'done' : 'pending';
}

function mapMemberStatus(
  memberData: PlainData,
  todayCheckInStatuses: ReadonlyMap<string, CheckInStatus>,
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
    state: getMemberState(memberData, todayCheckInStatuses),
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

function getRecentDates(timezone: string, now = new Date()) {
  const today = DateTime.fromJSDate(now, {zone: timezone}).startOf('day');

  return Array.from({length: 7}, (_, index) => {
    const date = today.minus({days: 6 - index});
    return {
      dateKey: date.toFormat('yyyy-LL-dd'),
      label: date.toFormat('dd'),
    };
  });
}

function buildProgressDays(
  timezone: string,
  completedDateKeys: ReadonlySet<string>,
  now?: Date,
): HomeProgressCell[] {
  const recentDates = getRecentDates(timezone, now);
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

export function createEmptyHomeData(timezone = 'UTC', now = new Date()) {
  const completedDateKeys = new Set<string>();
  const progressDays = buildProgressDays(timezone, completedDateKeys, now);
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
  membershipCount = circles.length,
  timezone,
  now = new Date(),
}: {
  circles: CircleManagementCard[];
  completedDateKeys: ReadonlySet<string>;
  hasLoadedMemberships?: boolean;
  membershipCount?: number;
  now?: Date;
  timezone: string;
}) {
  const progressDays = buildProgressDays(timezone, completedDateKeys, now);
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

export function mapHomeCircleFromData({
  circleData,
  circleId,
  memberProfilesByUid,
  membersData = [],
  membershipData,
  todayCheckInStatuses,
  todayCheckInUids = new Set<string>(),
}: HomeCircleMappingInput): CircleManagementCard | undefined {
  const membershipStatus = normalizeMembershipStatus(membershipData?.status);

  if (!circleData || !membershipData || !membershipStatus) {
    return undefined;
  }

  const title = asString(circleData.title);
  const dailyTask = asString(circleData.dailyTask);

  if (!title || !dailyTask) {
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
  const isPending = membershipStatus === 'pending';
  const memberRecords = membersData.length > 0 ? membersData : [membershipData];
  const activeMemberCount = memberRecords.filter(
    memberData => normalizeMembershipStatus(memberData.status) === 'active',
  ).length;
  const visibleMembers = memberRecords
    .map(memberData => mergeMemberProfileData(memberData, memberProfilesByUid))
    .map(memberData => mapMemberStatus(memberData, coveredCheckIns))
    .filter((member): member is CircleMemberStatus => Boolean(member));
  const memberCount = asNumber(
    circleData.memberCount,
    Math.max(memberRecords.length, visibleMembers.length),
  );
  const progressBase = Math.max(activeMemberCount, isPending ? 0 : memberCount);
  const todayCheckInCount = coveredCheckIns.size;
  const progressPercent =
    progressBase > 0 ? Math.round((todayCheckInCount / progressBase) * 100) : 0;
  const viewerTodayStatus = uid ? coveredCheckIns.get(uid) : undefined;
  const viewerHasCheckedIn = isPending ? true : Boolean(viewerTodayStatus);
  const remainingCheckIns = isPending
    ? 0
    : Math.max(progressBase - todayCheckInCount, 0);
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

  return {
    category: asString(circleData.category, 'General'),
    completionRate: progressPercent,
    dailyTask,
    graceRules: normalizeGraceRules(circleData.graceRules),
    id: circleId,
    inviteUrl: getInviteUrl(circleData),
    joinMode: normalizeJoinMode(circleData.joinMode),
    matchCopy: matchCopy || undefined,
    maxSize: asNumber(circleData.maxSize, Math.max(memberCount, 1)),
    memberCount,
    members: visibleMembers,
    privacy: normalizePrivacy(circleData.privacy),
    progressLabel: isPending ? 'Pending approval' : undefined,
    progressPercent,
    remainingCheckIns,
    state,
    streakDays,
    streakLabel: isPending
      ? 'Pending approval'
      : streakDays > 0
      ? `${streakDays}d streak`
      : 'Start today',
    title,
    viewerHasCheckedIn,
    viewerMembershipStatus: membershipStatus,
    viewerRole: normalizeMemberRole(membershipData.role),
    viewerTodayStatus,
  };
}

export function getHomeCircleUrgencyRank(circle: CircleManagementCard) {
  if (circle.viewerMembershipStatus === 'pending') {
    return 6;
  }

  const needsViewer = !circle.viewerHasCheckedIn;
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

export function matchesHomeCircleFilter(
  circle: CircleManagementCard,
  filter: CircleManagementFilter,
) {
  if (circle.viewerMembershipStatus === 'pending') {
    return filter === 'all';
  }

  if (filter === 'needsYou') {
    return !circle.viewerHasCheckedIn;
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
  onData,
  onError,
  timezone,
  uid,
}: HomeSubscriptionOptions) {
  const firestore = firebaseFirestore();
  const recentDateKeys = getRecentDates(timezone).map(day => day.dateKey);
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
        membershipCount: memberships.size,
        timezone,
      }),
    );
  };

  const stopCircleListeners = () => {
    circleUnsubscribes.forEach(unsubscribe => unsubscribe());
    circleUnsubscribes = [];
    states.forEach(clearMemberProfileListeners);
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

      const todayDateKey = recentDateKeys[recentDateKeys.length - 1];

      if (todayDateKey) {
        circleUnsubscribes.push(
          circleRef
            .collection('days')
            .doc(todayDateKey)
            .collection('checkIns')
            .onSnapshot(snapshot => {
              state.todayCheckInStatuses = new Map(
                snapshot.docs
                  .map(doc => {
                    const uidValue = asString(doc.data().uid, doc.id);
                    const status =
                      normalizeCheckInStatus(doc.data().status) ?? 'done';

                    return uidValue && isCoveredCheckInStatus(status)
                      ? ([uidValue, status] as const)
                      : undefined;
                  })
                  .filter((entry): entry is readonly [string, CheckInStatus] =>
                    Boolean(entry),
                  ),
              );
              emit();
            }, onError),
        );
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
  const todayDateKey = recentDateKeys[recentDateKeys.length - 1];
  const circleRef = firestore.collection(collections.circles).doc(circleId);
  const state: CircleSubscriptionState = {
    memberProfiles: new Map(),
    memberProfileUnsubscribes: new Map(),
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
      todayCheckInStatuses: state.todayCheckInStatuses,
    });

    onDetail(circle ? buildCircleDetailFromHomeCircle(circle) : undefined);
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

    if (todayDateKey) {
      activeUnsubscribes.push(
        circleRef
          .collection('days')
          .doc(todayDateKey)
          .collection('checkIns')
          .onSnapshot(snapshot => {
            state.todayCheckInStatuses = new Map(
              snapshot.docs
                .map(doc => {
                  const uidValue = asString(doc.data().uid, doc.id);
                  const status =
                    normalizeCheckInStatus(doc.data().status) ?? 'done';

                  return uidValue && isCoveredCheckInStatus(status)
                    ? ([uidValue, status] as const)
                    : undefined;
                })
                .filter((entry): entry is readonly [string, CheckInStatus] =>
                  Boolean(entry),
                ),
            );
            emit();
          }, onError),
      );
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
  };
}

export function buildCircleDetailFromHomeCircle(
  circle: CircleManagementCard,
): CircleDetailModel {
  const monthProgress = Array.from({length: 7}, (_, index) => ({
    day: index + 1,
    state: index === 6 ? 'today' : 'future',
  })) satisfies CircleProgressDay[];

  return {
    ...circle,
    activity: [],
    completionRate: circle.completionRate ?? circle.progressPercent,
    dailyGoal: `Daily goal: ${circle.dailyTask}`,
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

  return {
    ...summary,
    activity: [],
    completionRate: summary.completionRate ?? progressPercent,
    dailyGoal: `Daily goal: ${summary.dailyTask}`,
    memberCount: summary.memberCount ?? summary.members.length,
    monthProgress: Array.from({length: 7}, (_, index) => ({
      day: index + 1,
      state: index === 6 ? 'today' : 'future',
    })),
    maxSize: summary.maxSize ?? Math.max(summary.members.length, 1),
    progressPercent,
    remainingCheckIns: summary.remainingCheckIns ?? 0,
    state: summary.state ?? 'active',
    streakDays: summary.streakDays ?? 0,
    viewerHasCheckedIn: summary.viewerHasCheckedIn ?? true,
  };
}
