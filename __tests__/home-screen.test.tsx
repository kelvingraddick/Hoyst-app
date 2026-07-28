import React from 'react';
import {Pressable, ScrollView, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {ActivityFeedCard} from '../src/design/components/ActivityFeedCard';
import {FrostedBackdrop} from '../src/design/components/FrostedBackdrop';
import {GlassPanel} from '../src/design/components/GlassPanel';
import {HoystButton} from '../src/design/components/HoystButton';
import {SectionEyebrow} from '../src/design/components/SectionEyebrow';
import {brandColors} from '../src/design/tokens/colors';
import {HomeScreen} from '../src/features/home/screens/HomeScreen';
import type {HomeData} from '../src/features/home/services/home-data-service';
import {
  getTodayAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
} from '../src/features/home/services/home-data-service';
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

const mockNavigate = jest.fn();
const mockRootNavigate = jest.fn();
const mockRequireAccount = jest.fn(
  (_pendingAction: unknown, onReady: () => void) => onReady(),
);

let mockHomeData: HomeData;
let mockInboxEvents: InboxEvent[];
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
    membershipCount: 0,
    personalStreakDays: 0,
    progressDays: [],
    progressPercent: 0,
    todayDateKey: '2026-05-26',
    todayLabel: 'Today',
  })),
  getHomeCircleActionVariant: jest.fn(() => 'view'),
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
    timeWindow: 'morning',
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

describe('HomeScreen companion updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHomeData = homeData();
    mockInboxEvents = [];
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
    (shouldShowAuthenticatedHomeEmptyState as jest.Mock).mockReturnValue(false);
  });

  it('subscribes to inbox events and renders empty companion feed at the bottom', () => {
    const output = renderScreen();

    expect(subscribeToInboxEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        onEvents: expect.any(Function),
        uid: 'user-1',
      }),
    );
    expect(output).toContain('COMPANION FEED');
    expect(output).toContain('No companion feed yet');
    expect(output.indexOf('COMPANION FEED')).toBeGreaterThan(
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

    expect(output).toContain('PERSONAL COMMITMENTS');
    expect(output).toContain('Read every day');
    expect(output).toContain('Personal');
    expect(output).not.toContain('1/1 members');
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

  it('renders the all-my-circles action with the shared dashed card style', () => {
    const tree = renderScreenTree();
    const allMyCirclesCard = tree.root
      .findAllByProps({testID: 'all-my-circles-card'})
      .find(node => node.props.style);
    const allMyCirclesTitleStyle = tree.root
      .findAll(node => node.props.children === 'All my commitments')
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 15);
    const allMyCirclesSubtitleStyle = tree.root
      .findAll(
        node => node.props.children === 'View commitments and join requests',
      )
      .map(node => StyleSheet.flatten(node.props.style))
      .find(style => style?.fontSize === 14);

    expect(JSON.stringify(tree.toJSON())).toContain('All my commitments');
    expect(JSON.stringify(tree.toJSON())).toContain(
      'View commitments and join requests',
    );
    expect(allMyCirclesCard).toBeTruthy();
    expect(StyleSheet.flatten(allMyCirclesCard?.props.style)).toMatchObject({
      borderRadius: 24,
      borderStyle: 'dashed',
      borderWidth: 1.25,
      flexDirection: 'row',
      gap: 14,
      minHeight: 78,
      paddingHorizontal: 18,
      paddingVertical: 12,
    });
    expect(allMyCirclesTitleStyle).toMatchObject({
      fontSize: 15,
      lineHeight: 18,
    });
    expect(allMyCirclesSubtitleStyle).toMatchObject({
      fontSize: 14,
      lineHeight: 17,
    });
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

  it('renders the frosted backdrop behind glass Home sections', () => {
    const tree = renderScreenTree();

    expect(tree.root.findAllByType(FrostedBackdrop)).toHaveLength(1);
    expect(tree.root.findAllByType(GlassPanel).length).toBeGreaterThanOrEqual(
      6,
    );
  });

  it('uses a thinner dark blur material with a translucent tint on Home glass sections', () => {
    mockAppearance = 'dark';

    const tree = renderScreenTree();
    const glassBlur = tree.root.findAllByProps({testID: 'glass-panel-blur'});
    const glassTint = tree.root.findAllByProps({testID: 'glass-panel-tint'});

    expect(glassBlur.length).toBeGreaterThanOrEqual(6);
    expect(glassTint.length).toBeGreaterThanOrEqual(6);
    glassBlur.forEach(node => {
      expect(node.props.blurType).toBe('thinMaterialDark');
    });
    glassTint.forEach(node => {
      expect(StyleSheet.flatten(node.props.style).backgroundColor).toBe(
        'rgba(18,20,34,0.38)',
      );
    });
  });

  it('keeps the lifted hero bubble and replaces the avatar with Hoy', () => {
    const tree = renderScreenTree();
    const bubbleSurfaceStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-bubble-surface'}).props.style,
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
    const hoyButton = tree.root.findByProps({
      testID: 'home-hero-hoy-button',
    });
    const unreadBadgeStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-hoy-unread-badge'}).props
        .style,
    );

    expect(bubbleSurfaceStyle.elevation).toBe(4);
    expect(bubbleSurfaceStyle.shadowOffset).toEqual({height: 7, width: 0});
    expect(bubbleSurfaceStyle.shadowOpacity).toBe(0.72);
    expect(bubbleSurfaceStyle.shadowRadius).toBe(18);
    expect(hoyPlaceholderStyle.height).toBe(52);
    expect(hoyPlaceholderStyle.width).toBe(52);
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
    expect(largeTailDotStyle.backgroundColor).toBe('rgba(255,255,255,0.6)');
    expect(largeTailDotStyle.borderWidth).toBe(1);
    expect(largeTailDotStyle.borderColor).toBe('rgba(255,255,255,0)');
    expect(largeTailDotStyle.elevation).toBe(4);
    expect(largeTailDotStyle.shadowOffset).toEqual({height: 6, width: 0});
    expect(largeTailDotStyle.shadowOpacity).toBe(0.64);
    expect(largeTailDotStyle.shadowRadius).toBe(12);
    expect(smallTailDotStyle.backgroundColor).toBe('rgba(255,255,255,0.6)');
    expect(smallTailDotStyle.borderWidth).toBe(1);
    expect(smallTailDotStyle.borderColor).toBe('rgba(255,255,255,0)');
    expect(smallTailDotStyle.elevation).toBe(3);
    expect(smallTailDotStyle.shadowOffset).toEqual({height: 5, width: 0});
    expect(smallTailDotStyle.shadowOpacity).toBe(0.58);
    expect(smallTailDotStyle.shadowRadius).toBe(10);
    expect(hoyButton.props.accessibilityRole).toBe('button');
    expect(hoyButton.props.accessibilityLabel).toBe(
      'Hoy is getting ready. Open Inbox.',
    );
    expect(unreadBadgeStyle).toMatchObject({
      backgroundColor: brandColors.red,
      borderRadius: 11,
      bottom: -3,
      height: 22,
      right: -3,
      width: 22,
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
    expect(output).not.toContain('Start making Progression');
  });

  it('mounts the final Hoy face directly after initial Home resolution', async () => {
    mockHomeData = {
      ...homeData(),
      hasLoadedMemberships: true,
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
        testID: 'home-hero-hoy-orb-default-image',
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

  it('consumes a covered Tap In celebration only after Hoy resolves', async () => {
    jest.useFakeTimers();
    mockHomeData = {
      ...homeData(),
      hasLoadedMemberships: true,
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
        testID: 'home-hero-hoy-orb-default-image',
      }),
    ).not.toHaveLength(0);

    act(() => {
      tree!.unmount();
    });
    jest.useRealTimers();
  });

  it('keeps Hoy wired to unread clearing and Inbox navigation', () => {
    const tree = renderScreenTree();
    const hoyButton = tree.root.findByProps({
      testID: 'home-hero-hoy-button',
    });

    act(() => {
      hoyButton.props.onPress();
    });

    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(1);
    expect(mockRootNavigate).toHaveBeenCalledWith('Inbox');
  });

  it('keeps the hero tail dots visible in dark mode', () => {
    mockAppearance = 'dark';

    const tree = renderScreenTree();
    const largeTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-large'}).props.style,
    );
    const smallTailDotStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'home-hero-tail-dot-small'}).props.style,
    );

    expect(largeTailDotStyle.backgroundColor).toBe('rgba(74,77,116,0.78)');
    expect(largeTailDotStyle.borderColor).toBe('rgba(255,255,255,0.20)');
    expect(largeTailDotStyle.borderWidth).toBe(1);
    expect(largeTailDotStyle.height).toBe(12);
    expect(largeTailDotStyle.width).toBe(12);
    expect(largeTailDotStyle.elevation).toBe(4);
    expect(largeTailDotStyle.shadowOpacity).toBe(0.64);
    expect(smallTailDotStyle.backgroundColor).toBe('rgba(74,77,116,0.78)');
    expect(smallTailDotStyle.borderColor).toBe('rgba(255,255,255,0.20)');
    expect(smallTailDotStyle.borderWidth).toBe(1);
    expect(smallTailDotStyle.height).toBe(7);
    expect(smallTailDotStyle.width).toBe(7);
    expect(smallTailDotStyle.elevation).toBe(3);
    expect(smallTailDotStyle.shadowOpacity).toBe(0.58);
  });

  it('renders recent companion feed updates and opens their deeplink', () => {
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

    expect(output).toContain('COMPANION FEED');
    expect(output).toContain('Ari Runner');
    expect(output).toContain('tapped in for Morning Movers.');
    expect(output).not.toContain('Tap In to keep Morning Movers moving.');
    expect(output).not.toContain('Kelvin reached a 7-day streak.');

    const companionLabel = tree.root
      .findAllByType(SectionEyebrow)
      .find(node => node.props.children === 'COMPANION FEED');
    const attentionLabel = tree.root
      .findAllByType(SectionEyebrow)
      .find(node => node.props.children === 'Circles need your attention');
    const companionCard = tree.root.findByType(ActivityFeedCard);

    expect(companionLabel?.props.style).toEqual(attentionLabel?.props.style);
    expect(companionCard.props.density).toBe('compact');
    expect(companionCard.props.item.mediaImageUrl).toBe(
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
    const contributionArtwork = tree.root.findByProps({
      testID: 'circle-summary-contribution-artwork',
    });
    const contributionSideLeft = tree.root.findByProps({
      testID: 'circle-summary-contribution-side-left',
    });
    const contributionSideRight = tree.root.findByProps({
      testID: 'circle-summary-contribution-side-right',
    });
    const contributionBadge = tree.root.findByProps({
      testID: 'circle-summary-contribution-badge',
    });
    const contributionCheck = tree.root.findByProps({
      testID: 'circle-summary-contribution-check',
    });
    const streakIcon = tree.root.findByProps({
      testID: 'circle-summary-streak-icon',
    });

    expect(barFillStyle.backgroundColor).toBe(brandColors.orange);
    expect(contributionDiscStyle.backgroundColor).toBe('#E8F8EF');
    expect(momentumDiscStyle.backgroundColor).toBe('#FFF3DF');
    expect(streakDiscStyle.backgroundColor).toBe('#FFF3CF');
    expect(barKnobStyle.backgroundColor).toBe('#FFF3DF');
    expect(barKnobStyle.borderWidth).toBeUndefined();
    expect(contributionIcon.props.height).toBe(28);
    expect(contributionIcon.props.width).toBe(28);
    expect(contributionArtwork.props.transform).toBe('translate(0 -4)');
    expect(contributionSideLeft.props.fill).toBe('#0E9B57');
    expect(contributionSideLeft.props.opacity).toBe(0.5);
    expect(contributionSideRight.props.fill).toBe('#0E9B57');
    expect(contributionSideRight.props.opacity).toBe(0.5);
    expect(contributionBadge.props.fill).toBe(brandColors.green);
    expect(contributionCheck.props.stroke).toBe('#FFFFFF');
    expect(contributionCheck.props.strokeWidth).toBe(4.2);
    expect(streakIcon.props.height).toBe(28);
    expect(streakIcon.props.width).toBe(28);
    const textLabels = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    expect(textLabels).toContain('Streak');
    expect(textLabels).toContain('0 days');
    expect(textLabels).not.toContain('Streak (0 Days!)');
    expect(textLabels).toContain('Building');
  });

  it('renders Your week day circles with state-based frosted styling', () => {
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
  });

  it('renders Home attention circles as horizontal peek cards with title spacing', () => {
    (getTodayAttentionCircles as jest.Mock).mockReturnValue([
      attentionCircle(),
    ]);
    mockHomeData = {
      ...homeData(),
      circles: [attentionCircle()],
      membershipCount: 1,
    };

    const tree = renderScreenTree();
    const output = JSON.stringify(tree.toJSON());
    const attentionScroll = tree.root.findByProps({
      testID: 'home-attention-scroll',
    });
    const attentionSectionStyle = StyleSheet.flatten(
      attentionScroll.parent?.props.style,
    );

    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('Sleep 8 hours in a day');
    expect(attentionScroll.type).toBe(ScrollView);
    expect(attentionScroll.props.horizontal).toBe(true);
    expect(attentionSectionStyle.gap).toBe(14);
  });
});
