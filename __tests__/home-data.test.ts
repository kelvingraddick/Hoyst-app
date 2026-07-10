jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {
  buildCircleDetailFromHomeCircle,
  buildCircleGroupProgressDays,
  buildHomeDataFromCircles,
  canTapInToday,
  createEmptyHomeData,
  getHomeFilterCounts,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomeGreetingTimeWindow,
  getTodayAttentionCircles,
  getUpcomingAttentionCircles,
  mapHomeCircleFromData,
  matchesHomeCircleFilter,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeCreateCircleButton,
  shouldShowHomeDataErrorPanel,
} from '../src/features/home/services/home-data-service';
import type {CircleManagementCard} from '../src/types/models';

const circleData = {
  category: 'Fitness',
  commitment: '30min workout',
  commitmentFrequency: {tapInsPerWeek: 1},
  joinMode: 'invite_only',
  maxSize: 4,
  memberCount: 2,
  privacy: 'private',
  title: 'Real Fitness Circle',
};

function homeCard(
  overrides: Partial<CircleManagementCard> = {},
): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: '30min workout',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 0,
    id: 'circle-1',
    inviteUrl: undefined,
    joinMode: 'invite_only',
    maxSize: 4,
    memberCount: 2,
    members: [],
    privacy: 'private',
    progressLabel: 'Today · 0%',
    progressPercent: 0,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 0,
    streakLabel: 'Start today',
    title: 'Real Fitness Circle',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    viewerTodayStatus: undefined,
    ...overrides,
  };
}

describe('home data mapping', () => {
  it('builds group last-7-days progress with partial, empty, complete, and skip-covered days', () => {
    const groupDays = buildCircleGroupProgressDays({
      memberRecords: [
        {status: 'active', uid: 'user-1'},
        {status: 'pending', uid: 'user-2'},
        {status: 'active', uid: 'user-3'},
      ],
      now: new Date('2026-05-29T12:00:00.000Z'),
      recentCheckInStatuses: new Map([
        ['2026-05-23', new Map()],
        [
          '2026-05-24',
          new Map([
            ['user-1', 'done'],
            ['user-2', 'skip'],
          ]),
        ],
        [
          '2026-05-25',
          new Map([
            ['user-1', 'done'],
            ['user-2', 'skip'],
            ['user-3', 'done'],
          ]),
        ],
      ]),
      timezone: 'UTC',
    });

    expect(groupDays).toHaveLength(7);
    expect(groupDays.find(day => day.dateKey === '2026-05-23')).toMatchObject({
      coveredCount: 0,
      state: 'future',
      totalCount: 3,
    });
    expect(groupDays.find(day => day.dateKey === '2026-05-24')).toMatchObject({
      coveredCount: 2,
      state: 'future',
      totalCount: 3,
    });
    expect(groupDays.find(day => day.dateKey === '2026-05-25')).toMatchObject({
      coveredCount: 3,
      state: 'done',
      totalCount: 3,
    });
  });

  it('keeps quantity markers on group last-7-days progress days', () => {
    const groupDays = buildCircleGroupProgressDays({
      memberRecords: [{status: 'active', uid: 'user-1'}],
      now: new Date('2026-05-29T12:00:00.000Z'),
      recentCheckInStatuses: new Map([
        ['2026-05-29', new Map([['user-1', 'done']])],
      ]),
      recentQuantityMarkers: new Map([
        ['2026-05-29', {quantityLabel: '4', quantityValue: 4}],
      ]),
      timezone: 'UTC',
    });

    expect(groupDays.find(day => day.dateKey === '2026-05-29')).toMatchObject({
      coveredCount: 1,
      quantityLabel: '4',
      quantityValue: 4,
      state: 'done',
      totalCount: 1,
    });
  });

  it('builds the Today attention list from Tap In and Nudge actions only', () => {
    const needsTapIn = homeCard({
      id: 'needs-tap-in',
      title: 'Needs Tap In',
    });
    const needsNudge = homeCard({
      id: 'needs-nudge',
      nudgeTargetCount: 2,
      progressPercent: 55,
      remainingCheckIns: 2,
      title: 'Needs Nudge',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const coveredQuantityWithNudge = homeCard({
      commitmentType: 'build',
      currentValue: 5,
      id: 'covered-quantity-with-nudge',
      nudgeTargetCount: 1,
      progressPercent: 75,
      remainingCheckIns: 1,
      targetValue: 5,
      title: 'Covered Quantity With Nudge',
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const coveredQuantityViewOnly = homeCard({
      commitmentType: 'limit',
      currentValue: 4,
      id: 'covered-quantity-view-only',
      maximumValue: 6,
      minimumValue: 2,
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Covered Quantity View Only',
      unitLabel: 'servings',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const shareOnly = homeCard({
      id: 'share-only',
      inviteUrl: 'https://hoyst.app/join/share-only',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Share Only',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerRole: 'owner',
      viewerTodayStatus: 'done',
    });
    const viewOnly = homeCard({
      id: 'view-only',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'View Only',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const pending = homeCard({
      id: 'pending',
      remainingCheckIns: 0,
      title: 'Pending',
      viewerHasCheckedIn: true,
      viewerMembershipStatus: 'pending',
      viewerRemainingTapIns: 0,
    });

    expect(getHomeCircleActionVariant(needsTapIn)).toBe('check_in');
    expect(getHomeCircleActionVariant(needsNudge)).toBe('nudge');
    expect(getHomeCircleActionVariant(coveredQuantityWithNudge)).toBe('nudge');
    expect(getHomeCircleActionVariant(coveredQuantityViewOnly)).toBe('view');
    expect(getHomeCircleActionVariant(shareOnly)).toBe('share');
    expect(getHomeCircleActionVariant(viewOnly)).toBe('view');
    expect(getHomeCircleActionVariant(pending)).toBe('view');
    expect(
      getTodayAttentionCircles([
        shareOnly,
        viewOnly,
        pending,
        coveredQuantityViewOnly,
        coveredQuantityWithNudge,
        needsNudge,
        needsTapIn,
      ]).map(circle => circle.id),
    ).toEqual(['needs-tap-in', 'needs-nudge', 'covered-quantity-with-nudge']);
  });

  it('builds Upcoming from soon attention that is not needed today', () => {
    const today = homeCard({
      id: 'today',
      title: 'Today',
    });
    const weeklyRemaining = homeCard({
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
      id: 'weekly-remaining',
      nudgeTargetCount: 0,
      progressLabel: 'Week · 50%',
      progressPercent: 50,
      remainingCheckIns: 2,
      title: 'Weekly Remaining',
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 2,
      viewerTodayStatus: 'done',
    });
    const dailyTomorrow = homeCard({
      id: 'daily-tomorrow',
      progressLabel: 'Today · 100%',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Daily Tomorrow',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const completeWeekly = homeCard({
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 4},
      id: 'complete-weekly',
      progressLabel: 'Week · 100%',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Complete Weekly',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const pending = homeCard({
      id: 'pending-upcoming',
      remainingCheckIns: 0,
      title: 'Pending Upcoming',
      viewerHasCheckedIn: true,
      viewerMembershipStatus: 'pending',
      viewerRemainingTapIns: 0,
    });

    expect(getHomeCircleActionVariant(weeklyRemaining)).toBe('view');
    expect(
      getUpcomingAttentionCircles([
        today,
        weeklyRemaining,
        dailyTomorrow,
        completeWeekly,
        pending,
      ]).map(circle => circle.id),
    ).toEqual(['weekly-remaining', 'daily-tomorrow', 'pending-upcoming']);
  });

  it('keeps completed weekly and monthly commitments tappable on a new day', () => {
    const weeklyCompleteNewDay = homeCard({
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 2},
      id: 'weekly-complete-new-day',
      progressLabel: 'Week · 100%',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Weekly Complete New Day',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: false,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: undefined,
    });
    const monthlyCompleteNewDay = homeCard({
      commitmentCadence: 'monthly',
      commitmentFrequency: {opportunitiesPerPeriod: 4, tapInsPerWeek: 4},
      id: 'monthly-complete-new-day',
      progressLabel: 'Month · 100%',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      title: 'Monthly Complete New Day',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: false,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: undefined,
    });

    expect(canTapInToday(weeklyCompleteNewDay)).toBe(true);
    expect(canTapInToday(monthlyCompleteNewDay)).toBe(true);
    expect(getHomeCircleActionVariant(weeklyCompleteNewDay)).toBe('check_in');
    expect(getHomeCircleActionVariant(monthlyCompleteNewDay)).toBe('check_in');
    expect(
      getTodayAttentionCircles([
        weeklyCompleteNewDay,
        monthlyCompleteNewDay,
      ]).map(circle => circle.id),
    ).toEqual(['monthly-complete-new-day', 'weekly-complete-new-day']);
    expect(getUpcomingAttentionCircles([weeklyCompleteNewDay])).toEqual([]);
    expect(matchesHomeCircleFilter(weeklyCompleteNewDay, 'needsYou')).toBe(
      true,
    );
  });

  it('separates quantity update eligibility from Tap In due attention', () => {
    const legacyDone = homeCard({
      state: 'done',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const quantityBuildDone = homeCard({
      commitmentType: 'build',
      currentValue: 6,
      state: 'done',
      targetValue: 5,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const quantityBuildPartial = homeCard({
      commitmentType: 'build',
      currentValue: 3,
      state: 'active',
      targetValue: 5,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 1,
      viewerTodayStatus: 'partial',
    });
    const quantityLimitDone = homeCard({
      commitmentType: 'limit',
      currentValue: 4,
      maximumValue: 6,
      minimumValue: 2,
      state: 'done',
      unitLabel: 'servings',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: 'done',
    });
    const quantityLimitFailed = homeCard({
      commitmentType: 'limit',
      currentValue: 8,
      maximumValue: 6,
      minimumValue: 2,
      unitLabel: 'servings',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 1,
      viewerTodayStatus: 'failed',
    });

    expect(canTapInToday(legacyDone)).toBe(false);
    expect(canTapInToday(quantityBuildDone)).toBe(false);
    expect(canTapInToday(quantityBuildPartial)).toBe(true);
    expect(canTapInToday(quantityLimitDone)).toBe(false);
    expect(canTapInToday(quantityLimitFailed)).toBe(true);
    expect(getHomeCircleActionVariant(quantityBuildDone)).toBe('view');
    expect(getHomeCircleActionVariant(quantityBuildPartial)).toBe('check_in');
    expect(getHomeCircleActionVariant(quantityLimitDone)).toBe('view');
    expect(getHomeCircleActionVariant(quantityLimitFailed)).toBe('check_in');
    expect(matchesHomeCircleFilter(quantityBuildDone, 'needsYou')).toBe(false);
    expect(matchesHomeCircleFilter(quantityBuildPartial, 'needsYou')).toBe(
      true,
    );
    expect(matchesHomeCircleFilter(quantityLimitDone, 'needsYou')).toBe(false);
    expect(matchesHomeCircleFilter(quantityLimitFailed, 'needsYou')).toBe(true);
    expect(getTodayAttentionCircles([quantityBuildDone])).toEqual([]);
  });

  it('maps active membership and today check-ins into a real Home card', () => {
    const memberProfilesByUid = new Map([
      ['user-2', {avatarUrl: 'https://example.com/ava.png'}],
    ]);
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-1',
      memberProfilesByUid,
      membersData: [
        {
          avatarUrl: 'https://example.com/kelvin.png',
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
        {
          displayName: 'Ava Stone',
          role: 'member',
          status: 'active',
          uid: 'user-2',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInUids: new Set(['user-1']),
    });

    expect(card).toMatchObject({
      commitmentCadence: 'weekly',
      id: 'circle-1',
      nudgeTargetCount: 1,
      progressLabel: 'Week · 50%',
      progressPercent: 50,
      remainingCheckIns: 1,
      state: 'active',
      streakLabel: 'Already tapped in',
      title: 'Real Fitness Circle',
      viewerHasCheckedIn: true,
      viewerMembershipStatus: 'active',
      viewerRole: 'owner',
      viewerTodayStatus: 'done',
    });
    expect(card?.members).toEqual([
      expect.objectContaining({
        avatarUrl: 'https://example.com/kelvin.png',
        id: 'user-1',
        initials: 'KN',
        state: 'done',
      }),
      expect.objectContaining({id: 'user-2', initials: 'AS', state: 'pending'}),
    ]);
    expect(card?.members[1]).toMatchObject({
      avatarUrl: 'https://example.com/ava.png',
    });
  });

  it('maps pending memberships as visible but not due for Tap In', () => {
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-2',
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'pending',
        uid: 'user-1',
      },
    });

    expect(card).toMatchObject({
      matchCopy: 'Pending approval before Tap In unlocks.',
      remainingCheckIns: 0,
      streakLabel: 'Pending approval',
      viewerHasCheckedIn: true,
      viewerMembershipStatus: 'pending',
    });
    expect(matchesHomeCircleFilter(card!, 'all')).toBe(true);
    expect(matchesHomeCircleFilter(card!, 'needsYou')).toBe(false);
    expect(matchesHomeCircleFilter(card!, 'done')).toBe(false);
  });

  it('counts skips as covered while keeping member state distinct', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        graceRules: {
          skip: {
            allowance: 1,
            windowDays: 7,
          },
        },
      },
      circleId: 'circle-skip',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
        {
          displayName: 'Ava Stone',
          role: 'member',
          status: 'active',
          uid: 'user-2',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([
        ['user-1', 'skip'],
        ['user-2', 'done'],
      ]),
    });

    expect(card).toMatchObject({
      commitmentCadence: 'weekly',
      graceRules: {
        skip: {
          allowance: 1,
          windowDays: 7,
        },
      },
      progressLabel: 'Week · 100%',
      progressPercent: 100,
      remainingCheckIns: 0,
      state: 'done',
      streakLabel: 'Already tapped in',
      viewerHasCheckedIn: true,
      viewerTodayStatus: 'skip',
    });
    expect(card?.members).toEqual([
      expect.objectContaining({id: 'user-1', state: 'skipped'}),
      expect.objectContaining({id: 'user-2', state: 'done'}),
    ]);
  });

  it('maps viewer proof details into the circle detail model', () => {
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-proof',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([['user-1', 'done']]),
      viewerTodayCheckIn: {
        note: 'Finished the full sleep commitment.',
        photoUrl: 'https://example.com/sleep-proof.jpg',
        status: 'done',
      },
    });

    const detail = buildCircleDetailFromHomeCircle(card!);

    expect(detail.viewerTodayCheckIn).toEqual({
      note: 'Finished the full sleep commitment.',
      photoUrl: 'https://example.com/sleep-proof.jpg',
      status: 'done',
    });
  });

  it('derives viewer skip availability from loaded grace-window statuses', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        graceRules: {
          skip: {
            allowance: 1,
            windowDays: 7,
          },
        },
      },
      circleId: 'circle-skip-availability',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      viewerSkipGraceDateKeys: ['2026-05-29', '2026-05-28', '2026-05-27'],
      viewerSkipGraceLoadedDateKeys: new Set([
        '2026-05-29',
        '2026-05-28',
        '2026-05-27',
      ]),
      viewerSkipGraceStatuses: new Map([['2026-05-28', 'skip']]),
    });

    expect(card?.viewerAvailableSkips).toBe(0);
  });

  it('does not expose viewer skip availability before the grace window loads', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        graceRules: {
          skip: {
            allowance: 1,
            windowDays: 7,
          },
        },
      },
      circleId: 'circle-skip-loading',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      viewerSkipGraceDateKeys: ['2026-05-29', '2026-05-28'],
      viewerSkipGraceLoadedDateKeys: new Set(['2026-05-29']),
      viewerSkipGraceStatuses: new Map(),
    });

    expect(card?.viewerAvailableSkips).toBeUndefined();
  });

  it('maps daily commitments from today coverage only', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        commitmentCadence: 'daily',
        commitmentFrequency: {tapInsPerWeek: 7},
      },
      circleId: 'circle-daily',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
        {
          displayName: 'Ava Stone',
          role: 'member',
          status: 'active',
          uid: 'user-2',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      periodCheckInStatuses: new Map([
        [
          '2026-05-18',
          new Map([
            ['user-1', 'done'],
            ['user-2', 'done'],
          ]),
        ],
      ]),
      todayCheckInStatuses: new Map([['user-1', 'done']]),
    });

    expect(card).toMatchObject({
      commitmentCadence: 'daily',
      nudgeTargetCount: 1,
      progressLabel: 'Today · 50%',
      progressPercent: 50,
      remainingCheckIns: 1,
      state: 'active',
      viewerHasCheckedIn: true,
      viewerRemainingTapIns: 0,
    });
    expect(card?.members).toEqual([
      expect.objectContaining({id: 'user-1', state: 'done'}),
      expect.objectContaining({id: 'user-2', state: 'pending'}),
    ]);
  });

  it('maps a removed check-in back to needs-you state', () => {
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-removed-check-in',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
        {
          displayName: 'Ava Stone',
          role: 'member',
          status: 'active',
          uid: 'user-2',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([['user-2', 'done']]),
    });

    expect(card).toMatchObject({
      commitmentCadence: 'weekly',
      progressLabel: 'Week · 50%',
      progressPercent: 50,
      remainingCheckIns: 1,
      state: 'active',
      streakLabel: 'Start today',
      viewerHasCheckedIn: false,
      viewerTodayStatus: undefined,
    });
    expect(matchesHomeCircleFilter(card!, 'needsYou')).toBe(true);
  });

  it('tracks weekly Commitment Frequency separately from today status', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        commitmentFrequency: {tapInsPerWeek: 4},
      },
      circleId: 'circle-weekly',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
        {
          displayName: 'Ava Stone',
          role: 'member',
          status: 'active',
          uid: 'user-2',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      periodCheckInStatuses: new Map([
        [
          '2026-05-18',
          new Map([
            ['user-1', 'done'],
            ['user-2', 'done'],
          ]),
        ],
        ['2026-05-19', new Map([['user-1', 'done']])],
      ]),
      todayCheckInStatuses: new Map([['user-1', 'done']]),
    });

    expect(card).toMatchObject({
      commitmentCadence: 'weekly',
      progressLabel: 'Week · 38%',
      progressPercent: 38,
      nudgeTargetCount: 1,
      remainingCheckIns: 5,
      state: 'risk',
      streakLabel: 'Tapped today',
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 2,
      viewerTodayStatus: 'done',
    });
    expect(card?.members).toEqual([
      expect.objectContaining({id: 'user-1', state: 'pending'}),
      expect.objectContaining({id: 'user-2', state: 'pending'}),
    ]);
  });

  it('does not create a nudge target for the viewer after their daily Tap In', () => {
    const card = mapHomeCircleFromData({
      circleData: {
        ...circleData,
        commitmentFrequency: {tapInsPerWeek: 4},
        memberCount: 1,
      },
      circleId: 'circle-weekly-solo',
      membersData: [
        {
          displayName: 'Kelvin North',
          role: 'owner',
          status: 'active',
          uid: 'user-1',
        },
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
      periodCheckInStatuses: new Map([
        ['2026-05-19', new Map([['user-1', 'done']])],
      ]),
      todayCheckInStatuses: new Map([['user-1', 'done']]),
    });

    expect(card).toMatchObject({
      nudgeTargetCount: 0,
      progressLabel: 'Week · 25%',
      progressPercent: 25,
      remainingCheckIns: 3,
      streakLabel: 'Tapped today',
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 3,
    });
  });

  it('keeps positive streak labels unchanged', () => {
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-positive-streak',
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'active',
        streakDays: 4,
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([['user-1', 'done']]),
    });

    expect(card).toMatchObject({
      streakDays: 4,
      streakLabel: '4d streak',
      viewerHasCheckedIn: true,
      viewerTodayStatus: 'done',
    });
  });

  it('ignores incomplete or missing real records instead of filling mocks', () => {
    expect(
      mapHomeCircleFromData({
        circleData: {title: 'Missing task'},
        circleId: 'circle-3',
        membershipData: {status: 'active', uid: 'user-1'},
      }),
    ).toBeUndefined();
    expect(
      mapHomeCircleFromData({
        circleData,
        circleId: 'circle-4',
      }),
    ).toBeUndefined();
  });

  it('keeps guest and incomplete Home state empty', () => {
    const homeData = createEmptyHomeData(
      'UTC',
      new Date('2026-05-07T12:00:00.000Z'),
    );

    expect(homeData.circles).toEqual([]);
    expect(homeData.hasLoadedMemberships).toBe(false);
    expect(homeData.hasRealProgress).toBe(false);
    expect(homeData.membershipCount).toBe(0);
    expect(homeData.progressPercent).toBe(0);
    expect(homeData.progressDays).toHaveLength(7);
    expect(homeData.progressDays.every(day => day.state !== 'done')).toBe(true);

    expect(
      createEmptyHomeData('UTC', new Date('2026-05-07T12:00:00.000Z'), 28)
        .progressDays,
    ).toHaveLength(28);
  });

  it('builds progress only from completed real date keys', () => {
    const homeData = buildHomeDataFromCircles({
      circles: [],
      completedDateKeys: new Set(['2026-05-07', '2026-05-06']),
      now: new Date('2026-05-07T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(homeData.hasRealProgress).toBe(true);
    expect(homeData.personalStreakDays).toBe(2);
    expect(homeData.progressPercent).toBe(29);
  });

  it('supports a 28 day progress lookback without changing streak semantics', () => {
    const homeData = buildHomeDataFromCircles({
      circles: [],
      completedDateKeys: new Set(['2026-05-07', '2026-05-06']),
      lookbackDays: 28,
      now: new Date('2026-05-07T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(homeData.progressDays).toHaveLength(28);
    expect(homeData.progressDays[0]).toMatchObject({
      dateKey: '2026-04-10',
      label: '10',
    });
    expect(homeData.progressDays[27]).toMatchObject({
      dateKey: '2026-05-07',
      label: '07',
      state: 'done',
    });
    expect(homeData.personalStreakDays).toBe(2);
    expect(homeData.progressPercent).toBe(7);
  });

  it('counts pending memberships only in the all filter', () => {
    const activeCard = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-active',
      membersData: [
        {displayName: 'Kelvin North', status: 'active', uid: 'user-1'},
      ],
      membershipData: {role: 'member', status: 'active', uid: 'user-1'},
    });
    const pendingCard = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-pending',
      membershipData: {role: 'member', status: 'pending', uid: 'user-1'},
    });

    expect(getHomeFilterCounts([activeCard!, pendingCard!])).toEqual({
      all: 2,
      atRisk: 1,
      done: 0,
      needsYou: 1,
    });
  });

  it('shows the Create Circle CTA for signed-out and authenticated Home states', () => {
    expect(
      shouldShowHomeCreateCircleButton({
        isAuthenticatedHome: false,
        showAccountPrompt: true,
      }),
    ).toBe(true);
    expect(
      shouldShowHomeCreateCircleButton({
        isAuthenticatedHome: true,
        showAccountPrompt: false,
      }),
    ).toBe(true);
    expect(
      shouldShowHomeCreateCircleButton({
        isAuthenticatedHome: false,
        showAccountPrompt: false,
      }),
    ).toBe(false);
  });

  it('shows the authenticated Home empty state when no circles can render', () => {
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 0,
        hasHomeDataError: false,
        hasLoadedMemberships: true,
        isAuthenticatedHome: true,
        isLoadingHomeData: false,
        membershipCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 0,
        hasHomeDataError: false,
        hasLoadedMemberships: true,
        isAuthenticatedHome: true,
        isLoadingHomeData: true,
        membershipCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 1,
        hasHomeDataError: false,
        hasLoadedMemberships: true,
        isAuthenticatedHome: true,
        isLoadingHomeData: false,
        membershipCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 0,
        hasHomeDataError: false,
        hasLoadedMemberships: true,
        isAuthenticatedHome: false,
        isLoadingHomeData: false,
        membershipCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 0,
        hasHomeDataError: true,
        hasLoadedMemberships: true,
        isAuthenticatedHome: true,
        isLoadingHomeData: false,
        membershipCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowAuthenticatedHomeEmptyState({
        circleCount: 0,
        hasHomeDataError: false,
        hasLoadedMemberships: true,
        isAuthenticatedHome: true,
        isLoadingHomeData: false,
        membershipCount: 1,
      }),
    ).toBe(false);
  });

  it('only shows the Home error panel when known circles cannot render', () => {
    expect(
      shouldShowHomeDataErrorPanel({
        circleCount: 0,
        hasHomeDataError: true,
        hasLoadedMemberships: true,
        isLoadingHomeData: false,
        membershipCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldShowHomeDataErrorPanel({
        circleCount: 1,
        hasHomeDataError: true,
        hasLoadedMemberships: true,
        isLoadingHomeData: false,
        membershipCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldShowHomeDataErrorPanel({
        circleCount: 0,
        hasHomeDataError: true,
        hasLoadedMemberships: true,
        isLoadingHomeData: true,
        membershipCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldShowHomeDataErrorPanel({
        circleCount: 0,
        hasHomeDataError: true,
        hasLoadedMemberships: true,
        isLoadingHomeData: false,
        membershipCount: 0,
      }),
    ).toBe(false);
  });
});

describe('Home greeting fallback', () => {
  const makeActiveCard = () =>
    mapHomeCircleFromData({
      circleData,
      circleId: 'circle-active',
      membersData: [
        {displayName: 'Kelvin North', status: 'active', uid: 'user-1'},
        {displayName: 'Ava Stone', status: 'active', uid: 'user-2'},
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([['user-1', 'done']]),
    })!;

  it('classifies greeting time windows by local hour', () => {
    expect(
      getHomeGreetingTimeWindow({
        now: new Date('2026-05-07T09:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('morning');
    expect(
      getHomeGreetingTimeWindow({
        now: new Date('2026-05-07T12:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('midday');
    expect(
      getHomeGreetingTimeWindow({
        now: new Date('2026-05-07T16:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('afternoon');
    expect(
      getHomeGreetingTimeWindow({
        now: new Date('2026-05-07T22:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('evening');
  });

  it('uses short time-based copy with the first name', () => {
    const circles = [makeActiveCard()];

    expect(
      getHomeGreetingFallback({
        circles,
        firstName: 'Aaron North',
        now: new Date('2026-05-07T09:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('Aaron, morning. New day, same Commitment, fewer excuses.');
    expect(
      getHomeGreetingFallback({
        circles,
        firstName: 'Aaron North',
        now: new Date('2026-05-07T12:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('Aaron, midday check. Winning, or just looking busy?');
    expect(
      getHomeGreetingFallback({
        circles,
        firstName: 'Aaron North',
        now: new Date('2026-05-07T16:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('Aaron, afternoon test. Finish strong so tonight feels earned.');
    expect(
      getHomeGreetingFallback({
        circles,
        firstName: 'Aaron North',
        now: new Date('2026-05-07T22:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('Aaron, last lap. Make the day look planned.');
  });

  it('handles missing names without inventing one', () => {
    expect(
      getHomeGreetingFallback({
        circles: [makeActiveCard()],
        now: new Date('2026-05-07T12:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe('Midday check. Winning, or just looking busy?');
  });

  it('prioritizes zero-circle, needs-you, at-risk, done, and pending states', () => {
    const needsYouCard = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-needs-you',
      membersData: [
        {displayName: 'Kelvin North', status: 'active', uid: 'user-1'},
        {displayName: 'Ava Stone', status: 'active', uid: 'user-2'},
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([['user-2', 'done']]),
    })!;
    const atRiskCard = {
      ...makeActiveCard(),
      state: 'risk' as const,
      viewerHasCheckedIn: true,
    };
    const doneCard = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-done',
      membersData: [
        {displayName: 'Kelvin North', status: 'active', uid: 'user-1'},
        {displayName: 'Ava Stone', status: 'active', uid: 'user-2'},
      ],
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'active',
        uid: 'user-1',
      },
      todayCheckInStatuses: new Map([
        ['user-1', 'done'],
        ['user-2', 'done'],
      ]),
    })!;
    const pendingCard = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-pending',
      membershipData: {
        displayName: 'Kelvin North',
        role: 'member',
        status: 'pending',
        uid: 'user-1',
      },
    })!;

    expect(
      getHomeGreetingFallback({
        circles: [],
        firstName: 'Aaron',
        timezone: 'UTC',
      }),
    ).toBe('Aaron, no circles yet. Bold strategy, let us fix it.');
    expect(
      getHomeGreetingFallback({
        circles: [needsYouCard],
        firstName: 'Aaron',
        timezone: 'UTC',
      }),
    ).toBe('Aaron, your circles are waiting. Make it quick and undeniable.');
    expect(
      getHomeGreetingFallback({
        circles: [atRiskCard],
        firstName: 'Aaron',
        timezone: 'UTC',
      }),
    ).toBe('Aaron, pressure is up. Perfect, now it counts.');
    expect(
      getHomeGreetingFallback({
        circles: [doneCard],
        firstName: 'Aaron',
        timezone: 'UTC',
      }),
    ).toBe('Aaron, all checked in. Try not to act surprised.');
    expect(
      getHomeGreetingFallback({
        circles: [pendingCard],
        firstName: 'Aaron',
        timezone: 'UTC',
      }),
    ).toBe('Aaron, pending approval. Patience, but make it productive.');
  });

  it('builds a minimal Gemini-safe context from circle state', () => {
    const context = getHomeGreetingContext({
      circles: [makeActiveCard()],
      firstName: 'Aaron North',
      now: new Date('2026-05-07T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(context).toEqual({
      circleSummary: {
        atRiskCount: 0,
        circleCount: 1,
        doneCount: 0,
        needsYouCount: 0,
        pendingCount: 0,
      },
      firstName: 'Aaron',
      timeWindow: 'midday',
    });
  });
});
