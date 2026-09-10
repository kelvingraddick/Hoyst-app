import React from 'react';
import {Share, StyleSheet, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CirclesScreen} from '../src/features/circles/screens/CirclesScreen';
import {DSCommitmentPreview} from '../src/design/system';
import type {HomeData} from '../src/features/home/services/home-data-service';
import type {PastCircleSummary} from '../src/features/circles/services/past-circle-service';
import type {CircleManagementCard} from '../src/types/models';
import {nudgeCircleMembers} from '../src/features/circles/services/circle-service';

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
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
let mockPastCircles: PastCircleSummary[] = [];
let mockHomeSubscriptionMode: 'data' | 'error' | 'silent' = 'data';
const renderedScreens: renderer.ReactTestRenderer[] = [];

jest.mock('../src/features/home/services/home-data-service', () => {
  function needsTapInToday(circle: CircleManagementCard) {
    return (
      circle.viewerMembershipStatus === 'active' &&
      (!circle.viewerHasTappedInToday ||
        circle.viewerTodayStatus === 'partial' ||
        circle.viewerTodayStatus === 'failed')
    );
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
    getHomeCircleActionVariant: jest.fn((circle: CircleManagementCard) => {
      if (circle.viewerMembershipStatus === 'pending') {
        return 'view';
      }

      if (needsTapInToday(circle)) {
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
    subscribeToHomeData: jest.fn(({onData, onError}) => {
      if (mockHomeSubscriptionMode === 'data') {
        onData(mockHomeData);
      } else if (mockHomeSubscriptionMode === 'error') {
        onError(new Error('offline'));
      }
      return jest.fn();
    }),
  };
});

jest.mock('../src/features/circles/services/circle-service', () => ({
  nudgeCircleMembers: jest.fn(),
}));

jest.mock('../src/features/circles/services/past-circle-service', () => ({
  subscribeToPastCircles: jest.fn(({onCircles}) => {
    onCircles(mockPastCircles);
    return jest.fn();
  }),
}));

function makeCircle(
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

function renderScreenWithNavigation() {
  const rootNavigate = jest.fn();
  const navigation = {
    goBack: jest.fn(),
    navigate: rootNavigate,
  };
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(
      <CirclesScreen navigation={navigation as never} route={{} as never} />,
    );
  });
  renderedScreens.push(screen!);

  return {rootNavigate, screen: screen!};
}

function renderScreenTree() {
  return renderScreenWithNavigation().screen;
}

function textContent(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(textContent).join('');
  }
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

function renderedText(screen: renderer.ReactTestRenderer) {
  return screen.root
    .findAllByType(Text)
    .map(node => textContent(node.props.children))
    .join('|');
}

function renderScreen() {
  return renderedText(renderScreenTree());
}

afterEach(() => {
  act(() => {
    renderedScreens.splice(0).forEach(screen => screen.unmount());
  });
});

describe('CirclesScreen render paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHomeSubscriptionMode = 'data';
    mockPastCircles = [];
  });

  it('renders the filterable management list when an active circle exists', () => {
    mockHomeData = homeData([makeCircle({})]);
    const output = renderScreen();

    expect(output).toContain('Your commitments');
    expect(output).toContain(
      'Personal commitments, active circles, and join requests.',
    );
    expect(output).toContain('Needs you');
    expect(output).toContain('Pending');
    expect(output).toContain('On track');
    expect(output).toContain('Done');
    expect(output).toContain('Morning Movers');
    expect(output).toContain('Sorted by urgency');
    expect(output).toContain('Find more circles');
    expect(output).toContain('Browse public circles in Explore');
    expect(output).not.toContain('Overview');
    expect(output).not.toContain('Need Attention');
    expect(output).not.toContain('All Circles');
    expect(output).not.toContain('Discover Circles');
  });

  it('renders personal commitments in the unified focused-card list', () => {
    mockHomeData = homeData([
      makeCircle({
        circleMode: 'personal',
        commitment: 'Read every day',
        id: 'personal-1',
        inviteUrl: undefined,
        joinMode: 'invite_only',
        maxSize: 1,
        memberCount: 1,
        privacy: 'private',
        title: 'Read every day',
      }),
      makeCircle({id: 'group-1'}),
    ]);
    const output = renderScreen();

    expect(output).toContain('Read every day');
    expect(output).toContain('Personal · Just you');
  });

  it('includes personal commitments in status counts and filters', () => {
    mockHomeData = homeData([
      makeCircle({
        circleMode: 'personal',
        id: 'personal-due',
        inviteUrl: undefined,
        memberCount: 1,
        title: 'Personal Due',
      }),
      makeCircle({
        id: 'group-done',
        state: 'done',
        title: 'Group Done',
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();
    const needsYou = screen.root.findByProps({
      accessibilityLabel: 'Needs you, 1',
    });

    act(() => needsYou.props.onPress());

    const filtered = renderedText(screen);
    expect(filtered).toContain('Personal Due');
    expect(filtered).not.toContain('Group Done');
  });

  it('renders Past Circles below active circles and opens a read-only summary', () => {
    mockHomeData = homeData([makeCircle({})]);
    mockPastCircles = [
      {
        category: 'Learning',
        circleId: 'past-1',
        circleMode: 'group',
        commitment: 'Read 20 pages',
        id: 'past-1',
        joinedAt: new Date('2026-01-01T12:00:00Z'),
        leftAt: new Date('2026-07-01T12:00:00Z'),
        privacy: 'private',
        title: 'Book Club',
      },
    ];

    const {rootNavigate, screen} = renderScreenWithNavigation();
    const pastCircleButton = screen.root.findByProps({
      accessibilityLabel: 'View past circle Book Club',
    });
    const output = renderedText(screen);

    expect(output).toContain('Past circles');
    expect(output.indexOf('Morning Movers')).toBeLessThan(
      output.indexOf('Past circles'),
    );

    act(() => {
      pastCircleButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('PastCircle', {
      summary: mockPastCircles[0],
    });
  });

  it('uses Home typography, one compact summary, and focused cards', () => {
    mockHomeData = homeData([makeCircle({})]);
    const {screen} = renderScreenWithNavigation();
    const headingStyles = screen.root
      .findAll(node => node.props.children === 'Your commitments')
      .map(node => StyleSheet.flatten(node.props.style));
    const subtitleStyles = screen.root
      .findAll(
        node =>
          node.props.children ===
          'Personal commitments, active circles, and join requests.',
      )
      .map(node => StyleSheet.flatten(node.props.style));
    const summaryStyles = screen.root
      .findAllByProps({testID: 'circles-status-summary'})
      .map(node => StyleSheet.flatten(node.props.style));
    const cards = screen.root.findAllByType(DSCommitmentPreview);
    const needsYouStyle = StyleSheet.flatten(
      screen.root.findByProps({accessibilityLabel: 'Needs you, 1'}).props.style,
    );

    expect(headingStyles).toContainEqual(
      expect.objectContaining({
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 23,
      }),
    );
    expect(subtitleStyles).toContainEqual(
      expect.objectContaining({
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    expect(
      summaryStyles.some(
        style =>
          style?.borderRadius === 14 &&
          style?.minHeight >= 56 &&
          style?.paddingHorizontal === 12 &&
          style?.paddingVertical === 12,
      ),
    ).toBe(true);
    expect(needsYouStyle).toMatchObject({
      flex: 1,
      minHeight: 44,
      minWidth: 0,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].props.expanded).toBe(true);
  });

  it('renders the empty state when there are no joined circles', () => {
    mockHomeData = homeData([]);
    const output = renderScreen();

    expect(output).toContain('Your commitments');
    expect(output).toContain('No commitments yet');
    expect(output).toContain('Find more circles');
    expect(output).toContain('Create commitment');
    expect(output).not.toContain('Need Attention');
    expect(output).not.toContain('All Circles');
    expect(output).not.toContain('Discover Circles');
  });

  it('shows neutral loading content before the first subscription result', () => {
    mockHomeSubscriptionMode = 'silent';
    mockHomeData = homeData([]);

    const output = renderScreen();

    expect(output).toContain('Loading commitments');
    expect(output).not.toContain('No commitments yet');
  });

  it('shows an initial error with a working retry action', () => {
    mockHomeSubscriptionMode = 'error';
    mockHomeData = homeData([]);
    const subscribeToHomeData = jest.requireMock(
      '../src/features/home/services/home-data-service',
    ).subscribeToHomeData as jest.Mock;
    const {screen} = renderScreenWithNavigation();

    expect(renderedText(screen)).toContain('Could not load commitments');
    act(() =>
      screen.root.findByProps({accessibilityLabel: 'Retry'}).props.onPress(),
    );
    expect(subscribeToHomeData).toHaveBeenCalledTimes(2);
  });

  it('opens Tap In for a completed weekly commitment without today coverage', () => {
    mockHomeData = homeData([
      makeCircle({
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 2},
        id: 'weekly-complete-new-day',
        progressPercent: 100,
        remainingCheckIns: 0,
        state: 'done',
        title: 'Weekly Complete New Day',
        viewerHasCheckedIn: true,
        viewerHasTappedInToday: false,
        viewerRemainingTapIns: 0,
        viewerTodayStatus: undefined,
      }),
    ]);

    const {rootNavigate, screen} = renderScreenWithNavigation();
    const tapInButton = screen.root.findByProps({
      accessibilityLabel: 'Tap In for Weekly Complete New Day',
    });

    act(() => {
      tapInButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'weekly-complete-new-day',
      source: 'tap_in',
    });
  });

  it('uses Update Tap In for partial or failed saved results', () => {
    mockHomeData = homeData([
      makeCircle({
        id: 'partial-circle',
        title: 'Partial Circle',
        viewerCanUpdateTapIn: true,
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'partial',
      }),
    ]);
    const {rootNavigate, screen} = renderScreenWithNavigation();

    act(() =>
      screen.root.findByProps({
        accessibilityLabel: 'Update Tap In for Partial Circle',
      }).props.onPress(),
    );

    expect(rootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'partial-circle',
      source: 'tap_in',
    });
  });

  it('disables the Nudge action while its request is pending', async () => {
    let resolveNudge!: (value: {nudged: number}) => void;
    (nudgeCircleMembers as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveNudge = resolve;
      }),
    );
    mockHomeData = homeData([
      makeCircle({
        id: 'nudge-circle',
        nudgeTargetCount: 2,
        title: 'Nudge Circle',
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();

    act(() =>
      screen.root.findByProps({accessibilityLabel: 'Nudge for Nudge Circle'})
        .props.onPress(),
    );

    const pendingButton = screen.root.findByProps({
      accessibilityLabel: 'Nudging for Nudge Circle',
    });
    expect(pendingButton.props.disabled).toBe(true);
    expect(nudgeCircleMembers).toHaveBeenCalledTimes(1);

    await act(async () => resolveNudge({nudged: 2}));
  });

  it('keeps native Share separate from card navigation', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.sharedAction,
    });
    mockHomeData = homeData([
      makeCircle({
        id: 'share-circle',
        nudgeTargetCount: 0,
        title: 'Share Circle',
        viewerHasTappedInToday: true,
        viewerRole: 'owner',
        viewerTodayStatus: 'done',
      }),
    ]);
    const {rootNavigate, screen} = renderScreenWithNavigation();

    await act(async () =>
      screen.root.findByProps({accessibilityLabel: 'Share for Share Circle'})
        .props.onPress(),
    );

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://example.com/invite'),
      }),
    );
    expect(rootNavigate).not.toHaveBeenCalled();
    share.mockRestore();
  });

  it('shows truthful pending and completed states without Tap In actions', () => {
    mockHomeData = homeData([
      makeCircle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
      makeCircle({
        id: 'done-circle',
        inviteUrl: undefined,
        state: 'done',
        title: 'Done Circle',
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();
    const output = renderedText(screen);

    expect(output).toContain('Pending approval');
    expect(output).toContain('Complete');
    expect(
      screen.root.findAllByProps({
        accessibilityLabel: 'Tap In for Pending Circle',
      }),
    ).toHaveLength(0);
    expect(
      screen.root.findAllByProps({
        accessibilityLabel: 'Tap In for Done Circle',
      }),
    ).toHaveLength(0);
  });

  it('excludes covered quantity circles from Needs You but keeps partial and failed due', () => {
    mockHomeData = homeData([
      makeCircle({
        commitmentType: 'build',
        currentValue: 5,
        id: 'build-covered',
        remainingCheckIns: 0,
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
      makeCircle({
        commitmentType: 'limit',
        currentValue: 4,
        id: 'limit-covered',
        maximumValue: 6,
        minimumValue: 2,
        remainingCheckIns: 0,
        state: 'done',
        title: 'Limit Covered',
        unitLabel: 'servings',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: true,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 0,
        viewerTodayStatus: 'done',
      }),
      makeCircle({
        commitmentType: 'build',
        currentValue: 3,
        id: 'build-partial',
        targetValue: 5,
        title: 'Build Partial',
        unitLabel: 'pages',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 1,
        viewerTodayStatus: 'partial',
      }),
      makeCircle({
        commitmentType: 'limit',
        currentValue: 8,
        id: 'limit-failed',
        maximumValue: 6,
        minimumValue: 2,
        title: 'Limit Failed',
        unitLabel: 'servings',
        viewerCanUpdateTapIn: true,
        viewerHasCheckedIn: false,
        viewerHasTappedInToday: true,
        viewerRemainingTapIns: 1,
        viewerTodayStatus: 'failed',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();

    const needsYouStat = screen.root.findByProps({
      accessibilityLabel: 'Needs you, 2',
    });

    act(() => {
      needsYouStat.props.onPress();
    });

    const filtered = renderedText(screen);
    expect(filtered).toContain('Build Partial');
    expect(filtered).toContain('Limit Failed');
    expect(filtered).not.toContain('Build Covered');
    expect(filtered).not.toContain('Limit Covered');
  });

  it('opens commitment creation from the header button', () => {
    mockHomeData = homeData([]);
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const createButton = screen.root.findAllByProps({
      accessibilityLabel: 'Create commitment',
    })[0];

    act(() => {
      createButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('CreateCircle');
  });

  it('opens Circle Detail from focused-card content', () => {
    mockHomeData = homeData([makeCircle({id: 'detail-circle'})]);
    const {rootNavigate, screen} = renderScreenWithNavigation();

    act(() =>
      screen.root.findAllByProps({
        accessibilityLabel: 'View details for Morning Movers',
      })[0].props.onPress(),
    );

    expect(rootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'detail-circle',
    });
  });

  it('opens Explore from the find-more-circles card', () => {
    mockHomeData = homeData([makeCircle({})]);
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const findMoreButton = screen.root.findByProps({
      accessibilityLabel: 'Find more circles',
    });

    act(() => {
      findMoreButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('MainTabs', {screen: 'Explore'});
  });

  it('renders Find more circles as a design-system list row', () => {
    mockHomeData = homeData([makeCircle({})]);
    const {screen} = renderScreenWithNavigation();
    const findMoreStyles = screen.root
      .findAllByProps({testID: 'find-more-circles-card'})
      .map(node => StyleSheet.flatten(node.props.style));
    const findMoreTitleStyle = screen.root
      .findAll(node => node.props.children === 'Find more circles')
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 16);
    const findMoreSubtitleStyle = screen.root
      .findAll(
        node => node.props.children === 'Browse public circles in Explore',
      )
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 12);

    expect(findMoreStyles).not.toContainEqual(
      expect.objectContaining({borderStyle: 'dashed'}),
    );
    expect(findMoreTitleStyle).toMatchObject({
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 21,
    });
    expect(findMoreSubtitleStyle).toMatchObject({
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    });
  });

  it('filters the list to pending circles when the Pending stat is tapped', () => {
    mockHomeData = homeData([
      makeCircle({id: 'active-circle', title: 'Active Circle'}),
      makeCircle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();

    expect(renderedText(screen)).toContain('Active Circle');

    const pendingStat = screen.root.findByProps({
      accessibilityLabel: 'Pending, 1',
    });

    act(() => {
      pendingStat.props.onPress();
    });

    const filtered = renderedText(screen);
    expect(filtered).toContain('Pending Circle');
    expect(filtered).not.toContain('Active Circle');
  });

  it('clears a selected filter when the same stat is tapped again', () => {
    mockHomeData = homeData([
      makeCircle({id: 'active-circle', title: 'Active Circle'}),
      makeCircle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();
    const pendingStat = screen.root.findByProps({
      accessibilityLabel: 'Pending, 1',
    });

    act(() => pendingStat.props.onPress());
    expect(renderedText(screen)).not.toContain('Active Circle');

    act(() => pendingStat.props.onPress());
    const cleared = renderedText(screen);
    expect(cleared).toContain('Active Circle');
    expect(cleared).toContain('Pending Circle');
  });

  it('sorts active commitments by name and by lowest progress', () => {
    mockHomeData = homeData([
      makeCircle({id: 'zeta', progressPercent: 25, title: 'Zeta'}),
      makeCircle({id: 'alpha', progressPercent: 75, title: 'Alpha'}),
    ]);
    const {screen} = renderScreenWithNavigation();
    const sortControl = screen.root.findByProps({
      accessibilityLabel: 'Sorted by urgency. Change sorting.',
    });

    act(() => sortControl.props.onPress());
    act(() =>
      screen.root.findAllByProps({accessibilityLabel: 'Sort by Name'})[0].props
        .onPress(),
    );
    let output = renderedText(screen);
    expect(output.indexOf('Alpha')).toBeLessThan(output.indexOf('Zeta'));

    act(() =>
      screen.root
        .findByProps({accessibilityLabel: 'Sorted by name. Change sorting.'})
        .props.onPress(),
    );
    act(() =>
      screen.root.findAllByProps({
        accessibilityLabel: 'Sort by Progress',
      })[0].props.onPress(),
    );
    output = renderedText(screen);
    expect(output.indexOf('Zeta')).toBeLessThan(output.indexOf('Alpha'));
  });

  it('keeps a pending-only circle visible without discovery', () => {
    mockHomeData = homeData([
      makeCircle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const output = renderScreen();

    expect(output).toContain('Pending Circle');
    expect(output).toContain('Find more circles');
    expect(output).not.toContain('Discover Circles');
  });
});
