import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {TapInPickerScreen} from '../src/features/check-in/screens/TapInPickerScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import type {CircleManagementCard} from '../src/types/models';

let mockHomeData: HomeData;
let mockSubscriptionMode: 'data' | 'error' | 'loading' = 'data';

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

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
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

jest.mock('../src/features/home/services/home-data-service', () => {
  function needsTapInToday(circle: CircleManagementCard) {
    return (
      circle.viewerMembershipStatus === 'active' &&
      (!circle.viewerHasTappedInToday ||
        circle.viewerTodayStatus === 'partial' ||
        circle.viewerTodayStatus === 'failed')
    );
  }

  function urgencyRank(circle: CircleManagementCard) {
    if (circle.viewerMembershipStatus === 'pending') {
      return 6;
    }

    const needsViewer = needsTapInToday(circle);
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

  return {
    canTapInToday: jest.fn(needsTapInToday),
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
    sortHomeCircles: jest.fn((circles: CircleManagementCard[]) =>
      [...circles].sort((left, right) => {
        const rankDelta = urgencyRank(left) - urgencyRank(right);

        if (rankDelta !== 0) {
          return rankDelta;
        }

        const progressDelta = left.progressPercent - right.progressPercent;

        if (progressDelta !== 0) {
          return progressDelta;
        }

        return left.title.localeCompare(right.title);
      }),
    ),
    subscribeToHomeData: jest.fn(({onData, onError}) => {
      if (mockSubscriptionMode === 'error') {
        onError();
      }

      if (mockSubscriptionMode === 'data') {
        onData(mockHomeData);
      }

      return jest.fn();
    }),
  };
});

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
    completionRate: 100,
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 2,
    members: [],
    privacy: 'public',
    progressLabel: 'Today · 100%',
    progressPercent: 100,
    remainingCheckIns: 0,
    state: 'done',
    streakDays: 4,
    streakLabel: 'Already tapped in',
    timezone: 'UTC',
    title: 'Morning Movers',
    viewerHasCheckedIn: true,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 0,
    viewerRole: 'member',
    viewerTodayStatus: undefined,
    ...overrides,
  };
}

function member(
  overrides: Partial<CircleManagementCard['members'][number]> = {},
): CircleManagementCard['members'][number] {
  return {
    id: 'member-1',
    initials: 'KM',
    name: 'Kelvin Miles',
    state: 'done',
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
    goBack: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <TapInPickerScreen
        navigation={navigation as never}
        route={{key: 'TapInPicker', name: 'TapInPicker'} as never}
      />,
    );
  });

  return {navigation, tree: tree!};
}

function getTextOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(getTextOutput).join('');
  }

  if (value && typeof value === 'object' && 'children' in value) {
    return getTextOutput((value as {children?: unknown}).children);
  }

  return '';
}

describe('TapInPickerScreen', () => {
  beforeEach(() => {
    mockHomeData = homeData([]);
    mockSubscriptionMode = 'data';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the refreshed hero, priority section, and remaining Tap Today cards', () => {
    mockHomeData = homeData([
      circle({
        category: 'Deep Work',
        commitment: 'One task a day to help build the Hoyst app.',
        completionRate: 20,
        id: 'building-hoyst',
        maxSize: 10,
        memberCount: 3,
        members: [
          member({id: 'member-1', initials: 'KM', state: 'done'}),
          member({id: 'member-2', initials: 'MJ', state: 'pending'}),
        ],
        progressLabel: 'Today · 20%',
        progressPercent: 20,
        remainingCheckIns: 7,
        state: 'risk',
        title: 'Building Hoyst',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
      circle({
        category: 'Wellness',
        commitment: 'Sleep a full 8 hours in a day',
        completionRate: 62,
        id: 'sleep-8-hours',
        progressLabel: 'Week · 62%',
        progressPercent: 62,
        remainingCheckIns: 4,
        title: 'Sleep 8 Hours',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
      circle({
        id: 'hydration',
        progressLabel: 'Today · 100%',
        title: 'Hydration',
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    ]);

    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());

    expect(tree.root.findByProps({testID: 'tap-in-picker-logo'}).type).toBe(
      HoystTapInMark,
    );
    expect(output).toContain('1 of 3 tapped in');
    expect(output).toContain('2 TAP TODAY');
    expect(output).toContain('1 AT RISK');
    expect(output).toContain('1 COVERED');
    expect(output).toContain('DO THIS FIRST');
    expect(output).toContain('Building Hoyst');
    expect(output).toContain('TAP TODAY');
    expect(output).not.toContain('2 due');
    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('STILL USEFUL TODAY');
    expect(output).toContain('Hydration');
  });

  it('opens the composer from the most urgent priority card', () => {
    mockHomeData = homeData([
      circle({
        id: 'less-urgent',
        progressPercent: 80,
        title: 'Less Urgent',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
      circle({
        id: 'most-urgent',
        progressPercent: 18,
        state: 'risk',
        title: 'Most Urgent',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
    ]);

    const {navigation, tree} = renderScreen();
    const priorityButton = tree.root.findByProps({
      testID: 'tap-in-picker-priority-action-most-urgent',
    });

    act(() => {
      priorityButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'most-urgent',
      source: 'tap_in',
    });
  });

  it('shows personal commitments without member or companion metadata', () => {
    mockHomeData = homeData([
      circle({
        circleMode: 'personal',
        commitment: 'Read every day',
        id: 'personal-1',
        inviteUrl: undefined,
        joinMode: 'invite_only',
        maxSize: 1,
        memberCount: 1,
        privacy: 'private',
        progressPercent: 20,
        state: 'risk',
        title: 'Read every day',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
    ]);

    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());

    expect(output).toContain('Read every day');
    expect(output).toContain('Personal');
    expect(output).toContain('Private personal commitment');
    expect(output).not.toContain('1/1 members');
  });

  it('opens the composer from a remaining Tap Today card', () => {
    mockHomeData = homeData([
      circle({
        id: 'priority-circle',
        progressPercent: 18,
        state: 'risk',
        title: 'Priority Circle',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
      circle({
        id: 'remaining-due',
        progressPercent: 76,
        title: 'Remaining Due',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
    ]);

    const {navigation, tree} = renderScreen();
    const tapInTodayButton = tree.root.findByProps({
      testID: 'tap-in-picker-due-action-remaining-due',
    });

    act(() => {
      tapInTodayButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'remaining-due',
      source: 'tap_in',
    });
  });

  it('keeps covered quantity circles out of Tap Today while partial and failed stay due', () => {
    mockHomeData = homeData([
      circle({
        commitmentType: 'build',
        currentValue: 3,
        id: 'build-partial',
        progressPercent: 45,
        state: 'active',
        targetValue: 5,
        title: 'Build Partial',
        unitLabel: 'pages',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 1,
        viewerTodayStatus: 'partial',
      }),
      circle({
        commitmentType: 'build',
        currentValue: 5,
        id: 'build-covered',
        state: 'done',
        targetValue: 5,
        title: 'Build Covered',
        unitLabel: 'pages',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: true,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 0,
        viewerTodayStatus: 'done',
      }),
      circle({
        commitmentType: 'limit',
        currentValue: 8,
        id: 'limit-failed',
        maximumValue: 6,
        minimumValue: 2,
        progressPercent: 40,
        state: 'active',
        title: 'Limit Failed',
        unitLabel: 'servings',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 1,
        viewerTodayStatus: 'failed',
      }),
      circle({
        commitmentType: 'limit',
        currentValue: 4,
        id: 'limit-covered',
        maximumValue: 6,
        minimumValue: 2,
        state: 'done',
        title: 'Limit Covered',
        unitLabel: 'servings',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: true,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 0,
        viewerTodayStatus: 'done',
      }),
    ]);

    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());

    expect(output).toContain('2 TAP TODAY');
    expect(output).toContain('Build Partial');
    expect(output).toContain('Limit Failed');
    expect(output).toContain('STILL USEFUL TODAY');
    expect(output).toContain('Build Covered');
    expect(output).toContain('Limit Covered');
    expect(
      tree.root.findAllByProps({
        testID: 'tap-in-picker-due-action-build-covered',
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({
        testID: 'tap-in-picker-due-action-limit-covered',
      }),
    ).toHaveLength(0);
  });

  it('keeps the Still Useful empty state when no secondary circles remain', () => {
    mockHomeData = homeData([
      circle({
        id: 'only-due',
        progressPercent: 45,
        title: 'Only Due',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
    ]);

    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());

    expect(output).toContain('Nothing else needs you');
    expect(output).toContain('0 active');
  });

  it('renders loading, error, no-active, and all-covered states', () => {
    mockSubscriptionMode = 'loading';
    let rendered = renderScreen();
    expect(getTextOutput(rendered.tree.toJSON())).toContain(
      'Loading your commitments',
    );

    mockSubscriptionMode = 'error';
    rendered = renderScreen();
    expect(getTextOutput(rendered.tree.toJSON())).toContain(
      'Could not load Tap In',
    );

    mockSubscriptionMode = 'data';
    mockHomeData = homeData([]);
    rendered = renderScreen();
    expect(getTextOutput(rendered.tree.toJSON())).toContain(
      'No active commitments yet',
    );

    mockHomeData = homeData([
      circle({
        id: 'covered',
        title: 'Covered Circle',
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    ]);
    rendered = renderScreen();
    expect(getTextOutput(rendered.tree.toJSON())).toContain('Today is covered');
  });
});
