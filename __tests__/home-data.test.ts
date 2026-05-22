jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {
  buildHomeDataFromCircles,
  createEmptyHomeData,
  getHomeFilterCounts,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomeGreetingTimeWindow,
  getHomePersonalProgressState,
  mapHomeCircleFromData,
  matchesHomeCircleFilter,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeCreateCircleButton,
  shouldShowHomeDataErrorPanel,
} from '../src/features/home/services/home-data-service';

const circleData = {
  category: 'Fitness',
  dailyTask: '30min workout',
  joinMode: 'invite_only',
  maxSize: 4,
  memberCount: 2,
  privacy: 'private',
  title: 'Real Fitness Circle',
};

describe('home data mapping', () => {
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
      id: 'circle-1',
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
      graceRules: {
        skip: {
          allowance: 1,
          windowDays: 7,
        },
      },
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
      progressPercent: 50,
      remainingCheckIns: 1,
      state: 'active',
      streakLabel: 'Start today',
      viewerHasCheckedIn: false,
      viewerTodayStatus: undefined,
    });
    expect(matchesHomeCircleFilter(card!, 'needsYou')).toBe(true);
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
    expect(homeData.progressDays.every(day => day.state !== 'done')).toBe(true);
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

  it('builds signed-out and incomplete personal progress states', () => {
    const homeData = createEmptyHomeData(
      'UTC',
      new Date('2026-05-07T12:00:00.000Z'),
    );

    expect(
      getHomePersonalProgressState({
        homeData,
        isAuthenticatedHome: false,
        isIncompleteProfile: false,
      }),
    ).toMatchObject({
      action: 'auth',
      icon: 'start',
      label: 'Start making progress',
      tone: 'accent',
    });

    expect(
      getHomePersonalProgressState({
        homeData,
        isAuthenticatedHome: false,
        isIncompleteProfile: true,
      }),
    ).toMatchObject({
      action: 'finishProfile',
      icon: 'profile',
      label: 'Complete your profile',
      tone: 'warning',
    });
  });

  it('builds the no-progress personal progress state for authenticated Home', () => {
    const homeData = createEmptyHomeData(
      'UTC',
      new Date('2026-05-07T12:00:00.000Z'),
    );

    expect(
      getHomePersonalProgressState({
        homeData,
        isAuthenticatedHome: true,
        isIncompleteProfile: false,
      }),
    ).toMatchObject({
      action: 'chooseProgressStart',
      icon: 'start',
      label: 'No progress yet',
      tone: 'accent',
    });
  });

  it('builds the profile personal progress state when progress is active', () => {
    const card = mapHomeCircleFromData({
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
    const homeData = buildHomeDataFromCircles({
      circles: [card],
      completedDateKeys: new Set(['2026-05-06']),
      now: new Date('2026-05-07T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(
      getHomePersonalProgressState({
        homeData,
        isAuthenticatedHome: true,
        isIncompleteProfile: false,
      }),
    ).toMatchObject({
      action: 'profile',
      icon: 'progress',
      label: '1-day streak',
      tone: 'neutral',
    });
  });

  it('builds the share personal progress state when today is complete', () => {
    const card = mapHomeCircleFromData({
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
    const homeData = buildHomeDataFromCircles({
      circles: [card],
      completedDateKeys: new Set(['2026-05-07', '2026-05-06']),
      now: new Date('2026-05-07T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(
      getHomePersonalProgressState({
        homeData,
        isAuthenticatedHome: true,
        isIncompleteProfile: false,
      }),
    ).toMatchObject({
      action: 'shareProgress',
      icon: 'share',
      label: 'All tapped in today',
      tone: 'success',
    });
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
    ).toBe('Aaron, morning. New day, same goals, fewer excuses.');
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
