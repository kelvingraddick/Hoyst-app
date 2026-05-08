jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {
  buildHomeDataFromCircles,
  createEmptyHomeData,
  getHomeFilterCounts,
  mapHomeCircleFromData,
  matchesHomeCircleFilter,
  shouldShowHomeCreateCircleButton,
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
    const card = mapHomeCircleFromData({
      circleData,
      circleId: 'circle-1',
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
      todayCheckInUids: new Set(['user-1']),
    });

    expect(card).toMatchObject({
      id: 'circle-1',
      progressPercent: 50,
      remainingCheckIns: 1,
      state: 'active',
      title: 'Real Fitness Circle',
      viewerHasCheckedIn: true,
      viewerMembershipStatus: 'active',
      viewerRole: 'owner',
    });
    expect(card?.members).toEqual([
      expect.objectContaining({id: 'user-1', initials: 'KN', state: 'done'}),
      expect.objectContaining({id: 'user-2', initials: 'AS', state: 'pending'}),
    ]);
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
    expect(homeData.hasRealProgress).toBe(false);
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
});
