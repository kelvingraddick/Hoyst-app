import React from 'react';
import {TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {UsersRound} from 'lucide-react-native';

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

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

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
    getHomeCircleActionVariant: jest.fn((circle: CircleManagementCard) => {
      if (circle.viewerMembershipStatus === 'pending') {
        return 'view';
      }

      if (!circle.viewerHasCheckedIn && !circle.viewerHasTappedInToday) {
        return 'check_in';
      }

      if ((circle.nudgeTargetCount ?? 0) > 0) {
        return 'nudge';
      }

      if (
        circle.inviteUrl &&
        (circle.viewerRole === 'owner' || circle.viewerRole === 'admin')
      ) {
        return 'share';
      }

      return 'view';
    }),
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

jest.mock('../src/features/circles/services/circle-service', () => ({
  nudgeCircleMembers: jest.fn(),
}));

function circle(
  overrides: Partial<CircleManagementCard>,
): CircleManagementCard {
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

function renderScreenTree() {
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

  return screen!;
}

function renderScreen() {
  return JSON.stringify(renderScreenTree().toJSON());
}

describe('CirclesScreen render paths', () => {
  beforeEach(() => {
    mockPublicCircles = [publicCircle({})];
  });

  it('renders management first and discovery later when an active circle exists', () => {
    mockHomeData = homeData([circle({})]);
    const output = renderScreen();

    expect(output).toContain('Overview');
    expect(output).toContain('Needs You');
    expect(output).not.toContain('Needs Tap');
    expect(output).toContain('#A83A00');
    expect(output).toContain('#FFF0E6');
    expect(output).toContain('Pending');
    expect(output).toContain('#7A5C00');
    expect(output).toContain('#FFF8EA');
    expect(output).toContain('On Track');
    expect(output).toContain('#086CA8');
    expect(output).toContain('#E7F8FF');
    expect(output).toContain('Done');
    expect(output).toContain('#07763E');
    expect(output).toContain('#E7F8EF');
    expect(output).not.toContain('Completed Today');
    expect(output).not.toContain('Your attention');
    expect(output).not.toContain('Approval');
    expect(output).not.toContain('Keep it going');
    expect(output).not.toContain('Nice work!');
    expect(output).toContain('Need Attention');
    expect(output).toContain('All Circles');
    expect(output).not.toContain('Companion Updates');
    expect(output).toContain('Discover Circles');
    expect(output).toContain('View Circle');
    expect(output.indexOf('Overview')).toBeLessThan(
      output.indexOf('Discover Circles'),
    );
  });

  it('renders discovery first when there are no joined active circles', () => {
    mockHomeData = homeData([]);
    const output = renderScreen();

    expect(output).toContain('Find Circles or start your own');
    expect(output).toContain('Start your own');
    expect(output).toContain('Private rhythms start here');
    expect(output).toContain('Create Circle');
    expect(output).toContain('Discover Circles');
    expect(output).toContain('Public Movers');
    expect(output).toContain('View Circle');
    expect(output).toContain('All Circles');
    expect(output).not.toContain('Companion Updates');
    expect(output.indexOf('Discover Circles')).toBeLessThan(
      output.indexOf('All Circles'),
    );
  });

  it('uses category color for discover card member icons', () => {
    mockHomeData = homeData([]);
    const tree = renderScreenTree();

    expect(
      tree.root
        .findAllByType(UsersRound)
        .some(icon => icon.props.color === '#07763E'),
    ).toBe(true);
  });

  it('renders a Today-style no-results discovery card', () => {
    mockHomeData = homeData([]);
    const tree = renderScreenTree();

    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('nope');
    });

    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('No Circles found');
    expect(output).toContain('No matches');
    expect(output).toContain('Filters active');
    expect(output).toContain(
      'Clearing filters brings every public Circle back into view.',
    );
    expect(output).toContain('Clear filters');
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
