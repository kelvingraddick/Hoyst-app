import React from 'react';
import {Alert, Share, StyleSheet, Text} from 'react-native';
import {nudgeCircleMembers} from '../src/features/circles/services/circle-service';
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
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
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
  function needsTapInToday(candidate: CircleManagementCard) {
    return (
      candidate.viewerMembershipStatus === 'active' &&
      (!candidate.viewerHasTappedInToday ||
        candidate.viewerTodayStatus === 'partial' ||
        candidate.viewerTodayStatus === 'failed')
    );
  }

  function urgencyRank(candidate: CircleManagementCard) {
    if (candidate.viewerMembershipStatus === 'pending') {
      return 6;
    }

    const needsViewer = needsTapInToday(candidate);
    const isAtRisk = candidate.state === 'risk';
    const hasPendingToday =
      candidate.state !== 'done' && candidate.remainingCheckIns > 0;

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
    if (candidate.state === 'done') {
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
    cycleCoveredCount: 0,
    cycleRequiredCount: 2,
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
    hasResolvedGreetingContext: true,
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

  it('renders a compact hero, divided due-card stack and visible utilities', () => {
    mockHomeData = homeData([
      circle({
        category: 'Deep Work',
        commitment: 'One task a day to help build the Hoyst app.',
        completionRate: 20,
        cycleCoveredCount: 1,
        cycleRequiredCount: 3,
        id: 'building-hoyst',
        maxSize: 10,
        memberCount: 3,
        members: [
          member({
            cycleGoalMet: true,
            id: 'member-1',
            initials: 'KM',
            state: 'done',
          }),
          member({
            cycleGoalMet: false,
            id: 'member-2',
            initials: 'MJ',
            state: 'pending',
          }),
          member({
            cycleGoalMet: false,
            id: 'member-3',
            initials: 'AJ',
            state: 'pending',
          }),
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
        commitmentCadence: 'weekly',
        cycleCoveredCount: 2,
        cycleRequiredCount: 4,
        id: 'sleep-8-hours',
        members: [
          member({cycleGoalMet: true, id: 'sleeper-1', state: 'done'}),
          member({cycleGoalMet: false, id: 'sleeper-2', state: 'pending'}),
        ],
        progressLabel: 'Week · 62%',
        progressPercent: 62,
        remainingCheckIns: 4,
        title: 'Sleep 8 Hours',
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 1,
      }),
      circle({
        circleMode: 'personal',
        cycleCoveredCount: 1,
        cycleRequiredCount: 1,
        id: 'hydration',
        members: [member({cycleGoalMet: true, id: 'hydration', state: 'done'})],
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
    expect(
      tree.root.findByProps({testID: 'tap-in-picker-logo'}).props.size,
    ).toBe(52);
    expect(output).not.toContain('DO THIS FIRST');
    expect(output).not.toContain('AT RISK');
    expect(output).toContain('Building Hoyst');
    expect(output).toContain('Streak at risk');
    expect(output).toContain('1/3 members met goal today');
    expect(output).not.toContain('2 due');
    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('1/2 members met goal this week');
    expect(
      tree.root.findByProps({testID: 'tap-in-picker-due-stack'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({
        testID: 'tap-in-priority-card-building-hoyst',
      }).props.style,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderBottomWidth: expect.any(Number),
        }),
      ]),
    );
    expect(output).toContain('Also today');
    expect(output).toContain('Hydration');
    expect(output).toContain('Goal met today');
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

  it('shows personal commitments without Member or Circle activity metadata', () => {
    mockHomeData = homeData([
      circle({
        circleMode: 'personal',
        commitment: 'Read every day',
        cycleCoveredCount: 0,
        cycleRequiredCount: 1,
        id: 'personal-1',
        inviteUrl: undefined,
        joinMode: 'invite_only',
        maxSize: 1,
        memberCount: 1,
        members: [
          member({cycleGoalMet: false, id: 'reader', state: 'pending'}),
        ],
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
    expect(output).toContain('Goal not met today');
    expect(output).not.toContain('1/1 Members');
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

    expect(output).toContain('Build Partial');
    expect(output).toContain('Goal: 5 pages');
    expect(output).toContain('Progress saved · 2 pages remaining');
    expect(output).toContain('Allowed range · 2 to 6 servings');
    expect(output).toContain('8 servings logged · Above range');
    expect(output).toContain('Update Tap In');
    expect(output).toContain('Limit Failed');
    expect(output).toContain('Also today');
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

  it('combines weekly cadence and per-Tap-In quantity in the goal line', () => {
    mockHomeData = homeData([
      circle({
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'build',
        targetValue: 20,
        unitLabel: 'minutes',
      }),
    ]);

    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());
    const goal = tree.root.findByProps({
      testID: 'tap-in-picker-goal-circle-1',
    });

    expect(output).toContain(
      'Goal: 4 Tap Ins per week · 20 minutes per Tap In',
    );
    expect(
      goal
        .findAllByType(Text)
        .map(node => StyleSheet.flatten(node.props.style).fontWeight),
    ).toEqual(['600', '600', '600']);
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
  });

  it('keeps Share, View and dismissal wired to their existing destinations', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({action: Share.sharedAction});
    mockHomeData = homeData([
      circle({id: 'share', viewerHasTappedInToday: true}),
      circle({id: 'view', inviteUrl: undefined, viewerHasTappedInToday: true}),
    ]);
    const {tree, navigation} = renderScreen();
    await act(async () =>
      tree.root
        .findByProps({testID: 'tap-in-picker-utility-share'})
        .props.onPress(),
    );
    expect(share).toHaveBeenCalledWith({
      title: 'Join Morning Movers on Hoyst',
      message: 'Join Morning Movers on Hoyst: https://example.com/invite',
      url: 'https://example.com/invite',
    });
    act(() =>
      tree.root
        .findByProps({testID: 'tap-in-picker-utility-view'})
        .props.onPress(),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'view',
    });
    act(() =>
      tree.root.findByProps({label: 'Close Tap In picker'}).props.onPress(),
    );
    expect(navigation.goBack).toHaveBeenCalled();
    share.mockRestore();
  });

  it('prevents duplicate pending nudges, disables sent nudges and allows retry after failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let reject!: (error: Error) => void;
    jest.mocked(nudgeCircleMembers).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    mockHomeData = homeData([
      circle({id: 'nudge', nudgeTargetCount: 2, viewerHasTappedInToday: true}),
    ]);
    const {tree} = renderScreen();
    const getAction = () =>
      tree.root.findByProps({testID: 'tap-in-picker-utility-nudge'});
    act(() => {
      getAction().props.onPress();
      getAction().props.onPress();
    });
    expect(nudgeCircleMembers).toHaveBeenCalledTimes(1);
    expect(getAction().props.busy).toBe(true);
    await act(async () => reject(new Error('Try again')));
    expect(getAction().props.busy).toBe(false);
    expect(alert).toHaveBeenCalledWith('Nudge failed', 'Try again');
    jest.mocked(nudgeCircleMembers).mockResolvedValueOnce({nudged: 2} as never);
    await act(async () => getAction().props.onPress());
    expect(getAction().props.disabled).toBe(true);
    expect(getAction().props.label).toBe('Nudged');
    alert.mockRestore();
  });

  it.each([
    {
      minimumValue: undefined,
      maximumValue: 2,
      currentValue: 3,
      expected: 'Above limit',
    },
    {
      minimumValue: 2,
      maximumValue: 6,
      currentValue: 1,
      expected: 'Below range',
    },
  ])(
    'keeps failed Limit feedback separate from its description and goal: %p',
    data => {
      mockHomeData = homeData([
        circle({
          commitmentType: 'limit',
          unitLabel: 'hours',
          viewerHasTappedInToday: true,
          viewerCanUpdateTapIn: true,
          viewerTodayStatus: 'failed',
          ...data,
        }),
      ]);
      const {tree} = renderScreen();
      const output = getTextOutput(tree.toJSON());
      expect(output).toContain(data.expected);
      const goal = tree.root.findByProps({
        testID: 'tap-in-picker-goal-circle-1',
      });
      const descriptionGroup = goal.parent!;
      expect(
        getTextOutput(
          descriptionGroup
            .findAllByType(require('react-native').Text)
            .map(text => text.props.children),
        ),
      ).toContain('Move for 30 minutes');
      expect(output).not.toContain('Goal covered');
    },
  );

  it('does not claim Limit compliance before a value is logged or resolved', () => {
    for (const viewerHasTappedInToday of [false, true]) {
      mockHomeData = homeData([
        circle({
          commitmentType: 'limit',
          maximumValue: 0,
          unitLabel: 'servings',
          viewerHasTappedInToday,
          viewerTodayStatus: 'partial',
          currentValue: undefined,
        }),
      ]);
      const {tree} = renderScreen();
      const output = getTextOutput(tree.toJSON());
      expect(output).toContain('Maximum · 0 servings');
      expect(output).not.toContain('Within limit');
      expect(output).not.toContain('Above limit');
    }
  });

  it('keeps skipped-day utility feedback and excludes pending memberships', () => {
    mockHomeData = homeData([
      circle({
        cycleCoveredCount: 1,
        cycleRequiredCount: 2,
        id: 'skipped',
        members: [
          member({
            cycleGoalMet: true,
            id: 'skipped-viewer',
            state: 'skipped',
            todayStatus: 'skip',
          }),
          member({
            cycleGoalMet: false,
            id: 'skipped-peer',
            state: 'pending',
          }),
        ],
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'skip',
      }),
      circle({
        id: 'pending',
        title: 'Pending circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const {tree} = renderScreen();
    const output = getTextOutput(tree.toJSON());
    expect(output).toContain('Grace skip used today');
    expect(output).toContain('1/2 members met goal today');
    expect(output).not.toContain('Pending circle');
    expect(output).toContain('1 of 1 tapped in');
    expect(
      tree.root.findByProps({testID: 'tap-in-picker-utility-skipped'}),
    ).toBeTruthy();
  });

  it.each([
    ['weekly', 'Weekly goal met'],
    ['monthly', 'Monthly goal met'],
  ] as const)(
    'shows %s goal completion separately from today',
    (pace, copy) => {
      mockHomeData = homeData([
        circle({
          commitmentCadence: pace,
          commitmentFrequency:
            pace === 'monthly'
              ? {opportunitiesPerPeriod: 4, tapInsPerWeek: 1}
              : {tapInsPerWeek: 3},
          id: `${pace}-complete`,
          members: [
            member({
              cycleGoalMet: true,
              id: `${pace}-member`,
              state: 'done',
            }),
          ],
          title: `${pace} complete`,
          cycleCoveredCount: pace === 'monthly' ? 4 : 3,
          cycleRequiredCount: pace === 'monthly' ? 4 : 3,
          viewerCycleCoveredCount: pace === 'monthly' ? 4 : 3,
          viewerCycleRequiredCount: pace === 'monthly' ? 4 : 3,
          viewerHasTappedInToday: false,
        }),
      ]);

      const {tree} = renderScreen();
      const output = getTextOutput(tree.toJSON());

      expect(output).toContain(copy);
      expect(output).toContain(
        pace === 'monthly'
          ? '1/1 member met goal this month'
          : '1/1 member met goal this week',
      );
      expect(output).toContain('Today is covered');
    },
  );

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
