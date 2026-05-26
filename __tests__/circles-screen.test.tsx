import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {CirclesScreen} from '../src/features/circles/screens/CirclesScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import type {CircleManagementCard, ExploreCircle} from '../src/types/models';

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      status: 'authenticatedReady';
      user: {providerIds: string[]; uid: string};
    }) => unknown,
  ) =>
    selector({
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    }),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
}));

let mockHomeData: HomeData;
let mockPublicCircles: ExploreCircle[];
let mockInboxEvents: unknown[];

jest.mock('../src/features/home/services/home-data-service', () => {
  return {
    createEmptyHomeData: jest.fn(() => ({
      circles: [],
      hasLoadedMemberships: false,
      hasRealProgress: false,
      membershipCount: 0,
      personalStreakDays: 0,
      progressDays: [],
      progressPercent: 0,
      todayDateKey: '2026-05-26',
      todayLabel: 'Today',
    })),
    sortHomeCircles: jest.fn((circles: CircleManagementCard[]) => circles),
    subscribeToHomeData: jest.fn(({onData}) => {
      onData(mockHomeData);
      return jest.fn();
    }),
  };
});

jest.mock('../src/features/circles/services/public-circle-service', () => ({
  subscribeToPublicCircles: jest.fn(onCircles => {
    onCircles(mockPublicCircles);
    return jest.fn();
  }),
}));

jest.mock(
  '../src/features/settings/services/notification-settings-service',
  () => ({
    markInboxEventRead: jest.fn(),
    subscribeToInboxEvents: jest.fn(({onEvents}) => {
      onEvents(mockInboxEvents);
      return jest.fn();
    }),
  }),
);

jest.mock('../src/features/circles/services/circle-service', () => ({
  nudgeCircleMembers: jest.fn(),
}));

function circle(overrides: Partial<CircleManagementCard>): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 72,
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 2,
    members: [],
    privacy: 'public',
    progressPercent: 72,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 4,
    streakLabel: 'Start today',
    title: 'Morning Movers',
    viewerHasCheckedIn: false,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

function publicCircle(overrides: Partial<ExploreCircle>): ExploreCircle {
  return {
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 86,
    id: 'public-1',
    joinLabel: 'Open seats',
    matchCopy: 'A steady group for showing up.',
    maxSize: 8,
    memberCount: 4,
    members: [],
    streakLabel: 'Daily rhythm',
    title: 'Public Movers',
    ...overrides,
  };
}

function homeData(circles: CircleManagementCard[]): HomeData {
  return {
    circles,
    hasLoadedMemberships: true,
    hasRealProgress: circles.length > 0,
    membershipCount: circles.length,
    personalStreakDays: 0,
    progressDays: [],
    progressPercent: 0,
    todayDateKey: '2026-05-26',
    todayLabel: 'Today',
  };
}

function renderScreen() {
  const navigation = {
    getParent: () => ({
      navigate: jest.fn(),
    }),
  };
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(
      <CirclesScreen navigation={navigation as never} route={{} as never} />,
    );
  });

  return JSON.stringify(screen?.toJSON());
}

describe('CirclesScreen render paths', () => {
  beforeEach(() => {
    mockPublicCircles = [publicCircle({})];
    mockInboxEvents = [];
  });

  it('renders management first and discovery later when an active circle exists', () => {
    mockHomeData = homeData([circle({})]);
    const output = renderScreen();

    expect(output).toContain('Overview');
    expect(output).toContain('Needs Tap');
    expect(output).toContain('Your attention');
    expect(output).toContain('Pending');
    expect(output).toContain('Awaiting approval');
    expect(output).toContain('On Track');
    expect(output).toContain('Keep it going');
    expect(output).toContain('Completed Today');
    expect(output).toContain('Nice work!');
    expect(output).toContain('Need Attention');
    expect(output).toContain('All Circles');
    expect(output).toContain('Companion Updates');
    expect(output).toContain('Discover Circles');
    expect(output.indexOf('Overview')).toBeLessThan(
      output.indexOf('Discover Circles'),
    );
  });

  it('renders discovery first when there are no joined active circles', () => {
    mockHomeData = homeData([]);
    const output = renderScreen();

    expect(output).toContain('Find Circles or start your own');
    expect(output).toContain('Discover Circles');
    expect(output).toContain('Public Movers');
    expect(output).toContain('All Circles');
    expect(output.indexOf('Discover Circles')).toBeLessThan(
      output.indexOf('All Circles'),
    );
  });

  it('keeps discovery visible before pending-only circle management', () => {
    mockHomeData = homeData([
      circle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const output = renderScreen();

    expect(output).toContain('Discover Circles');
    expect(output).toContain('Pending Circle');
    expect(output.indexOf('Discover Circles')).toBeLessThan(
      output.indexOf('Pending Circle'),
    );
  });
});
