import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {TapInPickerScreen} from '../src/features/check-in/screens/TapInPickerScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import type {CircleManagementCard} from '../src/types/models';

let mockHomeData: HomeData;

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

jest.mock('../src/features/home/services/home-data-service', () => ({
  canTapInToday: jest.fn(
    (circle: CircleManagementCard) =>
      circle.viewerMembershipStatus === 'active' &&
      !circle.viewerHasTappedInToday,
  ),
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
  subscribeToHomeData: jest.fn(({onData}) => {
    onData(mockHomeData);
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
    completionRate: 100,
    id: 'circle-1',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 2,
    members: [],
    privacy: 'public',
    progressPercent: 100,
    remainingCheckIns: 0,
    state: 'done',
    streakDays: 4,
    streakLabel: 'Already tapped in',
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

describe('TapInPickerScreen', () => {
  beforeEach(() => {
    mockHomeData = homeData([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens the composer for a completed weekly commitment without today coverage', () => {
    mockHomeData = homeData([
      circle({
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 2},
        id: 'weekly-complete-new-day',
        title: 'Weekly Complete New Day',
      }),
    ]);

    const {navigation, tree} = renderScreen();
    const output = JSON.stringify(tree.toJSON());
    const tapInButton = tree.root
      .findAllByType(TapInPulseButton)
      .find(button => button.props.label === 'Tap In Today');

    expect(output).toContain('Tap Today');
    expect(output).toContain('Commitment complete');
    expect(tapInButton).toBeTruthy();

    act(() => {
      tapInButton?.props.onPress();
    });

    expect(navigation.replace).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'weekly-complete-new-day',
      source: 'tap_in',
    });
  });
});
