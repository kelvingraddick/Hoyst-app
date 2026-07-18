import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CirclesScreen} from '../src/features/circles/screens/CirclesScreen';
import {GlassPanel} from '../src/design/components/GlassPanel';
import type {HomeData} from '../src/features/home/services/home-data-service';
import type {PastCircleSummary} from '../src/features/circles/services/past-circle-service';
import type {CircleManagementCard} from '../src/types/models';

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
    subscribeToHomeData: jest.fn(({onData}) => {
      onData(mockHomeData);
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

function renderScreenWithNavigation() {
  const rootNavigate = jest.fn();
  const navigation = {
    navigate: rootNavigate,
  };
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(
      <CirclesScreen navigation={navigation as never} route={{} as never} />,
    );
  });

  return {rootNavigate, screen: screen!};
}

function renderScreenTree() {
  return renderScreenWithNavigation().screen;
}

function renderScreen() {
  return JSON.stringify(renderScreenTree().toJSON());
}

describe('CirclesScreen render paths', () => {
  beforeEach(() => {
    mockPastCircles = [];
  });

  it('renders the filterable management list when an active circle exists', () => {
    mockHomeData = homeData([circle({})]);
    const output = renderScreen();

    expect(output).toContain('Your commitments');
    expect(output).toContain(
      'Personal commitments, active circles, and join requests.',
    );
    expect(output).toContain('Needs You');
    expect(output).toContain('Pending');
    expect(output).toContain('On Track');
    expect(output).toContain('Done');
    // Stat-card tone colors (light mode).
    expect(output).toContain('#FF6D00');
    expect(output).toContain('#D68B00');
    expect(output).toContain('#2F6FED');
    expect(output).toContain('#159957');
    expect(output).toContain('Morning Movers');
    expect(output).toContain('Sorted by urgency');
    expect(output).toContain('Find more circles');
    expect(output).toContain('Browse public circles in Explore');
    expect(output).not.toContain('Overview');
    expect(output).not.toContain('Need Attention');
    expect(output).not.toContain('All Circles');
    expect(output).not.toContain('Discover Circles');
  });

  it('renders personal commitments above the group Circle list', () => {
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
        title: 'Read every day',
      }),
      circle({id: 'group-1'}),
    ]);
    const output = renderScreen();

    expect(output).toContain('Personal Commitments');
    expect(output).toContain('Read every day');
    expect(output.indexOf('Personal Commitments')).toBeLessThan(
      output.indexOf('Sorted by urgency'),
    );
  });

  it('renders Past Circles below active circles and opens a read-only summary', () => {
    mockHomeData = homeData([circle({})]);
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
      accessibilityLabel: 'View past Circle Book Club',
    });
    const output = JSON.stringify(screen.toJSON());

    expect(output).toContain('Past Circles');
    expect(output.indexOf('Morning Movers')).toBeLessThan(
      output.indexOf('Past Circles'),
    );

    act(() => {
      pastCircleButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('PastCircle', {
      summary: mockPastCircles[0],
    });
  });

  it('uses compact commitment header type and full-width stat cards', () => {
    mockHomeData = homeData([circle({})]);
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
    const needsYouStat = screen.root
      .findAllByProps({
        accessibilityLabel: 'Needs You, 1',
      })
      .find(node => typeof node.props.style === 'function');

    if (!needsYouStat) {
      throw new Error('Needs You stat pressable was not found');
    }
    let ancestor = needsYouStat.parent;
    let statRowStyle: ReturnType<typeof StyleSheet.flatten> | undefined;

    while (ancestor) {
      const flattenedStyle = StyleSheet.flatten(ancestor.props.style);

      if (
        flattenedStyle?.flexDirection === 'row' &&
        flattenedStyle?.gap === 9
      ) {
        statRowStyle = flattenedStyle;
        break;
      }

      ancestor = ancestor.parent;
    }

    if (!statRowStyle) {
      throw new Error('Stat row style was not found');
    }

    const statButtonStyle = StyleSheet.flatten(
      needsYouStat.props.style({pressed: false}),
    );
    const statPanels = screen.root.findAllByType(GlassPanel).filter(panel => {
      const panelStyle = StyleSheet.flatten(panel.props.style);

      return panelStyle?.borderRadius === 18 && panelStyle?.width === '100%';
    });

    expect(headingStyles).toContainEqual(
      expect.objectContaining({
        fontSize: 24,
        letterSpacing: 0,
        lineHeight: 28,
      }),
    );
    expect(subtitleStyles).toContainEqual(
      expect.objectContaining({
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
      }),
    );
    expect(statRowStyle).toMatchObject({
      alignItems: 'stretch',
      alignSelf: 'stretch',
      flexDirection: 'row',
      width: '100%',
    });
    expect(statButtonStyle).toMatchObject({
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      width: '100%',
    });
    expect(statPanels).toHaveLength(4);
    statPanels.forEach(panel => {
      expect(StyleSheet.flatten(panel.props.style)).toMatchObject({
        borderRadius: 18,
        width: '100%',
      });
    });
  });

  it('renders the empty state when there are no joined circles', () => {
    mockHomeData = homeData([]);
    const output = renderScreen();

    expect(output).toContain('Your commitments');
    expect(output).toContain('No circles yet');
    expect(output).toContain('Find more circles');
    expect(output).toContain('Create commitment');
    expect(output).not.toContain('Need Attention');
    expect(output).not.toContain('All Circles');
    expect(output).not.toContain('Discover Circles');
  });

  it('opens Tap In for a completed weekly commitment without today coverage', () => {
    mockHomeData = homeData([
      circle({
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
      testID: 'attention-tap-in-button',
    });

    act(() => {
      tapInButton.props.onPress({stopPropagation: jest.fn()});
    });

    expect(rootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'weekly-complete-new-day',
      source: 'tap_in',
    });
  });

  it('excludes covered quantity circles from Needs You but keeps partial and failed due', () => {
    mockHomeData = homeData([
      circle({
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
      circle({
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
      circle({
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
      circle({
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
      accessibilityLabel: 'Needs You, 2',
    });

    act(() => {
      needsYouStat.props.onPress();
    });

    const filtered = JSON.stringify(screen.toJSON());
    expect(filtered).toContain('Build Partial');
    expect(filtered).toContain('Limit Failed');
    expect(filtered).not.toContain('Build Covered');
    expect(filtered).not.toContain('Limit Covered');
  });

  it('opens commitment creation from the header button', () => {
    mockHomeData = homeData([]);
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const createButton = screen.root.findByProps({
      accessibilityLabel: 'Create commitment',
    });

    act(() => {
      createButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('CreateCircle');
  });

  it('opens Explore from the find-more-circles card', () => {
    mockHomeData = homeData([circle({})]);
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const findMoreButton = screen.root.findByProps({
      accessibilityLabel: 'Find more circles',
    });

    act(() => {
      findMoreButton.props.onPress();
    });

    expect(rootNavigate).toHaveBeenCalledWith('MainTabs', {screen: 'Explore'});
  });

  it('renders the find-more-circles action as a dashed horizontal card', () => {
    mockHomeData = homeData([circle({})]);
    const {screen} = renderScreenWithNavigation();
    const findMoreStyle = screen.root
      .findAllByProps({testID: 'find-more-circles-card'})
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.borderStyle === 'dashed');
    const findMoreTitleStyle = screen.root
      .findAll(node => node.props.children === 'Find more circles')
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 15);
    const findMoreSubtitleStyle = screen.root
      .findAll(
        node => node.props.children === 'Browse public circles in Explore',
      )
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 14);

    expect(findMoreStyle).toBeTruthy();

    expect(findMoreStyle).toMatchObject({
      borderRadius: 24,
      borderStyle: 'dashed',
      borderWidth: 1.25,
      flexDirection: 'row',
      gap: 14,
      minHeight: 78,
      paddingHorizontal: 18,
      paddingVertical: 12,
    });
    expect(findMoreTitleStyle).toMatchObject({
      fontSize: 15,
      lineHeight: 18,
    });
    expect(findMoreSubtitleStyle).toMatchObject({
      fontSize: 14,
      lineHeight: 17,
    });
  });

  it('filters the list to pending circles when the Pending stat is tapped', () => {
    mockHomeData = homeData([
      circle({id: 'active-circle', title: 'Active Circle'}),
      circle({
        id: 'pending-circle',
        title: 'Pending Circle',
        viewerMembershipStatus: 'pending',
      }),
    ]);
    const {screen} = renderScreenWithNavigation();

    expect(JSON.stringify(screen.toJSON())).toContain('Active Circle');

    const pendingStat = screen.root.findByProps({
      accessibilityLabel: 'Pending, 1',
    });

    act(() => {
      pendingStat.props.onPress();
    });

    const filtered = JSON.stringify(screen.toJSON());
    expect(filtered).toContain('Pending Circle');
    expect(filtered).not.toContain('Active Circle');
  });

  it('keeps a pending-only circle visible without discovery', () => {
    mockHomeData = homeData([
      circle({
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
