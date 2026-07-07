import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CirclesScreen} from '../src/features/circles/screens/CirclesScreen';
import {GlassPanel} from '../src/design/components/GlassPanel';
import type {HomeData} from '../src/features/home/services/home-data-service';
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

jest.mock('../src/features/home/services/home-data-service', () => {
  return {
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
    getHomeCircleActionVariant: jest.fn((circle: CircleManagementCard) => {
      if (circle.viewerMembershipStatus === 'pending') {
        return 'view';
      }

      if (!circle.viewerHasTappedInToday) {
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
  it('renders the filterable management list when an active circle exists', () => {
    mockHomeData = homeData([circle({})]);
    const output = renderScreen();

    expect(output).toContain('Your commitments');
    expect(output).toContain('Active circles and join requests.');
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

  it('uses compact commitment header type and full-width stat cards', () => {
    mockHomeData = homeData([circle({})]);
    const {screen} = renderScreenWithNavigation();
    const headingStyles = screen.root
      .findAll(node => node.props.children === 'Your commitments')
      .map(node => StyleSheet.flatten(node.props.style));
    const subtitleStyles = screen.root
      .findAll(
        node => node.props.children === 'Active circles and join requests.',
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
    expect(output).toContain('New');
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

  it('opens Create Circle from the header New button', () => {
    mockHomeData = homeData([]);
    const {rootNavigate, screen} = renderScreenWithNavigation();
    const createButton = screen.root.findByProps({
      accessibilityLabel: 'Create Circle',
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
      .findAll(node => node.props.children === 'Browse public circles in Explore')
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
