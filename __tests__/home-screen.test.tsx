import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {ActivityFeedCard} from '../src/design/components/ActivityFeedCard';
import {HoystButton} from '../src/design/components/HoystButton';
import {SectionEyebrow} from '../src/design/components/SectionEyebrow';
import {WeekProgressStrip} from '../src/design/components/WeekProgressStrip';
import {brandColors} from '../src/design/tokens/colors';
import {HomeScreen} from '../src/features/home/screens/HomeScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import {
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomePrimaryAction,
  getTodayAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
} from '../src/features/home/services/home-data-service';
import {generateHomeGreeting} from '../src/features/home/services/home-greeting-service';
import {nudgeCircleMembers} from '../src/features/circles/services/circle-service';
import type {
  AuthSessionStatus,
  AuthSessionUser,
} from '../src/store/session-store';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../src/features/settings/services/notification-settings-service';
import type {
  CircleManagementCard,
  InboxEvent,
  MomentumSummary,
} from '../src/types/models';

const HOME_NEUTRAL_SURFACE_LIGHT = 'rgba(226,232,240,0.72)';
const HOME_NEUTRAL_SURFACE_DARK = 'rgba(255,255,255,0.06)';

const mockNavigate = jest.fn();
const mockRootNavigate = jest.fn();
const mockRequireAccount = jest.fn(
  (_pendingAction: unknown, onReady: () => void) => onReady(),
);

let mockHomeData: HomeData;
let mockInboxEvents: InboxEvent[];
let mockUnreadInboxCount = 1;
let mockMomentumSummary: MomentumSummary;
let mockAppearance: 'dark' | 'light' = 'light';
let mockSessionStatus: AuthSessionStatus = 'authenticatedReady';
let mockSessionUser: AuthSessionUser | undefined = {
  providerIds: [],
  uid: 'user-1',
};
let mockPendingHoyTapInCelebration:
  | {circleId: string; dateKey: string; uid: string}
  | undefined;
const mockClearStaleHoyTapInCelebration = jest.fn();
const mockConsumeHoyTapInCelebration = jest.fn();

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
  useSettingsStore: (
    selector: (state: {appearance: 'dark' | 'light'}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      beginAuthFlow: jest.Mock;
      clearPendingAction: jest.Mock;
      status: AuthSessionStatus;
      user?: AuthSessionUser;
    }) => unknown,
  ) =>
    selector({
      beginAuthFlow: jest.fn(),
      clearPendingAction: jest.fn(),
      status: mockSessionStatus,
      user: mockSessionUser,
    }),
}));

jest.mock('../src/store/hoy-feedback-store', () => ({
  useHoyFeedbackStore: (
    selector: (state: {
      clearStaleTapInCelebration: jest.Mock;
      consumeTapInCelebration: jest.Mock;
      pendingTapInCelebration?: {
        circleId: string;
        dateKey: string;
        uid: string;
      };
    }) => unknown,
  ) =>
    selector({
      clearStaleTapInCelebration: mockClearStaleHoyTapInCelebration,
      consumeTapInCelebration: mockConsumeHoyTapInCelebration,
      pendingTapInCelebration: mockPendingHoyTapInCelebration,
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
  useProtectedAction: () => mockRequireAccount,
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
    hasResolvedGreetingContext: false,
    membershipCount: 0,
    personalStreakDays: 0,
    progressDays: [],
    progressPercent: 0,
    todayDateKey: '2026-05-26',
    todayLabel: 'Today',
  })),
  getDateKey: jest.fn(() => '2026-05-26'),
  getHomeCircleActionVariant: jest.fn(() => 'view'),
  getHomeCommitmentStackCircles: jest.fn(
    ({
      personalCommitments,
      todayAttentionCircles,
      upcomingAttentionCircles,
    }) => {
      const uniqueCircles = new Map();

      [
        ...personalCommitments,
        ...todayAttentionCircles,
        ...upcomingAttentionCircles,
      ].forEach(circle => {
        if (!uniqueCircles.has(circle.id)) {
          uniqueCircles.set(circle.id, circle);
        }
      });

      return [...uniqueCircles.values()];
    },
  ),
  getHomeGreetingContext: jest.fn(() => ({
    circleSummary: {
      atRiskCount: 0,
      circleCount: 0,
      doneCount: 0,
      groupCircleCount: 0,
      needsYouCount: 0,
      pendingCount: 0,
      personalCommitmentCount: 0,
    },
    firstName: 'Kelvin',
    primaryAction: {
      isAtRisk: false,
      kind: 'no_commitments',
      remainingActionCount: 0,
    },
    timeWindow: 'morning',
  })),
  getHomeGreetingFallback: jest.fn(() => 'Keep moving today'),
  getHomePrimaryAction: jest.fn(() => ({
    context: {
      isAtRisk: false,
      kind: 'no_commitments',
      remainingActionCount: 0,
    },
  })),
  getNextHomeActionBoundary: jest.fn(() => Date.now() + 24 * 60 * 60 * 1000),
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
  getMomentumDisplayModel: jest.fn((summary?: MomentumSummary) => {
    const rollingMomentum = summary?.rollingMomentum;
    const resolvedOpportunityCount =
      rollingMomentum?.resolvedOpportunityCount ?? 0;
    const isCalibrating = resolvedOpportunityCount < 3;
    const rawRollingPercentage = rollingMomentum?.percentage ?? 0;
    const status = isCalibrating
      ? 'getting_started'
      : rollingMomentum?.status ?? 'building_momentum';

    return {
      displayProgress: isCalibrating
        ? Math.round((Math.min(resolvedOpportunityCount, 2) / 3) * 100)
        : rawRollingPercentage,
      isCalibrating,
      label:
        status === 'peak_momentum'
          ? 'Peak'
          : status === 'strong_momentum'
          ? 'Strong'
          : status === 'building_momentum'
          ? 'Building'
          : 'Getting Started',
      rawRollingPercentage,
      requiredResolvedOpportunityCount: 3,
      resolvedOpportunityCount,
      status,
    };
  }),
  subscribeToMomentumSummary: jest.fn(({onSummary}) => {
    onSummary(mockMomentumSummary);
    return jest.fn();
  }),
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
      onCount(mockUnreadInboxCount);
      return jest.fn();
    }),
  }),
);

function homeData(): HomeData {
  return {
    circles: [],
    hasLoadedMemberships: false,
    hasRealProgress: false,
    hasResolvedGreetingContext: false,
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
    creditedOpportunities: 0,
    completedOpportunities: 0,
    currentStreak: 0,
    label: 'Getting started',
    percentage: 0,
    periodKey: '2026-05-26',
    skippedOpportunities: 0,
    status: 'getting_started',
    tapInOpportunities: 0,
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

function attentionCircle(
  overrides: Partial<CircleManagementCard> = {},
): CircleManagementCard {
  return {
    category: 'Wellness',
    commitment: 'Sleep 8 hours in a day',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 0,
    id: 'circle-attention',
    inviteUrl: 'https://example.com/invite',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 1,
    members: [],
    privacy: 'public',
    progressPercent: 0,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 0,
    streakLabel: 'Start today',
    title: 'Sleep 8 Hours',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRole: 'member',
    viewerTodayStatus: undefined,
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

function setResolvedHoyAction({
  action,
  circle,
}: {
  action: {
    circleMode?: 'group' | 'personal';
    circleTitle?: string;
    isAtRisk: boolean;
    kind:
      | 'tap_in'
      | 'update_tap_in'
      | 'nudge'
      | 'pending_approval'
      | 'no_commitments'
      | 'momentum';
    remainingActionCount: number;
  };
  circle?: CircleManagementCard;
}) {
  mockHomeData = {
    ...homeData(),
    circles: circle ? [circle] : [],
    hasLoadedMemberships: true,
    hasResolvedGreetingContext: true,
    membershipCount: circle ? 1 : 0,
  };
  (getHomeGreetingContext as jest.Mock).mockReturnValue({
    circleSummary: {
      atRiskCount: action.isAtRisk ? 1 : 0,
      circleCount: circle ? 1 : 0,
      doneCount: action.kind === 'momentum' && circle ? 1 : 0,
      groupCircleCount: circle?.circleMode === 'personal' ? 0 : circle ? 1 : 0,
      needsYouCount:
        action.kind === 'tap_in' || action.kind === 'update_tap_in' ? 1 : 0,
      pendingCount: action.kind === 'pending_approval' ? 1 : 0,
      personalCommitmentCount: circle?.circleMode === 'personal' ? 1 : 0,
    },
    firstName: 'Kelvin',
    primaryAction: action,
    timeWindow: 'morning',
  });
  (getHomePrimaryAction as jest.Mock).mockReturnValue({
    circle,
    context: action,
  });
  (generateHomeGreeting as jest.Mock).mockReturnValue(
    new Promise(() => undefined),
  );
}

describe('HomeScreen Circle activity updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHomeData = homeData();
    mockInboxEvents = [];
    mockUnreadInboxCount = 1;
    mockMomentumSummary = momentumSummary();
    mockAppearance = 'light';
    mockSessionStatus = 'authenticatedReady';
    mockSessionUser = {providerIds: [], uid: 'user-1'};
    mockPendingHoyTapInCelebration = undefined;
    mockConsumeHoyTapInCelebration.mockImplementation(
      ({dateKey, uid}: {dateKey: string; uid: string}) => {
        const pendingFeedback = mockPendingHoyTapInCelebration;

        if (
          !pendingFeedback ||
          pendingFeedback.dateKey !== dateKey ||
          pendingFeedback.uid !== uid
        ) {
          return undefined;
        }

        mockPendingHoyTapInCelebration = undefined;
        return pendingFeedback;
      },
    );
    (getTodayAttentionCircles as jest.Mock).mockReturnValue([]);
    (getHomeGreetingContext as jest.Mock).mockReturnValue({
      circleSummary: {
        atRiskCount: 0,
        circleCount: 0,
        doneCount: 0,
        groupCircleCount: 0,
        needsYouCount: 0,
        pendingCount: 0,
        personalCommitmentCount: 0,
      },
      firstName: 'Kelvin',
      primaryAction: {
        isAtRisk: false,
        kind: 'no_commitments',
        remainingActionCount: 0,
      },
      timeWindow: 'morning',
    });
    (getHomePrimaryAction as jest.Mock).mockReturnValue({
      context: {
        isAtRisk: false,
        kind: 'no_commitments',
        remainingActionCount: 0,
      },
    });
    (shouldShowAuthenticatedHomeEmptyState as jest.Mock).mockReturnValue(false);
  });

  it('subscribes to inbox events and renders empty Circle activity at the bottom', () => {
    const output = renderScreen();

    expect(subscribeToInboxEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        onEvents: expect.any(Function),
        uid: 'user-1',
      }),
    );
    expect(output).toContain('CIRCLE ACTIVITY');
    expect(output).toContain('No Circle activity yet');
    expect(output.indexOf('CIRCLE ACTIVITY')).toBeGreaterThan(
      output.indexOf('Today is clear'),
    );
  });

  it('does not render create circle CTAs on Home', () => {
    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).not.toContain('Create Circle');
    expect(output).not.toContain('Start a new accountability crew');
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Create Circle'}),
    ).toHaveLength(0);
  });

  it('renders a dedicated personal commitment section', () => {
    mockHomeData = {
      ...homeData(),
      circles: [
        attentionCircle({
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
      ],
      hasLoadedMemberships: true,
      membershipCount: 1,
    };
    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('YOUR COMMITMENTS');
    expect(output).toContain('Read every day');
    expect(output).toContain('PERSONAL');
    expect(output).not.toContain('1/1 Members');
    expect(output).not.toContain('PERSONAL COMMITMENTS');
    expect(
      tree.root.findByProps({
        testID: 'home-commitment-focused-personal-1',
      }),
    ).toBeTruthy();
  });

  it('opens the private Circles screen from the Home attention section', () => {
    const tree = renderScreenTree();
    const allMyCirclesButton = tree.root.findByProps({
      accessibilityLabel: 'All my commitments',
    });

    expect(allMyCirclesButton).toBeTruthy();

    act(() => {
      allMyCirclesButton.props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('Circles');
  });

  it('renders the all-my-commitments action as a compact Home link', () => {
    const tree = renderScreenTree();
    const allMyCommitmentsLink = tree.root.findByProps({
      testID: 'all-my-commitments-link',
    });
    const linkPressableStyle = StyleSheet.flatten(
      allMyCommitmentsLink.props.style({pressed: false}),
    );
    const linkContentStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'all-my-commitments-link-content'}).props
        .style,
    );
    const allMyCommitmentsLabel = tree.root.findByProps({
      testID: 'all-my-commitments-label',
    });
    const allMyCommitmentsLabelStyle = StyleSheet.flatten(
      allMyCommitmentsLabel.props.style,
    );

    expect(JSON.stringify(tree.toJSON())).toContain('All my commitments');
    expect(allMyCommitmentsLink.props.accessibilityRole).toBe('button');
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      'View commitments and join requests',
    );
    expect(
      tree.root.findAllByProps({testID: 'all-my-circles-card'}),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'all-my-commitments-handshake'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'all-my-commitments-chevron'}),
    ).toBeTruthy();
    expect(linkPressableStyle).toMatchObject({
      marginBottom: -48,
      marginTop: -18,
      width: '100%',
    });
    expect(linkContentStyle).toMatchObject({
      flexDirection: 'row',
      minHeight: 44,
      transform: [{translateY: -10}],
    });
    expect(linkContentStyle.backgroundColor).toBeUndefined();
    expect(linkContentStyle.borderWidth).toBeUndefined();
    expect(allMyCommitmentsLabelStyle).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      color: '#4D5873',
    });
    expect(allMyCommitmentsLabel.props.numberOfLines).toBe(1);
  });

  it('routes authenticated empty-state circle discovery to Explore', () => {
    (shouldShowAuthenticatedHomeEmptyState as jest.Mock).mockReturnValue(true);
    const tree = renderScreenTree();
    const findCirclesButton = tree.root
      .findAllByType(HoystButton)
      .find(button => button.props.label === 'Find circles');

    expect(findCirclesButton).toBeTruthy();

    act(() => {
      findCirclesButton?.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Explore');
  });

  it('uses a flat warm-neutral canvas and outline-free Home containers', () => {
    const tree = renderScreenTree();
    const panelSurfaces = tree.root.findAllByProps({
      testID: 'solid-panel-surface',
    });

    expect(
      tree.root.findAll(
        node =>
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#FAFAF7',
      ),
    ).not.toHaveLength(0);
    expect(panelSurfaces.length).toBeGreaterThan(0);
    panelSurfaces.forEach(node => {
      const style = StyleSheet.flatten(node.props.style);
      expect(style.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_LIGHT);
      expect(style.borderWidth).toBe(0);
    });
  });

  it('renders Your Progress directly in the Home sheet with the notification control', () => {
    const tree = renderScreenTree();
    const panelSurfaces = tree.root.findAllByProps({
      testID: 'solid-panel-surface',
    });
    const weekProgressStrip = tree.root.findByProps({
      testID: 'week-progress-strip',
    });
    const homeProgressSection = tree.root.findByProps({
      testID: 'home-progress-section',
    });

    expect(tree.root.findAllByType(WeekProgressStrip)).toHaveLength(1);
    expect(StyleSheet.flatten(weekProgressStrip.props.style).gap).toBe(8);
    expect(StyleSheet.flatten(homeProgressSection.props.style).gap).toBe(8);
    expect(JSON.stringify(tree.toJSON())).toContain('YOUR PROGRESS');
    expect(
      tree.root
        .findByProps({testID: 'week-progress-header-actions'})
        .findAllByProps({testID: 'home-hero-notification-button'}),
    ).not.toHaveLength(0);
    panelSurfaces.forEach(panel => {
      expect(panel.findAllByType(WeekProgressStrip)).toHaveLength(0);
    });
  });

  it('uses a flat warm-neutral dark canvas and containers', () => {
    mockAppearance = 'dark';

    const tree = renderScreenTree();
    const panelSurfaces = tree.root.findAllByProps({
      testID: 'solid-panel-surface',
    });
    const momentumTrackStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-track'}).props.style,
    );

    expect(panelSurfaces.length).toBeGreaterThan(0);
    panelSurfaces.forEach(node => {
      const style = StyleSheet.flatten(node.props.style);
      expect(style.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_DARK);
      expect(style.borderWidth).toBe(0);
    });
    expect(momentumTrackStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_DARK);
    expect(tree.root.findAll(node => node.props.blurAmount)).toHaveLength(0);
  });

  it('removes the rotating hero headline and subline', () => {
    mockHomeData = {
      ...homeData(),
      todayDateKey: '2026-01-01',
    };

    expect(renderScreen()).not.toContain('Set the tone, Kelvin.');
  });

  it('keeps a compact flat Hoy bubble and replaces the avatar with Hoy', () => {
    const tree = renderScreenTree();
    const bubbleSurfaceStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-bubble-surface'}).props.style,
    );
    const bubbleFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-bubble-fill'}).props.style,
    );
    const hoyPlaceholderStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-hoy-placeholder'}).props.style,
    );
    const largeTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-large'}).props.style,
    );
    const smallTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-small'}).props.style,
    );
    const hoyAction = tree.root.findByProps({
      testID: 'home-hero-hoy-action',
    });
    const notificationButton = tree.root.findByProps({
      testID: 'home-hero-notification-button',
    });
    const unreadBadgeStyle = StyleSheet.flatten(
      tree.root.findByProps({
        testID: 'home-hero-notification-unread-badge',
      }).props.style,
    );
    const notificationButtonStyle = StyleSheet.flatten(
      typeof notificationButton.props.style === 'function'
        ? notificationButton.props.style({pressed: false})
        : notificationButton.props.style,
    );

    expect(bubbleSurfaceStyle.elevation).toBeUndefined();
    expect(bubbleSurfaceStyle.shadowOffset).toBeUndefined();
    expect(bubbleFillStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_LIGHT);
    expect(bubbleFillStyle.borderWidth).toBeUndefined();
    expect(hoyPlaceholderStyle.height).toBe(48);
    expect(hoyPlaceholderStyle.width).toBe(48);
    expect(hoyPlaceholderStyle.backgroundColor).toBe(
      HOME_NEUTRAL_SURFACE_LIGHT,
    );
    expect(hoyPlaceholderStyle.borderWidth).toBeUndefined();
    expect(
      tree.root.findAllByProps({
        testID: 'home-hero-hoy-orb-thinking-image',
      }).length,
    ).toBe(0);
    expect(
      tree.root.findAllByProps({
        testID: 'home-hero-hoy-orb-locked-image',
      }),
    ).toHaveLength(0);
    expect(largeTailDotStyle.backgroundColor).toBe(
      HOME_NEUTRAL_SURFACE_LIGHT,
    );
    expect(largeTailDotStyle.borderWidth).toBeUndefined();
    expect(largeTailDotStyle.height).toBe(9);
    expect(largeTailDotStyle.width).toBe(9);
    expect(largeTailDotStyle.elevation).toBeUndefined();
    expect(largeTailDotStyle.shadowOffset).toBeUndefined();
    expect(smallTailDotStyle.backgroundColor).toBe(
      HOME_NEUTRAL_SURFACE_LIGHT,
    );
    expect(smallTailDotStyle.borderWidth).toBeUndefined();
    expect(smallTailDotStyle.height).toBe(5);
    expect(smallTailDotStyle.width).toBe(5);
    expect(smallTailDotStyle.elevation).toBeUndefined();
    expect(smallTailDotStyle.shadowOffset).toBeUndefined();
    expect(hoyAction.props.accessibilityRole).toBe('button');
    expect(hoyAction.props.disabled).toBe(true);
    expect(hoyAction.props.accessibilityLabel).toBe(
      'Hoy is getting your next action ready.',
    );
    expect(notificationButton.props.accessibilityLabel).toBe(
      'Notifications, 1 unread update',
    );
    expect(notificationButtonStyle).toMatchObject({height: 36, width: 36});
    expect(unreadBadgeStyle).toMatchObject({
      backgroundColor: brandColors.red,
      borderRadius: 9,
      height: 18,
      right: -5,
      top: -5,
      width: 18,
    });
  });

  it('does not treat an authenticating session as a guest Hoy state', () => {
    mockSessionStatus = 'authenticating';
    mockSessionUser = {providerIds: [], uid: 'user-1'};

    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(
      tree.root.findAllByProps({testID: 'home-hero-hoy-placeholder'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({
        testID: 'home-hero-hoy-orb-locked-image',
      }),
    ).toHaveLength(0);
    expect(output).not.toContain('Start making Progress');
  });

  it('mounts the final Hoy face directly after initial Home resolution', async () => {
    mockHomeData = {
      ...homeData(),
      hasLoadedMemberships: true,
      hasResolvedGreetingContext: true,
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAllByProps({testID: 'home-hero-hoy-placeholder'}),
    ).toHaveLength(0);
    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-momentum_building-image',
      }),
    ).not.toHaveLength(0);
    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-thinking-image',
      }),
    ).toHaveLength(0);
    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-locked-image',
      }),
    ).toHaveLength(0);
  });

  it('uses rolling erosion before deadline urgency for Hoy emotion', async () => {
    mockHomeData = {
      ...homeData(),
      hasLoadedMemberships: true,
      hasResolvedGreetingContext: true,
    };
    mockMomentumSummary = momentumSummary({
      rollingMomentum: {
        hasUnrecoveredMiss: true,
        percentage: 80,
        resolvedOpportunityCount: 5,
        status: 'peak_momentum',
        windowDays: 14,
      },
    });
    (getHomeGreetingContext as jest.Mock).mockReturnValue({
      circleSummary: {
        atRiskCount: 1,
        circleCount: 1,
        doneCount: 0,
        needsYouCount: 1,
        pendingCount: 0,
      },
      firstName: 'Kelvin',
      primaryAction: {
        circleTitle: 'Workout Circle',
        isAtRisk: true,
        kind: 'tap_in',
        remainingActionCount: 0,
        urgency: 'deadline',
      },
      timeWindow: 'evening',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-risk_attention-image',
      }),
    ).not.toHaveLength(0);
    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-tap_in_needed-image',
      }),
    ).toHaveLength(0);

    act(() => tree!.unmount());
  });

  it('consumes a covered Tap In celebration only after Hoy resolves', async () => {
    jest.useFakeTimers();
    mockHomeData = {
      ...homeData(),
      hasLoadedMemberships: true,
      hasResolvedGreetingContext: true,
    };
    mockPendingHoyTapInCelebration = {
      circleId: 'circle-1',
      dateKey: '2026-05-26',
      uid: 'user-1',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPendingHoyTapInCelebration).toBeUndefined();
    expect(mockConsumeHoyTapInCelebration).toHaveBeenCalledWith({
      dateKey: '2026-05-26',
      uid: 'user-1',
    });
    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-celebrating-image',
      }),
    ).not.toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(2200);
    });

    expect(
      tree!.root.findAllByProps({
        testID: 'home-hero-hoy-orb-momentum_building-image',
      }),
    ).not.toHaveLength(0);

    act(() => {
      tree!.unmount();
    });
    jest.useRealTimers();
  });

  it('keeps Inbox clearing and navigation on the notification bell', () => {
    const tree = renderScreenTree();
    const notificationButton = tree.root.findByProps({
      testID: 'home-hero-notification-button',
    });

    act(() => {
      notificationButton.props.onPress();
    });

    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(1);
    expect(mockRootNavigate).toHaveBeenCalledWith('Inbox');
  });

  it('hides the notification badge at zero and caps it at nine', () => {
    mockUnreadInboxCount = 0;
    let tree = renderScreenTree();

    expect(
      tree.root.findAllByProps({
        testID: 'home-hero-notification-unread-badge',
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'home-hero-notification-button'}).props
        .accessibilityLabel,
    ).toBe('Notifications, no unread updates');

    act(() => {
      tree.unmount();
    });

    mockUnreadInboxCount = 14;
    tree = renderScreenTree();

    expect(
      tree.root.findByProps({
        testID: 'home-hero-notification-unread-badge',
      }).props.children.props.children,
    ).toBe('9');
    expect(
      tree.root.findByProps({testID: 'home-hero-notification-button'}).props
        .accessibilityLabel,
    ).toBe('Notifications, 9 or more unread updates');
  });

  it('opens the primary Tap In action from the combined Hoy target', () => {
    const circle = attentionCircle({
      id: 'workout-circle',
      title: 'Workout Circle',
    });

    setResolvedHoyAction({
      action: {
        circleMode: 'group',
        circleTitle: 'Workout Circle',
        isAtRisk: false,
        kind: 'tap_in',
        remainingActionCount: 0,
      },
      circle,
    });

    const tree = renderScreenTree();
    const hoyAction = tree.root.findByProps({
      testID: 'home-hero-hoy-action',
    });

    expect(hoyAction.props.disabled).toBe(false);
    expect(hoyAction.props.accessibilityLabel).toContain('Keep moving today');

    act(() => {
      hoyAction.props.onPress();
    });

    expect(mockRequireAccount).toHaveBeenCalledWith(
      {circleId: 'workout-circle', source: 'home', type: 'tapIn'},
      expect.any(Function),
    );
    expect(mockRootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'workout-circle',
      source: 'home',
    });
  });

  it('opens nudge and pending actions in Circle Detail without sending a nudge', () => {
    const circle = attentionCircle({
      id: 'morning-crew',
      nudgeTargetCount: 2,
      title: 'Morning Crew',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerTodayStatus: 'done',
    });

    setResolvedHoyAction({
      action: {
        circleMode: 'group',
        circleTitle: 'Morning Crew',
        isAtRisk: false,
        kind: 'nudge',
        remainingActionCount: 0,
      },
      circle,
    });

    const tree = renderScreenTree();

    act(() => {
      tree.root.findByProps({testID: 'home-hero-hoy-action'}).props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'morning-crew',
    });
    expect(nudgeCircleMembers).not.toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });
    mockRootNavigate.mockClear();

    const pendingCircle = attentionCircle({
      id: 'sleep-circle',
      title: 'Sleep Circle',
      viewerMembershipStatus: 'pending',
    });
    setResolvedHoyAction({
      action: {
        circleMode: 'group',
        circleTitle: 'Sleep Circle',
        isAtRisk: false,
        kind: 'pending_approval',
        remainingActionCount: 0,
      },
      circle: pendingCircle,
    });
    const pendingTree = renderScreenTree();

    act(() => {
      pendingTree.root
        .findByProps({testID: 'home-hero-hoy-action'})
        .props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'sleep-circle',
    });
    expect(nudgeCircleMembers).not.toHaveBeenCalled();
  });

  it('routes no-commitment and all-clear Hoy actions to their overview tabs', () => {
    setResolvedHoyAction({
      action: {
        isAtRisk: false,
        kind: 'no_commitments',
        remainingActionCount: 0,
      },
    });
    let tree = renderScreenTree();

    act(() => {
      tree.root.findByProps({testID: 'home-hero-hoy-action'}).props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Explore');

    act(() => {
      tree.unmount();
    });
    jest.clearAllMocks();

    setResolvedHoyAction({
      action: {
        isAtRisk: false,
        kind: 'momentum',
        remainingActionCount: 0,
      },
      circle: attentionCircle({
        remainingCheckIns: 0,
        state: 'done',
        viewerHasCheckedIn: true,
        viewerHasTappedInToday: true,
        viewerTodayStatus: 'done',
      }),
    });
    tree = renderScreenTree();

    act(() => {
      tree.root.findByProps({testID: 'home-hero-hoy-action'}).props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Momentum');
  });

  it('does not generate or activate Hoy before greeting context resolves', () => {
    const tree = renderScreenTree();
    const hoyAction = tree.root.findByProps({
      testID: 'home-hero-hoy-action',
    });

    expect(hoyAction.props.disabled).toBe(true);
    expect(generateHomeGreeting).not.toHaveBeenCalled();
  });

  it('uses flat dark hero surfaces without outlines', () => {
    mockAppearance = 'dark';

    const tree = renderScreenTree();
    const bubbleFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-bubble-fill'}).props.style,
    );
    const largeTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-large'}).props.style,
    );
    const smallTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-small'}).props.style,
    );

    expect(bubbleFillStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_DARK);
    expect(bubbleFillStyle.borderWidth).toBeUndefined();
    expect(largeTailDotStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_DARK);
    expect(largeTailDotStyle.borderWidth).toBeUndefined();
    expect(largeTailDotStyle.height).toBe(9);
    expect(largeTailDotStyle.width).toBe(9);
    expect(largeTailDotStyle.elevation).toBeUndefined();
    expect(smallTailDotStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_DARK);
    expect(smallTailDotStyle.borderWidth).toBeUndefined();
    expect(smallTailDotStyle.height).toBe(5);
    expect(smallTailDotStyle.width).toBe(5);
    expect(smallTailDotStyle.elevation).toBeUndefined();
  });

  it('renders recent Circle activity updates and opens their deeplink', () => {
    mockInboxEvents = [
      inboxEvent({
        feedCategory: 'companion',
        mediaImageUrl: 'https://example.com/tap-in.jpg',
      }),
      inboxEvent({
        body: 'Tap In to keep Morning Movers moving.',
        id: 'reminder-1',
        title: 'Reminder',
        type: 'tap_in_midday_reminder',
      }),
      inboxEvent({
        actor: {
          displayName: 'Kelvin',
          uid: 'user-1',
        },
        body: 'Kelvin reached a 7-day streak.',
        feedCategory: 'companion',
        id: 'self-1',
        title: 'Streak milestone',
        type: 'companion_streak_milestone',
      }),
    ];
    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('CIRCLE ACTIVITY');
    expect(output).toContain('Ari Runner');
    expect(output).toContain('tapped in for Morning Movers.');
    expect(output).not.toContain('Tap In to keep Morning Movers moving.');
    expect(output).not.toContain('Kelvin reached a 7-day streak.');

    const circleActivityLabel = tree.root
      .findAllByType(SectionEyebrow)
      .find(node => node.props.children === 'CIRCLE ACTIVITY');
    const attentionLabel = tree.root
      .findAllByType(SectionEyebrow)
      .find(node => node.props.children === 'Circles need your attention');
    const circleActivityCard = tree.root.findByType(ActivityFeedCard);

    expect(circleActivityLabel?.props.style).toEqual(
      attentionLabel?.props.style,
    );
    expect(circleActivityCard.props.density).toBe('compact');
    expect(StyleSheet.flatten(circleActivityCard.props.style)).toMatchObject({
      backgroundColor: HOME_NEUTRAL_SURFACE_LIGHT,
      borderWidth: 0,
    });
    expect(circleActivityCard.props.item.mediaImageUrl).toBe(
      'https://example.com/tap-in.jpg',
    );
    expect(
      tree.root.findAllByProps({testID: 'activity-feed-media-image'}).length,
    ).toBeGreaterThan(0);

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

  it('uses the Momentum status palette in the full-width Home momentum bar', () => {
    mockMomentumSummary = momentumSummary({
      label: 'Building',
      percentage: 35,
      rollingMomentum: {
        hasUnrecoveredMiss: false,
        percentage: 30,
        resolvedOpportunityCount: 3,
        status: 'building_momentum',
        windowDays: 14,
      },
      status: 'building_momentum',
    });

    const tree = renderScreenTree();
    expect(
      tree.root.findByProps({testID: 'home-momentum-stage-icon'}).props.status,
    ).toBe('building_momentum');
    const barFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-fill'}).props.style,
    );
    const barTrackStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-track'}).props.style,
    );
    const momentumBarStyle = StyleSheet.flatten(
      tree.root
        .findByProps({testID: 'home-momentum-bar'})
        .props.style({pressed: false}),
    );

    expect(barFillStyle.backgroundColor).toBe(brandColors.orange);
    expect(barFillStyle.width).toBe('30%');
    expect(barTrackStyle.backgroundColor).toBe(HOME_NEUTRAL_SURFACE_LIGHT);
    expect(momentumBarStyle.width).toBe('100%');
    expect(
      tree.root.findAllByProps({
        testID: 'circle-summary-contribution-disc',
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'circle-summary-momentum-disc'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'circle-summary-streak-disc'}),
    ).toHaveLength(0);
    const textLabels = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    expect(textLabels).toContain('30% MOMENTUM');
    expect(
      tree.root.findAllByProps({testID: 'home-momentum-bar-label'}),
    ).toHaveLength(0);
    const momentumValueStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-value'}).props.style,
    );
    expect(momentumValueStyle.color).toBe('#9A9ABC');
    expect(
      tree.root.findByProps({accessibilityLabel: '14-day momentum, 30%'}),
    ).toBeTruthy();
  });

  it('shows the raw rolling score in the relocated Home momentum bar', () => {
    mockMomentumSummary = momentumSummary({
      rollingMomentum: {
        hasUnrecoveredMiss: false,
        percentage: 100,
        resolvedOpportunityCount: 2,
        status: 'getting_started',
        windowDays: 14,
      },
    });

    const tree = renderScreenTree();
    const textLabels = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    const barFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-momentum-bar-fill'}).props.style,
    );

    expect(
      tree.root.findByProps({accessibilityLabel: '14-day momentum, 100%'}),
    ).toBeTruthy();
    expect(textLabels).not.toContain('Getting Started · 2 of 3');
    expect(barFillStyle.width).toBe('100%');
  });

  it('renders Your Progress circles with state-based frosted styling', () => {
    mockHomeData = {
      ...homeData(),
      progressDays: [
        {dateKey: '2026-05-24', label: '24', state: 'done'},
        {dateKey: '2026-05-25', label: '25', state: 'missed'},
        {dateKey: '2026-05-26', label: '26', state: 'today'},
        {dateKey: '2026-05-27', label: '27', state: 'future'},
      ],
    };

    const tree = renderScreenTree();
    const doneChipStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'week-progress-2026-05-24-chip'}).props
        .style,
    );
    const todayChipStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'week-progress-2026-05-26-chip'}).props
        .style,
    );
    const futureChipStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'week-progress-2026-05-27-chip'}).props
        .style,
    );
    const textLabels = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);

    expect(doneChipStyle.height).toBe(32);
    expect(doneChipStyle.width).toBe(32);
    expect(doneChipStyle.borderRadius).toBe(16);
    expect(doneChipStyle.backgroundColor).toBe('#22A565');
    expect(doneChipStyle.borderWidth).toBe(0);
    expect(todayChipStyle.backgroundColor).toBe('rgba(245,166,35,0.16)');
    expect(todayChipStyle.borderColor).toBe('#F5A623');
    expect(todayChipStyle.borderWidth).toBe(2);
    expect(futureChipStyle.backgroundColor).toBe('rgba(226,232,240,0.72)');
    expect(futureChipStyle.borderColor).toBe('rgba(148,163,184,0.42)');
    expect(futureChipStyle.borderWidth).toBe(1.25);
    expect(textLabels).toEqual(
      expect.arrayContaining(['Sun', 'Mon', 'Tue', 'Wed']),
    );
  });

  it('focuses Home commitments as a stacked list and routes its actions', () => {
    (getTodayAttentionCircles as jest.Mock).mockReturnValue([
      attentionCircle(),
      attentionCircle({
        id: 'circle-second',
        title: 'Morning Walk',
      }),
    ]);
    mockHomeData = {
      ...homeData(),
      circles: [
        attentionCircle(),
        attentionCircle({id: 'circle-second', title: 'Morning Walk'}),
      ],
      membershipCount: 2,
    };

    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('YOUR COMMITMENTS');
    expect(
      tree.root.findByProps({
        testID: 'home-commitment-focused-circle-attention',
      }),
    ).toBeTruthy();

    act(() => {
      tree.root
        .findByProps({testID: 'home-commitment-collapsed-circle-second'})
        .props.onPress();
    });

    expect(
      tree.root.findByProps({
        testID: 'home-commitment-focused-circle-second',
      }),
    ).toBeTruthy();

    act(() => {
      tree.root
        .findByProps({testID: 'home-commitment-details-circle-second'})
        .props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'circle-second',
    });

    (getHomeCircleActionVariant as jest.Mock).mockReturnValue('check_in');

    act(() => {
      tree.root
        .findByProps({testID: 'home-commitment-check-circle-second'})
        .props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'circle-second',
      source: 'home',
    });
  });
});
