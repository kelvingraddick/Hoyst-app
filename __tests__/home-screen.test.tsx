import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {ActivityFeedCard} from '../src/design/components/ActivityFeedCard';
import {GradientRing} from '../src/design/components/GradientRing';
import {brandColors} from '../src/design/tokens/colors';
import {HomeScreen} from '../src/features/home/screens/HomeScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import {
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../src/features/settings/services/notification-settings-service';
import type {InboxEvent, MomentumSummary} from '../src/types/models';

const mockNavigate = jest.fn();
const mockRootNavigate = jest.fn();

let mockHomeData: HomeData;
let mockInboxEvents: InboxEvent[];
let mockMomentumSummary: MomentumSummary;

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(MockView, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const MockReact = require('react');
    MockReact.useEffect(() => callback(), [callback]);
  },
  useNavigation: () => ({
    getParent: () => ({
      navigate: mockRootNavigate,
    }),
    navigate: mockNavigate,
  }),
}));

jest.mock('../src/design/components/BrandMark', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BrandMark: (props: Record<string, unknown>) =>
      MockReact.createElement(MockView, props),
  };
});

jest.mock('../src/design/components/MomentumStageIcon', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    MomentumStageIcon: (props: Record<string, unknown>) =>
      MockReact.createElement(MockView, props),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      beginAuthFlow: jest.Mock;
      clearPendingAction: jest.Mock;
      status: 'authenticatedReady';
      user: {photoURL?: string; providerIds: string[]; uid: string};
    }) => unknown,
  ) =>
    selector({
      beginAuthFlow: jest.fn(),
      clearPendingAction: jest.fn(),
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    }),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
}));

jest.mock('../src/store/onboarding-store', () => ({
  useOnboardingStore: (
    selector: (state: {
      setCurrentStep: jest.Mock;
      startOnboardingWizard: jest.Mock;
    }) => unknown,
  ) =>
    selector({
      setCurrentStep: jest.fn(),
      startOnboardingWizard: jest.fn(),
    }),
}));

jest.mock('../src/features/auth/hooks/useProtectedAction', () => ({
  useProtectedAction: () => (_pendingAction: unknown, onReady: () => void) =>
    onReady(),
}));

jest.mock('../src/navigation/auth-modal-navigation', () => ({
  navigateToAuthWelcome: jest.fn(),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  nudgeCircleMembers: jest.fn(() => Promise.resolve({nudged: 0})),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
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
  getHomeCircleActionVariant: jest.fn(() => 'view'),
  getHomeGreetingContext: jest.fn(() => ({
    completedTodayCount: 0,
    firstName: 'Kelvin',
    needsTapInCount: 0,
    nudgesAvailableCount: 0,
    pendingCount: 0,
    timeWindow: 'morning',
    upcomingCount: 0,
  })),
  getHomeGreetingFallback: jest.fn(() => 'Keep moving today'),
  getTodayAttentionCircles: jest.fn(() => []),
  getUpcomingAttentionCircles: jest.fn(() => []),
  shouldShowAuthenticatedHomeEmptyState: jest.fn(() => false),
  shouldShowHomeCreateCircleButton: jest.fn(() => true),
  shouldShowHomeDataErrorPanel: jest.fn(() => false),
  subscribeToHomeData: jest.fn(({onData}) => {
    onData(mockHomeData);
    return jest.fn();
  }),
}));

jest.mock('../src/features/home/services/home-greeting-service', () => ({
  buildHomeGreetingCacheKey: jest.fn(() => 'home-key'),
  clearExpiredHomeGreetingCacheEntries: jest.fn(() => Promise.resolve()),
  generateHomeGreeting: jest.fn(() =>
    Promise.resolve({headline: 'Keep moving today', source: 'fallback'}),
  ),
  getCachedHomeGreeting: jest.fn(() => Promise.resolve(undefined)),
  setCachedHomeGreeting: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/features/momentum/services/momentum-service', () => ({
  buildMomentumSummaryFromHomeData: jest.fn(() => mockMomentumSummary),
  formatOpportunityCount: jest.fn(() => '0 opportunities'),
  subscribeToMomentumSummary: jest.fn(() => jest.fn()),
}));

jest.mock(
  '../src/features/settings/services/notification-settings-service',
  () => ({
    markAllInboxEventsRead: jest.fn(() => Promise.resolve({read: 1})),
    markInboxEventRead: jest.fn(() => Promise.resolve({read: true})),
    subscribeToInboxEvents: jest.fn(({onEvents}) => {
      onEvents(mockInboxEvents);
      return jest.fn();
    }),
    subscribeToInboxUnreadCount: jest.fn(({onCount}) => {
      onCount(1);
      return jest.fn();
    }),
  }),
);

function homeData(): HomeData {
  return {
    circles: [],
    hasLoadedMemberships: false,
    hasRealProgress: false,
    membershipCount: 0,
    personalStreakDays: 0,
    progressDays: [],
    progressPercent: 0,
    todayDateKey: '2026-05-26',
    todayLabel: 'Today',
  };
}

function momentumSummary(
  overrides: Partial<MomentumSummary> = {},
): MomentumSummary {
  return {
    availableOpportunities: 0,
    bestStreak: 0,
    completedOpportunities: 0,
    currentStreak: 0,
    label: 'Getting started',
    percentage: 0,
    periodKey: '2026-05-26',
    status: 'getting_started',
    ...overrides,
  };
}

function inboxEvent(overrides: Partial<InboxEvent> = {}): InboxEvent {
  return {
    actor: {
      displayName: 'Ari Runner',
      uid: 'user-2',
    },
    body: 'tapped in for Morning Movers.',
    createdAtLabel: 'Now',
    deeplink: {circleId: 'circle-1', screen: 'CircleDetail'},
    id: 'event-1',
    isRead: false,
    title: 'Ari Runner',
    type: 'companion_tapped_in',
    ...overrides,
  };
}

function renderScreenTree() {
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(<HomeScreen />);
  });

  return screen!;
}

function renderScreen() {
  return JSON.stringify(renderScreenTree().toJSON());
}

describe('HomeScreen companion updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHomeData = homeData();
    mockInboxEvents = [];
    mockMomentumSummary = momentumSummary();
  });

  it('subscribes to inbox events and renders empty companion updates at the bottom', () => {
    const output = renderScreen();

    expect(subscribeToInboxEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        onEvents: expect.any(Function),
        uid: 'user-1',
      }),
    );
    expect(output).toContain('Companion updates');
    expect(output).toContain('No companion updates yet');
    expect(output.indexOf('Companion updates')).toBeGreaterThan(
      output.indexOf('Today is clear'),
    );
    expect(output.indexOf('Companion updates')).toBeLessThan(
      output.lastIndexOf('Create Circle'),
    );
  });

  it('renders recent companion updates and opens their deeplink', () => {
    mockInboxEvents = [inboxEvent()];
    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Companion updates');
    expect(output).toContain('Ari Runner');
    expect(output).toContain('tapped in for Morning Movers.');

    const eventPressable = tree.root
      .findAllByType(Pressable)
      .find(node => node.findAllByType(ActivityFeedCard).length > 0);

    expect(eventPressable).toBeTruthy();

    act(() => {
      eventPressable?.props.onPress();
    });

    expect(markInboxEventRead).toHaveBeenCalledWith('event-1');
    expect(mockRootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'circle-1',
    });
  });

  it('uses the Momentum status palette and icon on Home momentum visuals', () => {
    mockMomentumSummary = momentumSummary({
      label: 'Building',
      percentage: 35,
      status: 'building_momentum',
    });

    const tree = renderScreenTree();
    expect(
      tree.root.findByProps({testID: 'home-momentum-stage-icon'}).props.status,
    ).toBe('building_momentum');
    expect(
      tree.root.findByProps({testID: 'circle-summary-momentum-stage-icon'})
        .props.status,
    ).toBe('building_momentum');

    const barFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-fill'}).props.style,
    );
    const barKnobStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-knob'}).props.style,
    );
    const contributionDiscStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-summary-contribution-disc'}).props
        .style,
    );
    const momentumDiscStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-summary-momentum-disc'}).props
        .style,
    );
    const streakDiscStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-summary-streak-disc'}).props.style,
    );
    const contributionIcon = tree.root.findByProps({
      testID: 'circle-summary-contribution-icon',
    });
    const streakIcon = tree.root.findByProps({
      testID: 'circle-summary-streak-icon',
    });

    const rings = tree.root.findAllByType(GradientRing);

    expect(barFillStyle.backgroundColor).toBe(brandColors.orange);
    expect(rings[1].props.flatColor).toBe(brandColors.orange);
    expect(contributionDiscStyle.backgroundColor).toBe('#E8F8EF');
    expect(momentumDiscStyle.backgroundColor).toBe('#FFF3DF');
    expect(streakDiscStyle.backgroundColor).toBe('#FFF3CF');
    expect(barKnobStyle.backgroundColor).toBe('#FFF3DF');
    expect(barKnobStyle.borderWidth).toBeUndefined();
    expect(contributionIcon.props.height).toBe(33);
    expect(contributionIcon.props.width).toBe(33);
    expect(streakIcon.props.height).toBe(33);
    expect(streakIcon.props.width).toBe(33);
    const textLabels = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    expect(textLabels).toContain('Streak');
    expect(textLabels).toContain('0 days');
    expect(textLabels).not.toContain('Streak (0 Days!)');
    const connectorStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-summary-connector'}).props.style,
    );

    expect(connectorStyle.backgroundColor).toBe('#EEF1F5');
    expect(connectorStyle.left).toBe('12%');
    expect(connectorStyle.right).toBe('12%');
  });
});
