import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HomeActivityRow} from '../src/features/home/components/HomeSurfaces';
import {HomeButton as HoystButton} from '../src/features/home/components/HomeSurfaces';
import {WeekProgressStrip} from '../src/design/components/WeekProgressStrip';
import {HomeScreen} from '../src/features/home/screens/HomeScreen';
import {
  HomeDailyActionProgress,
  HomeProgress,
  HomeWeekPath,
} from '../src/features/home/components/HomeProgress';
import {getHomeMessageParts} from '../src/design/components/HomeHeroHeader';
import type {HomeData} from '../src/features/home/services/home-data-service';
import {
  subscribeToHomeData,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomePrimaryAction,
  getTodayAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
} from '../src/features/home/services/home-data-service';
import {generateHomeGreeting} from '../src/features/home/services/home-greeting-service';
import {nudgeCircleMembers} from '../src/features/circles/services/circle-service';
import {
  navigateToAuthSignIn,
  navigateToAuthWelcome,
} from '../src/navigation/auth-modal-navigation';
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
  ExploreCircle,
  InboxEvent,
  MomentumSummary,
} from '../src/types/models';

const mockNavigate = jest.fn();
const mockRootNavigate = jest.fn();
const mockBeginAuthFlow = jest.fn();
const mockClearPendingAction = jest.fn();
const mockSetOnboardingStep = jest.fn();
const mockStartOnboardingWizard = jest.fn();
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
let mockPublicCircles: ExploreCircle[] = [];

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
      beginAuthFlow: mockBeginAuthFlow,
      clearPendingAction: mockClearPendingAction,
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
      setCurrentStep: mockSetOnboardingStep,
      startOnboardingWizard: mockStartOnboardingWizard,
    }),
}));

jest.mock('../src/features/auth/hooks/useProtectedAction', () => ({
  useProtectedAction: () => mockRequireAccount,
}));

jest.mock('../src/navigation/auth-modal-navigation', () => ({
  navigateToAuthSignIn: jest.fn(),
  navigateToAuthWelcome: jest.fn(),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  nudgeCircleMembers: jest.fn(() => Promise.resolve({nudged: 0})),
}));

jest.mock('../src/features/circles/services/public-circle-service', () => ({
  subscribeToPublicCircles: jest.fn(
    (onCircles: (circles: ExploreCircle[]) => void) => {
      onCircles(mockPublicCircles);
      return jest.fn();
    },
  ),
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

function publicCircle(overrides: Partial<ExploreCircle> = {}): ExploreCircle {
  return {
    category: 'Fitness',
    circleMode: 'group',
    commitment: 'Move for 30 minutes every day',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    completionRate: 88,
    id: 'public-circle-1',
    joinLabel: 'Open seats',
    joinMode: 'open',
    matchCopy: 'A welcoming daily movement circle.',
    maxSize: 10,
    memberCount: 4,
    members: [
      {
        id: 'member-1',
        initials: 'AR',
        name: 'Ari Runner',
        state: 'done',
      },
    ],
    privacy: 'public',
    streakLabel: 'Moving together',
    title: 'Morning Movers',
    ...overrides,
  };
}

const mountedScreens: renderer.ReactTestRenderer[] = [];

function renderScreenTree() {
  let screen: renderer.ReactTestRenderer | undefined;

  act(() => {
    screen = renderer.create(<HomeScreen />);
  });

  mountedScreens.push(screen!);
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
  afterEach(() => {
    act(() => mountedScreens.splice(0).forEach(screen => screen.unmount()));
  });
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
    mockPublicCircles = [];
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
    expect(output).toContain('Circle activity');
    expect(output).toContain('No Circle activity yet');
    expect(output.indexOf('Circle activity')).toBeGreaterThan(
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

  it('makes the guest Home a commitment launchpad with public discovery', () => {
    mockSessionStatus = 'guest';
    mockSessionUser = undefined;
    mockPublicCircles = [publicCircle()];

    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());
    const startButton = tree.root.findByProps({
      testID: 'guest-home-start-commitment',
    });
    const starterArtwork = tree.root.findByProps({
      testID: 'guest-home-get-started-artwork',
    });

    expect(tree.root.findByProps({testID: 'home-week-path'})).toBeTruthy();
    expect(output).toContain('Your first streak starts with one Tap In.');
    expect(output).not.toContain('0 days');
    expect(output).not.toContain('0% MOMENTUM');
    expect(output).toContain('Get started');
    expect(output).toContain('Create a Circle. Invite your people.');
    expect(output).toContain('Discover a circle');
    expect(output).toContain('Morning Movers');
    expect(startButton).toBeTruthy();
    expect(starterArtwork.props.accessible).toBe(false);

    act(() => {
      startButton.props.onPress();
    });

    expect(mockBeginAuthFlow).toHaveBeenCalledTimes(1);
    expect(mockStartOnboardingWizard).toHaveBeenCalledTimes(1);
    expect(navigateToAuthWelcome).toHaveBeenCalledTimes(1);

    act(() => {
      tree.root.findByProps({testID: 'guest-home-log-in-link'}).props.onPress();
    });

    expect(navigateToAuthSignIn).toHaveBeenCalledTimes(1);

    act(() => {
      tree.root.findByProps({testID: 'home-hero-hoy-action'}).props.onPress();
    });

    expect(mockStartOnboardingWizard).toHaveBeenCalledTimes(2);

    act(() => {
      tree.root
        .findByProps({testID: 'guest-home-featured-circle'})
        .props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('CircleDetail', {
      circleId: 'public-circle-1',
    });

    act(() => {
      tree.root
        .findByProps({testID: 'guest-home-explore-all-link'})
        .props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Explore');
  });

  it('includes personal commitments in the Home stack', () => {
    mockHomeData = {
      ...homeData(),
      hasResolvedGreetingContext: true,
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

    expect(output).toContain('Your commitments');
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
    const content = tree.root.findByProps({
      testID: 'all-my-commitments-link-content',
    });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      gap: 12,
      minHeight: 44,
    });
    const label = tree.root.findByProps({testID: 'all-my-commitments-label'});
    expect(StyleSheet.flatten(label.props.style).color).toBe('#4D5873');
    act(() =>
      tree.root
        .findByProps({testID: 'all-my-commitments-link'})
        .props.onPress(),
    );
    expect(mockRootNavigate).toHaveBeenCalledWith('Circles');
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
    expect(
      tree.root.findAll(
        node =>
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#FAFAF7',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({testID: 'solid-panel-surface'}),
    ).toHaveLength(0);
  });

  it('places the week in Home and the notification bell in the header', () => {
    mockHomeData = {...homeData(), hasResolvedGreetingContext: true};
    const tree = renderScreenTree();
    const section = tree.root.findByProps({testID: 'home-progress-section'});
    expect(
      section.findAllByProps({testID: 'home-week-path'}).length,
    ).toBeGreaterThan(0);
    expect(
      section.findAllByProps({testID: 'home-hero-notification-button'}),
    ).toHaveLength(0);
    expect(tree.root.findAllByType(WeekProgressStrip)).toHaveLength(0);
  });

  it('uses a flat warm-neutral dark canvas and containers', () => {
    mockAppearance = 'dark';
    const tree = renderScreenTree();
    expect(
      tree.root.findAll(
        node =>
          StyleSheet.flatten(node.props.style)?.backgroundColor === '#121212',
      ).length,
    ).toBeGreaterThan(0);
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
    const action = tree.root.findByProps({testID: 'home-hero-hoy-action'});
    expect(action.props.disabled).toBe(true);
    expect(action.props.accessibilityLabel).toBe(
      'Hoy is getting your next action ready.',
    );
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      shadowRadius: 12,
    });
    expect(
      tree.root.findAllByProps({testID: 'home-hero-tail-dot-large'}),
    ).toHaveLength(0);
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
    ).toBe('9+');
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

  it('does not generate Hoy or offer card actions before greeting context resolves', () => {
    mockHomeData = {...homeData(), circles: [attentionCircle()]};
    const tree = renderScreenTree();
    const hoyAction = tree.root.findByProps({
      testID: 'home-hero-hoy-action',
    });

    expect(hoyAction.props.disabled).toBe(true);
    expect(generateHomeGreeting).not.toHaveBeenCalled();
    expect(
      tree.root.findAllByProps({testID: 'home-commitments-stack'}),
    ).toHaveLength(0);
  });

  it('uses flat dark hero surfaces without outlines', () => {
    mockAppearance = 'dark';
    const tree = renderScreenTree();
    const action = tree.root.findByProps({testID: 'home-hero-hoy-action'});
    expect(StyleSheet.flatten(action.props.style).backgroundColor).toBe(
      '#252527',
    );
    expect(
      tree.root.findByProps({testID: 'home-hoy-context-tint'}).props.colors[0],
    ).toMatch(/26$/);
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

    expect(output).toContain('Circle activity');
    expect(output).toContain('Ari Runner');
    expect(output).toContain('tapped in for Morning Movers.');
    expect(output).not.toContain('Tap In to keep Morning Movers moving.');
    expect(output).not.toContain('Kelvin reached a 7-day streak.');

    const circleActivityCard = tree.root.findByType(HomeActivityRow);
    expect(circleActivityCard.props.item.mediaImageUrl).toBe(
      'https://example.com/tap-in.jpg',
    );
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'home-activity-avatar'}).props.style,
      ),
    ).toMatchObject({
      alignSelf: 'flex-start',
      borderRadius: 14,
      height: 28,
      width: 28,
    });
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Activity photo'}).length,
    ).toBeGreaterThan(0);

    const eventPressable = tree.root.findByType(HomeActivityRow);

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
    mockHomeData = {
      ...homeData(),
      hasResolvedGreetingContext: true,
      circles: [attentionCircle()],
    };
    const tree = renderScreenTree();
    const progress = tree.root.findByProps({
      testID: 'home-daily-action-progress',
    });
    expect(progress.props.accessibilityValue).toMatchObject({now: 0, max: 1});
    act(() =>
      tree.root.findByProps({testID: 'home-momentum-bar'}).props.onPress(),
    );
    expect(mockNavigate).toHaveBeenCalledWith('Momentum');
  });

  it('places icon-free daily action progress beneath Your commitments', () => {
    mockHomeData = {
      ...homeData(),
      hasResolvedGreetingContext: true,
      circles: [attentionCircle()],
    };
    const tree = renderScreenTree();
    const dailyProgress = tree.root.findByType(HomeDailyActionProgress);
    const momentumProgress = tree.root.findByType(HomeProgress);
    const progressbar = tree.root.findByProps({
      testID: 'home-daily-action-progress',
    });

    expect(
      dailyProgress.parent?.findAll(
        node => node.props.children === 'Your commitments',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      momentumProgress.findAllByProps({testID: 'home-daily-action-progress'}),
    ).toHaveLength(0);
    expect(progressbar.props.accessibilityLabel).toBe('1 action needed today');
    expect(
      dailyProgress.findAllByProps({
        testID: 'home-daily-action-progress-track',
      }).length,
    ).toBeGreaterThan(0);
    const output = JSON.stringify(tree.toJSON());
    expect(output).not.toContain('Tap In remaining');
    expect(output).not.toContain('Tap Ins remaining');
  });

  it('shows the raw rolling score in the relocated Home momentum bar', () => {
    mockHomeData = {...homeData(), hasResolvedGreetingContext: true};
    mockMomentumSummary = {
      rollingMomentum: {percentage: 30, status: 'building_momentum'},
    } as MomentumSummary;
    const tree = renderScreenTree();
    expect(
      tree.root.findByProps({testID: 'home-momentum-bar'}).props
        .accessibilityLabel,
    ).toContain('30%');
    expect(
      tree.root.findByProps({testID: 'home-daily-action-progress'}).props
        .accessibilityLabel,
    ).toBe('No actions needed today');
  });

  it('uses the Home week path without changing shared week strips', () => {
    mockHomeData = {...homeData(), hasResolvedGreetingContext: true};
    const tree = renderScreenTree();
    const path = tree.root.findByProps({testID: 'home-week-path'});
    expect(path).toBeTruthy();
    expect(tree.root.findAllByType(WeekProgressStrip)).toHaveLength(0);
  });

  it('bolds only the supplied name and commitment without changing the message', () => {
    const message = 'Phil, Building Hoyst needs your Tap In today.';
    expect(getHomeMessageParts(message, ['Phil', 'Building Hoyst'])).toEqual([
      {text: 'Phil', bold: true},
      {text: ', ', bold: false},
      {text: 'Building Hoyst', bold: true},
      {text: ' needs your Tap In today.', bold: false},
    ]);
    expect(
      getHomeMessageParts(message, ['Not present'])
        .map(part => part.text)
        .join(''),
    ).toBe(message);
  });

  it('shows saved partial quantity progress instead of a missed marker', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <HomeWeekPath
          days={[
            {
              dateKey: '2026-09-07',
              label: 'Mon',
              state: 'missed',
              quantityValue: 3,
              quantityLabel: '3',
            },
          ]}
        />,
      );
    });
    expect(
      tree.root.findByProps({testID: 'home-week-partial-2026-09-07'}),
    ).toBeTruthy();
    expect(JSON.stringify(tree.toJSON())).toContain(
      'partial progress, 3 logged',
    );
    act(() => tree.unmount());
  });

  it.each([0, 3])(
    'credits only a positive Nudge response (%s targets) and blocks duplicate submissions',
    async nudged => {
      mockHomeData = {
        ...homeData(),
        hasResolvedGreetingContext: true,
        circles: [
          attentionCircle({viewerHasTappedInToday: true, nudgeTargetCount: 3}),
        ],
      };
      let finish!: (result: {nudged: number}) => void;
      (nudgeCircleMembers as jest.Mock).mockReturnValueOnce(
        new Promise(resolve => {
          finish = resolve;
        }),
      );
      const tree = renderScreenTree();
      const action = tree.root.findByProps({
        testID: 'home-commitment-action-circle-attention',
      });
      act(() => {
        action.props.onPress();
        action.props.onPress();
      });
      expect(nudgeCircleMembers).toHaveBeenCalledTimes(1);
      expect(
        tree.root.findByProps({testID: 'home-daily-action-progress'}).props
          .accessibilityValue.now,
      ).toBe(1);
      await act(async () => {
        finish({nudged});
      });
      expect(
        tree.root.findByProps({testID: 'home-daily-action-progress'}).props
          .accessibilityValue.now,
      ).toBe(nudged ? 2 : 1);
    },
  );

  it('retains the unfinished Nudge after a failed request', async () => {
    mockHomeData = {
      ...homeData(),
      hasResolvedGreetingContext: true,
      circles: [
        attentionCircle({viewerHasTappedInToday: true, nudgeTargetCount: 1}),
      ],
    };
    (nudgeCircleMembers as jest.Mock).mockRejectedValueOnce(
      new Error('Unavailable'),
    );
    const tree = renderScreenTree();
    await act(async () => {
      tree.root
        .findByProps({testID: 'home-commitment-action-circle-attention'})
        .props.onPress();
    });
    expect(
      tree.root.findByProps({testID: 'home-daily-action-progress'}).props
        .accessibilityValue.now,
    ).toBe(1);
    expect(
      tree.root.findByProps({testID: 'home-commitment-action-circle-attention'})
        .props.disabled,
    ).toBe(false);
  });

  it('clears the previous account content while the next account subscription resolves', () => {
    mockHomeData = {
      ...homeData(),
      hasResolvedGreetingContext: true,
      circles: [attentionCircle({title: 'First account private commitment'})],
    };
    const tree = renderScreenTree();
    expect(JSON.stringify(tree.toJSON())).toContain(
      'First account private commitment',
    );
    (subscribeToHomeData as jest.Mock).mockImplementationOnce(() => jest.fn());
    mockSessionUser = {uid: 'user-2', providerIds: []};
    act(() => tree.update(<HomeScreen />));
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      'First account private commitment',
    );
    expect(
      tree.root.findAllByProps({testID: 'home-daily-action-progress'}),
    ).toHaveLength(0);
  });

  it('restarts a failed subscription through Retry without reporting completion', () => {
    (subscribeToHomeData as jest.Mock).mockImplementation(({onError}) => {
      onError();
      return jest.fn();
    });
    const tree = renderScreenTree();
    expect(JSON.stringify(tree.toJSON())).toContain('Could not load Home');
    expect(
      tree.root.findAllByProps({testID: 'home-daily-action-progress'}),
    ).toHaveLength(0);
    (subscribeToHomeData as jest.Mock).mockImplementation(({onData}) => {
      onData(mockHomeData);
      return jest.fn();
    });
    const retry = tree.root
      .findAllByType(HoystButton)
      .find(node => node.props.label === 'Retry');
    expect(retry).toBeTruthy();
    const previousCalls = (subscribeToHomeData as jest.Mock).mock.calls.length;
    act(() => retry?.props.onPress());
    expect(
      (subscribeToHomeData as jest.Mock).mock.calls.length,
    ).toBeGreaterThan(previousCalls);
  });

  it('preserves deliberate completed and pending expansion and advances when focused work finishes', () => {
    const first = attentionCircle();
    const second = attentionCircle({id: 'second'});
    const done = attentionCircle({
      id: 'done',
      viewerHasTappedInToday: true,
      nudgeTargetCount: 0,
    });
    const pending = attentionCircle({
      id: 'pending',
      viewerMembershipStatus: 'pending',
    });
    mockHomeData = {
      ...homeData(),
      circles: [first, second, done, pending],
      membershipCount: 4,
      hasResolvedGreetingContext: true,
    };
    const tree = renderScreenTree();
    const push = (circles: typeof mockHomeData.circles) => {
      const subscription = (subscribeToHomeData as jest.Mock).mock.calls.at(
        -1,
      )[0];
      act(() => subscription.onData({...mockHomeData, circles}));
    };
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-expand-done'})
        .props.onPress(),
    );
    push([first, second, done, pending]);
    expect(
      tree.root.findByProps({testID: 'home-commitment-focused-done'}),
    ).toBeTruthy();
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-collapsed-pending'})
        .props.onPress(),
    );
    push([first, second, done, pending]);
    expect(
      tree.root.findByProps({testID: 'home-commitment-focused-pending'}),
    ).toBeTruthy();
    act(() =>
      tree.root
        .findByProps({testID: 'home-commitment-collapsed-circle-attention'})
        .props.onPress(),
    );
    const finishedFirst = {
      ...first,
      viewerHasTappedInToday: true,
      nudgeTargetCount: 0,
    };
    push([finishedFirst, second, done, pending]);
    expect(
      tree.root.findByProps({testID: 'home-commitment-focused-second'}),
    ).toBeTruthy();
    push([
      finishedFirst,
      {...second, viewerHasTappedInToday: true, nudgeTargetCount: 0},
      done,
      pending,
    ]);
    expect(
      tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('home-commitment-focused-'),
      ),
    ).toHaveLength(0);
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
      hasResolvedGreetingContext: true,
    };

    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('Your commitments');
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
        .findByProps({testID: 'home-commitment-action-circle-second'})
        .props.onPress();
    });

    expect(mockRootNavigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'circle-second',
      source: 'home',
    });
  });
});
