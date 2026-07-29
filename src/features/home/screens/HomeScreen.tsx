import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {UsersRound} from 'lucide-react-native';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {CircleSummaryRings} from '../../../design/components/CircleSummaryRings';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HomeHeroHeader} from '../../../design/components/HomeHeroHeader';
import {HoystButton} from '../../../design/components/HoystButton';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {WeekProgressStrip} from '../../../design/components/WeekProgressStrip';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {getHomeHeroCopy} from '../services/home-hero-copy';
import {
  createEmptyHomeData,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomePrimaryAction,
  getNextHomeActionBoundary,
  getTodayAttentionCircles,
  getUpcomingAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeDataErrorPanel,
  subscribeToHomeData,
  type HomeData,
} from '../services/home-data-service';
import {
  buildHomeGreetingCacheKey,
  clearExpiredHomeGreetingCacheEntries,
  generateHomeGreeting,
  getCachedHomeGreeting,
  setCachedHomeGreeting,
} from '../services/home-greeting-service';
import {
  getHoyAccessibilityLabel,
  getNotificationAccessibilityLabel,
  getStableHoyDisplayState,
  getHoyState,
  type HoyState,
} from '../services/hoy-state';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {navigateToAuthWelcome} from '../../../navigation/auth-modal-navigation';
import type {
  CircleActivityItem,
  CircleManagementCard,
  InboxEvent,
  MomentumSummary,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useHoyFeedbackStore} from '../../../store/hoy-feedback-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {CircleActionCard} from '../../circles/components/CircleActionCard';
import {nudgeCircleMembers} from '../../circles/services/circle-service';
import {
  buildMomentumSummaryFromHomeData,
  subscribeToMomentumSummary,
} from '../../momentum/services/momentum-service';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
  subscribeToInboxUnreadCount,
} from '../../settings/services/notification-settings-service';

type HomeGreetingState = {
  requestKey: string;
  headline: string;
  source: 'fallback' | 'gemini';
};

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

const companionFeedEventTypes: ReadonlySet<InboxEvent['type']> = new Set([
  'circle_complete',
  'companion_achievement_unlocked',
  'companion_circle_created',
  'companion_circle_joined',
  'companion_momentum_level_up',
  'companion_skipped',
  'companion_streak_milestone',
  'companion_tapped_in',
  'member_joined',
  'nudge',
]);

function isCompanionFeedEvent(event: InboxEvent, viewerUid?: string) {
  if (event.actor?.uid && event.actor.uid === viewerUid) {
    return false;
  }

  return (
    event.feedCategory === 'companion' ||
    companionFeedEventTypes.has(event.type)
  );
}

function getCompanionFeedActionLabel(event: InboxEvent) {
  if (event.type === 'circle_complete') {
    return 'Complete';
  }
  if (event.type === 'companion_achievement_unlocked') {
    return 'Unlocked';
  }
  if (event.type === 'companion_circle_created') {
    return 'Created';
  }
  if (
    event.type === 'companion_circle_joined' ||
    event.type === 'member_joined'
  ) {
    return 'Joined';
  }
  if (event.type === 'companion_momentum_level_up') {
    return 'Level up';
  }
  if (event.type === 'companion_skipped') {
    return 'Skip';
  }
  if (event.type === 'companion_streak_milestone') {
    return 'Streak';
  }
  if (event.type === 'companion_tapped_in') {
    return 'Tapped in';
  }
  if (event.type === 'nudge') {
    return 'Nudge';
  }

  return 'Update';
}

function getCompanionFeedTone(event: InboxEvent) {
  if (event.type === 'companion_skipped') {
    return 'alert' as const;
  }

  if (event.type === 'nudge' || event.type === 'companion_circle_created') {
    return 'pending' as const;
  }

  return 'success' as const;
}

function getEventMessage(event: InboxEvent) {
  const actorName = event.actor?.displayName?.trim();

  if (!actorName) {
    return event.body;
  }

  const duplicatedPrefix = `${actorName} `;
  return event.body.startsWith(duplicatedPrefix)
    ? event.body.slice(duplicatedPrefix.length)
    : event.body;
}

function mapInboxEventToActivity(event: InboxEvent): CircleActivityItem {
  const actorName = event.actor?.displayName ?? event.title;

  return {
    actorAvatarUrl: event.actor?.avatarUrl,
    actorInitials: getInitials(actorName) || 'HO',
    actorName,
    actionLabel: getCompanionFeedActionLabel(event),
    id: event.id,
    mediaImageUrl: event.mediaImageUrl,
    message: getEventMessage(event),
    timestamp: event.createdAtLabel,
    tone: getCompanionFeedTone(event),
  };
}

function getInboxBadgeText(unreadCount: number) {
  if (unreadCount <= 0) {
    return undefined;
  }

  return String(Math.min(unreadCount, 9));
}

export function HomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [homeGreetingState, setHomeGreetingState] =
    useState<HomeGreetingState>();
  const [homeClock, setHomeClock] = useState(() => new Date());
  const [hoyCelebrationKey, setHoyCelebrationKey] = useState(0);
  const [isHoyCelebrating, setIsHoyCelebrating] = useState(false);
  const [remoteMomentumSummary, setRemoteMomentumSummary] =
    useState<MomentumSummary>();
  const lastResolvedHoyStateRef = useRef<
    | {
        sessionKey: string;
        state: HoyState;
      }
    | undefined
  >(undefined);
  const lastResolvedGreetingRef = useRef<
    {headline: string; sessionKey: string} | undefined
  >(undefined);
  const hoyCelebrationTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const pendingHoyTapInCelebration = useHoyFeedbackStore(
    state => state.pendingTapInCelebration,
  );
  const clearStaleHoyTapInCelebration = useHoyFeedbackStore(
    state => state.clearStaleTapInCelebration,
  );
  const consumeHoyTapInCelebration = useHoyFeedbackStore(
    state => state.consumeTapInCelebration,
  );
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );
  const setOnboardingStep = useOnboardingStore(state => state.setCurrentStep);
  const navigation =
    useNavigation<BottomTabNavigationProp<AppTabsParamList, 'Home'>>();
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const requireAccount = useProtectedAction(rootNavigation);
  const timezone = profile?.timezone ?? 'UTC';
  const isAuthenticatedHome =
    status === 'authenticatedReady' && Boolean(user?.uid && profile);
  const isIncompleteProfile = status === 'authenticatedIncompleteProfile';
  const isSessionResolving =
    status === 'initializing' || status === 'authenticating';

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticatedHome || !user?.uid) {
        setHomeData(createEmptyHomeData(timezone, homeClock));
        setIsLoadingHomeData(false);
        setHasHomeDataError(false);
        return undefined;
      }

      setIsLoadingHomeData(true);
      setHasHomeDataError(false);

      return subscribeToHomeData({
        onData: data => {
          setHomeData(data);
          setHasHomeDataError(false);
          setIsLoadingHomeData(false);
        },
        onError: () => {
          setHasHomeDataError(true);
          setIsLoadingHomeData(false);
        },
        timezone,
        uid: user.uid,
      });
    }, [homeClock, isAuthenticatedHome, timezone, user?.uid]),
  );

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setRemoteMomentumSummary(undefined);
      return undefined;
    }

    return subscribeToMomentumSummary({
      onError: () => undefined,
      onSummary: setRemoteMomentumSummary,
      uid: user.uid,
    });
  }, [isAuthenticatedHome, user?.uid]);

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setUnreadInboxCount(0);
      return undefined;
    }

    return subscribeToInboxUnreadCount({
      onCount: setUnreadInboxCount,
      onError: () => setUnreadInboxCount(0),
      uid: user.uid,
    });
  }, [isAuthenticatedHome, user?.uid]);

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setEvents([]);
      return undefined;
    }

    return subscribeToInboxEvents({
      onEvents: setEvents,
      uid: user.uid,
    });
  }, [isAuthenticatedHome, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      setHomeClock(new Date());
      return undefined;
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        setHomeClock(new Date());
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return undefined;
    }

    const nextBoundaryMs = getNextHomeActionBoundary({
      circles: homeData.circles,
      now: homeClock,
      timezone,
    });
    const delayMs = Math.max(100, nextBoundaryMs - Date.now() + 100);
    const timer = setTimeout(() => setHomeClock(new Date()), delayMs);

    return () => clearTimeout(timer);
  }, [homeClock, homeData.circles, timezone]);

  const personalCommitments = useMemo(
    () => homeData.circles.filter(circle => circle.circleMode === 'personal'),
    [homeData.circles],
  );
  const groupCircles = useMemo(
    () => homeData.circles.filter(circle => circle.circleMode !== 'personal'),
    [homeData.circles],
  );
  const todayActionCircles = useMemo(
    () => getTodayAttentionCircles(groupCircles),
    [groupCircles],
  );
  const upcomingActionCircles = useMemo(
    () => getUpcomingAttentionCircles(groupCircles),
    [groupCircles],
  );
  const homePrimaryAction = useMemo(
    () =>
      getHomePrimaryAction({
        circles: homeData.circles,
        firstName: profile?.name,
        now: homeClock,
      }),
    [homeClock, homeData.circles, profile?.name],
  );
  const homeGreetingContext = useMemo(
    () =>
      getHomeGreetingContext({
        circles: homeData.circles,
        firstName: profile?.name,
        now: homeClock,
        timezone,
      }),
    [homeClock, homeData.circles, profile?.name, timezone],
  );
  const homeGreetingFallback = useMemo(
    () =>
      getHomeGreetingFallback({
        circles: homeData.circles,
        firstName: profile?.name,
        now: homeClock,
        timezone,
      }),
    [homeClock, homeData.circles, profile?.name, timezone],
  );
  const homeGreetingRequestKey = useMemo(
    () =>
      buildHomeGreetingCacheKey({
        context: homeGreetingContext,
        dateKey: homeData.todayDateKey,
        uid: user?.uid ?? 'guest',
      }),
    [homeData.todayDateKey, homeGreetingContext, user?.uid],
  );
  const homeGreetingDateKey = homeData.todayDateKey;
  const activeHomeGreetingState =
    homeGreetingState?.requestKey === homeGreetingRequestKey
      ? homeGreetingState
      : undefined;
  const canGenerateHomeGreeting =
    isAuthenticatedHome &&
    !isLoadingHomeData &&
    !hasHomeDataError &&
    homeData.hasResolvedGreetingContext;
  const greetingSessionKey = user?.uid ?? status;
  const retainedGreeting =
    lastResolvedGreetingRef.current?.sessionKey === greetingSessionKey
      ? lastResolvedGreetingRef.current.headline
      : undefined;
  const bubbleText =
    activeHomeGreetingState?.headline ??
    (status === 'guest' || isIncompleteProfile
      ? homeGreetingFallback
      : homeData.hasResolvedGreetingContext
      ? homeGreetingFallback
      : retainedGreeting);
  const momentumSummary =
    remoteMomentumSummary ?? buildMomentumSummaryFromHomeData(homeData);
  const activeCircleCount =
    homeGreetingContext.circleSummary.circleCount -
    homeGreetingContext.circleSummary.pendingCount;
  const rollingMomentumStatus =
    momentumSummary.rollingMomentum?.status ??
    (homeData.personalStreakDays > 0 ? 'strong_momentum' : 'building_momentum');
  const candidateHoyState = getHoyState({
    activeCircleCount,
    hasDeadlineRisk:
      homeGreetingContext.primaryAction?.kind === 'tap_in' &&
      homeGreetingContext.primaryAction.urgency === 'deadline',
    hasUnrecoveredMiss:
      momentumSummary.rollingMomentum?.hasUnrecoveredMiss ?? false,
    isAuthenticatedHome,
    isCelebrating: isHoyCelebrating,
    isGreetingLoading: isAuthenticatedHome && !bubbleText,
    isIncompleteProfile,
    isLoadingHomeData:
      isLoadingHomeData ||
      (isAuthenticatedHome && !homeData.hasResolvedGreetingContext),
    pendingCount: homeGreetingContext.circleSummary.pendingCount,
    rollingMomentumStatus,
  });
  const hoySessionKey = user?.uid ?? status;
  const previousResolvedHoyState =
    lastResolvedHoyStateRef.current?.sessionKey === hoySessionKey
      ? lastResolvedHoyStateRef.current.state
      : undefined;
  const displayedHoyState = getStableHoyDisplayState({
    candidateState: candidateHoyState,
    isSessionResolving,
    previousResolvedState: previousResolvedHoyState,
  });
  const isCandidateHoyStateResolved =
    !isSessionResolving && candidateHoyState !== 'thinking';
  const heroCopy = getHomeHeroCopy({
    dateKey: homeData.todayDateKey,
    firstName: homeGreetingContext.firstName,
    momentumStatus: momentumSummary.status,
    streakDays: homeData.personalStreakDays,
    timeWindow: homeGreetingContext.timeWindow,
  });
  const showAccountPrompt = status === 'guest' || isIncompleteProfile;
  const showAuthenticatedEmptyState = shouldShowAuthenticatedHomeEmptyState({
    circleCount: homeData.circles.length,
    hasHomeDataError,
    hasLoadedMemberships: homeData.hasLoadedMemberships,
    isAuthenticatedHome,
    isLoadingHomeData,
    membershipCount: homeData.membershipCount,
  });
  const showHomeDataErrorPanel = shouldShowHomeDataErrorPanel({
    circleCount: homeData.circles.length,
    hasHomeDataError,
    hasLoadedMemberships: homeData.hasLoadedMemberships,
    isLoadingHomeData,
    membershipCount: homeData.membershipCount,
  });
  const companionFeedEvents = useMemo(
    () =>
      events
        .filter(event => isCompanionFeedEvent(event, user?.uid))
        .slice(0, 6),
    [events, user?.uid],
  );
  const companionUpdates = useMemo(
    () => companionFeedEvents.map(mapInboxEventToActivity),
    [companionFeedEvents],
  );
  const homeCardLiftStyle = [
    styles.homeCardLift,
    {shadowColor: theme.glassShadow},
  ];

  useEffect(() => {
    if (
      isAuthenticatedHome &&
      homeData.hasResolvedGreetingContext &&
      bubbleText
    ) {
      lastResolvedGreetingRef.current = {
        headline: bubbleText,
        sessionKey: greetingSessionKey,
      };
    }
  }, [
    bubbleText,
    greetingSessionKey,
    homeData.hasResolvedGreetingContext,
    isAuthenticatedHome,
  ]);

  useEffect(() => {
    if (isCandidateHoyStateResolved) {
      lastResolvedHoyStateRef.current = {
        sessionKey: hoySessionKey,
        state: candidateHoyState,
      };
    }
  }, [candidateHoyState, hoySessionKey, isCandidateHoyStateResolved]);

  const triggerHoyCelebration = useCallback(() => {
    setHoyCelebrationKey(currentKey => currentKey + 1);
    setIsHoyCelebrating(true);

    if (hoyCelebrationTimerRef.current) {
      clearTimeout(hoyCelebrationTimerRef.current);
    }

    hoyCelebrationTimerRef.current = setTimeout(() => {
      setIsHoyCelebrating(false);
      hoyCelebrationTimerRef.current = undefined;
    }, 2200);
  }, []);

  useEffect(() => {
    setHoyCelebrationKey(0);
    setIsHoyCelebrating(false);

    if (hoyCelebrationTimerRef.current) {
      clearTimeout(hoyCelebrationTimerRef.current);
      hoyCelebrationTimerRef.current = undefined;
    }

    return () => {
      if (hoyCelebrationTimerRef.current) {
        clearTimeout(hoyCelebrationTimerRef.current);
        hoyCelebrationTimerRef.current = undefined;
      }
    };
  }, [homeData.todayDateKey, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (
        !pendingHoyTapInCelebration ||
        !isAuthenticatedHome ||
        !user?.uid ||
        !isCandidateHoyStateResolved ||
        !displayedHoyState
      ) {
        return undefined;
      }

      const scope = {
        dateKey: homeData.todayDateKey,
        uid: user.uid,
      };

      if (
        pendingHoyTapInCelebration.dateKey !== scope.dateKey ||
        pendingHoyTapInCelebration.uid !== scope.uid
      ) {
        clearStaleHoyTapInCelebration(scope);
        return undefined;
      }

      if (consumeHoyTapInCelebration(scope)) {
        triggerHoyCelebration();
      }

      return undefined;
    }, [
      clearStaleHoyTapInCelebration,
      consumeHoyTapInCelebration,
      displayedHoyState,
      homeData.todayDateKey,
      isAuthenticatedHome,
      isCandidateHoyStateResolved,
      pendingHoyTapInCelebration,
      triggerHoyCelebration,
      user?.uid,
    ]),
  );

  useEffect(() => {
    clearExpiredHomeGreetingCacheEntries().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!canGenerateHomeGreeting) {
      return undefined;
    }

    let isActive = true;

    const loadHomeGreeting = async () => {
      const cachedGreeting = await getCachedHomeGreeting(
        homeGreetingRequestKey,
      );

      if (!isActive) {
        return;
      }

      if (cachedGreeting) {
        setHomeGreetingState({
          requestKey: homeGreetingRequestKey,
          headline: cachedGreeting.headline,
          source: 'gemini',
        });
      }

      try {
        const result = await generateHomeGreeting({
          cacheKey: homeGreetingRequestKey,
          context: homeGreetingContext,
          dateKey: homeGreetingDateKey,
        });

        if (!isActive) {
          return;
        }

        const state = {
          requestKey: homeGreetingRequestKey,
          headline:
            result.source === 'gemini' ? result.headline : homeGreetingFallback,
          source: result.source,
        } satisfies HomeGreetingState;

        setHomeGreetingState(state);

        if (result.source === 'gemini') {
          await setCachedHomeGreeting(homeGreetingRequestKey, result);
        }
      } catch {
        if (!isActive) {
          return;
        }

        setHomeGreetingState({
          requestKey: homeGreetingRequestKey,
          headline: homeGreetingFallback,
          source: 'fallback',
        });
      }
    };

    loadHomeGreeting().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [
    canGenerateHomeGreeting,
    homeGreetingContext,
    homeGreetingDateKey,
    homeGreetingFallback,
    homeGreetingRequestKey,
  ]);

  const openAccountAuth = () => {
    if (isIncompleteProfile) {
      setOnboardingStep('finishProfile');
      navigateToAuthWelcome(rootNavigation);
      return;
    }

    clearPendingAction();
    beginAuthFlow();
    startOnboardingWizard();
    navigateToAuthWelcome(rootNavigation);
  };

  const openCircleDetail = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
  };

  const shareCircle = (circle: CircleManagementCard) => {
    if (!canInvite(circle) || !circle.inviteUrl) {
      openCircleDetail(circle.id);
      return;
    }

    Share.share({
      title: `Join ${circle.title} on Hoyst`,
      message: `Join ${circle.title} on Hoyst: ${circle.inviteUrl}`,
      url: circle.inviteUrl,
    }).catch(() => undefined);
  };

  const nudgeCircle = (circle: CircleManagementCard) => {
    if ((circle.nudgeTargetCount ?? 0) <= 0) {
      openCircleDetail(circle.id);
      return;
    }

    if (nudgedCircleIds.has(circle.id) || nudgingCircleIds.has(circle.id)) {
      return;
    }

    setNudgingCircleIds(currentNudgingCircleIds => {
      const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
      nextNudgingCircleIds.add(circle.id);
      return nextNudgingCircleIds;
    });

    nudgeCircleMembers(circle.id)
      .then(result => {
        setNudgedCircleIds(currentNudgedCircleIds => {
          const nextNudgedCircleIds = new Set(currentNudgedCircleIds);
          nextNudgedCircleIds.add(circle.id);
          return nextNudgedCircleIds;
        });

        Alert.alert(
          'Nudge sent',
          result.nudged > 0
            ? `${result.nudged} member${result.nudged === 1 ? '' : 's'} nudged.`
            : 'Everyone is covered right now.',
        );
      })
      .catch(error => {
        Alert.alert(
          'Nudge failed',
          (error as {message?: string}).message ?? 'Could not send a nudge.',
        );
      })
      .finally(() => {
        setNudgingCircleIds(currentNudgingCircleIds => {
          if (!currentNudgingCircleIds.has(circle.id)) {
            return currentNudgingCircleIds;
          }

          const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
          nextNudgingCircleIds.delete(circle.id);
          return nextNudgingCircleIds;
        });
      });
  };

  const handleCircleAction = (circle: CircleManagementCard) => {
    const actionVariant = getHomeCircleActionVariant(circle);

    if (circle.viewerMembershipStatus === 'pending') {
      openCircleDetail(circle.id);
      return;
    }

    if (actionVariant === 'check_in') {
      requireAccount({circleId: circle.id, source: 'home', type: 'tapIn'}, () =>
        rootNavigation?.navigate('TapInComposer', {
          circleId: circle.id,
          source: 'home',
        }),
      );
      return;
    }

    if (actionVariant === 'nudge') {
      nudgeCircle(circle);
      return;
    }

    shareCircle(circle);
  };

  const isHoyActionDisabled =
    isSessionResolving ||
    (isAuthenticatedHome && !homeData.hasResolvedGreetingContext);

  const handleHoyAction = () => {
    if (status === 'guest' || isIncompleteProfile) {
      openAccountAuth();
      return;
    }

    if (
      !isAuthenticatedHome ||
      isHoyActionDisabled ||
      !homeGreetingContext.primaryAction
    ) {
      return;
    }

    const action = homeGreetingContext.primaryAction;
    const circle = homePrimaryAction.circle;

    if (
      (action.kind === 'tap_in' || action.kind === 'update_tap_in') &&
      circle
    ) {
      requireAccount({circleId: circle.id, source: 'home', type: 'tapIn'}, () =>
        rootNavigation?.navigate('TapInComposer', {
          circleId: circle.id,
          source: 'home',
        }),
      );
      return;
    }

    if (
      (action.kind === 'nudge' || action.kind === 'pending_approval') &&
      circle
    ) {
      openCircleDetail(circle.id);
      return;
    }

    if (action.kind === 'no_commitments') {
      navigation.navigate('Explore');
      return;
    }

    navigation.navigate('Momentum');
  };

  const openInbox = () => {
    setUnreadInboxCount(0);

    if (isAuthenticatedHome && user?.uid) {
      markAllInboxEventsRead().catch(() => undefined);
    }

    rootNavigation?.navigate('Inbox');
  };

  const openEvent = (event: InboxEvent) => {
    markInboxEventRead(event.id).catch(() => undefined);

    if (event.deeplink.screen === 'TapInPicker') {
      rootNavigation?.navigate('TapInPicker');
      return;
    }

    if (event.deeplink.screen === 'TapInComposer') {
      rootNavigation?.navigate('TapInComposer', {
        circleId: event.deeplink.circleId,
        source: event.deeplink.source,
      });
      return;
    }

    if (event.deeplink.screen === 'CircleDetail') {
      rootNavigation?.navigate('CircleDetail', {
        circleId: event.deeplink.circleId,
      });
    }
  };

  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <FrostedBackdrop />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        <HomeHeroHeader
          bubbleText={bubbleText}
          copy={heroCopy}
          hoyAccessibilityLabel={getHoyAccessibilityLabel({
            headline: bubbleText,
            isDisabled: isHoyActionDisabled,
            state: displayedHoyState,
          })}
          hoyCelebrationKey={hoyCelebrationKey}
          hoyState={displayedHoyState}
          isHoyActionDisabled={isHoyActionDisabled}
          momentumPercent={momentumSummary.percentage}
          momentumStatus={momentumSummary.status}
          notificationAccessibilityLabel={getNotificationAccessibilityLabel(
            unreadInboxCount,
          )}
          notificationBadgeText={getInboxBadgeText(unreadInboxCount)}
          onHoyActionPress={handleHoyAction}
          onMomentumPress={() => navigation.navigate('Momentum')}
          onNotificationPress={openInbox}
        />
        <View style={styles.sheet}>
          <GlassPanel padding="regular" style={homeCardLiftStyle}>
            <WeekProgressStrip
              days={homeData.progressDays}
              streakDays={homeData.personalStreakDays}
            />
          </GlassPanel>

          <CircleSummaryRings
            contributionPercent={homeData.progressPercent}
            momentumLabel={momentumSummary.label}
            momentumPercent={momentumSummary.percentage}
            momentumStatus={momentumSummary.status}
            onPress={() => navigation.navigate('Momentum')}
            surfaceStyle={homeCardLiftStyle}
            streakDays={homeData.personalStreakDays}
          />

          {showAccountPrompt ? (
            <GlassPanel style={styles.emptyPanel}>
              <SectionHeader
                description={
                  isIncompleteProfile
                    ? 'Finish your handle and profile before circles and Tap Ins unlock.'
                    : 'Get started to save Progression, join Circles, and build your Tap In streak.'
                }
                title={
                  isIncompleteProfile
                    ? 'Complete your profile'
                    : 'Start making Progression'
                }
              />
              <View style={styles.emptyActions}>
                <HoystButton
                  label={
                    isIncompleteProfile ? 'Complete profile' : 'Get started'
                  }
                  onPress={openAccountAuth}
                />
                <HoystButton
                  label="Find circles"
                  onPress={() => navigation.navigate('Explore')}
                  variant="outline"
                />
              </View>
            </GlassPanel>
          ) : null}

          {isAuthenticatedHome ? (
            <View style={styles.circlesSection}>
              {personalCommitments.length > 0 ? (
                <View style={styles.circleSectionGroup}>
                  <SectionEyebrow>PERSONAL COMMITMENTS</SectionEyebrow>
                  {personalCommitments.map(commitment => (
                    <TodayCircleCard
                      card={commitment}
                      key={commitment.id}
                      onActionPress={() => handleCircleAction(commitment)}
                      onCardPress={() => openCircleDetail(commitment.id)}
                      surfaceStyle={homeCardLiftStyle}
                      variant="list"
                    />
                  ))}
                </View>
              ) : null}

              <SectionEyebrow>CIRCLES THAT NEED ATTENTION NOW</SectionEyebrow>

              {todayActionCircles.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.attentionScroll}
                  testID="home-attention-scroll"
                  contentContainerStyle={styles.attentionScrollContent}>
                  {todayActionCircles.map(circle => (
                    <TodayCircleCard
                      card={circle}
                      isNudged={nudgedCircleIds.has(circle.id)}
                      isNudging={nudgingCircleIds.has(circle.id)}
                      key={circle.id}
                      onActionPress={() => handleCircleAction(circle)}
                      onCardPress={() => openCircleDetail(circle.id)}
                      surfaceStyle={homeCardLiftStyle}
                      useCategoryTintGradient
                      variant="attention"
                    />
                  ))}
                </ScrollView>
              ) : !showAuthenticatedEmptyState ? (
                <GlassPanel style={styles.emptyPanel}>
                  <SectionHeader
                    description="No Tap In or Nudge needs your attention today."
                    title="Today is clear"
                  />
                </GlassPanel>
              ) : null}

              <CircleActionCard
                accessibilityLabel="All my commitments"
                onPress={() => rootNavigation?.navigate('Circles')}
                renderIcon={color => (
                  <UsersRound color={color} size={24} strokeWidth={2.4} />
                )}
                subtitle="View commitments and join requests"
                testID="all-my-circles-card"
                title="All my commitments"
              />
            </View>
          ) : null}

          {isAuthenticatedHome && upcomingActionCircles.length > 0 ? (
            <View style={styles.circleSectionGroup}>
              <SectionEyebrow>
                CIRCLES THAT WILL NEED ACTION SOON
              </SectionEyebrow>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.upcomingScroll}
                contentContainerStyle={styles.upcomingScrollContent}>
                {upcomingActionCircles.map(circle => (
                  <TodayCircleCard
                    card={circle}
                    isNudged={nudgedCircleIds.has(circle.id)}
                    isNudging={nudgingCircleIds.has(circle.id)}
                    key={circle.id}
                    onActionPress={() => handleCircleAction(circle)}
                    onCardPress={() => openCircleDetail(circle.id)}
                    surfaceStyle={homeCardLiftStyle}
                    useCategoryTintGradient
                    variant="upcoming"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {isLoadingHomeData ? (
            <GlassPanel style={styles.emptyPanel}>
              <SectionHeader
                description="Pulling your live Circle Progression from Hoyst."
                title="Loading your circles"
              />
            </GlassPanel>
          ) : null}

          {showHomeDataErrorPanel ? (
            <GlassPanel style={styles.emptyPanel}>
              <SectionHeader
                description="Your account is connected, but Home could not load live circle data."
                title="Could not load Home"
              />
            </GlassPanel>
          ) : null}

          {showAuthenticatedEmptyState ? (
            <GlassPanel style={styles.emptyPanel}>
              <View style={styles.emptyActions}>
                <HoystButton
                  label="Find circles"
                  onPress={() => navigation.navigate('Explore')}
                />
              </View>
            </GlassPanel>
          ) : null}

          {isAuthenticatedHome ? (
            <View style={styles.circleSectionGroup}>
              <SectionEyebrow>COMPANION FEED</SectionEyebrow>
              {companionUpdates.length > 0 ? (
                companionUpdates.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openEvent(companionFeedEvents[index])}>
                    <ActivityFeedCard
                      density="compact"
                      item={item}
                      style={homeCardLiftStyle}
                    />
                  </Pressable>
                ))
              ) : (
                <GlassPanel>
                  <SectionHeader
                    description="Tap Ins, skips, joins, nudges, and milestones will appear here."
                    title="No companion feed yet"
                  />
                </GlassPanel>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    flexGrow: 1,
    gap: 20,
    paddingBottom: 172,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  upcomingScroll: {
    marginHorizontal: -20,
  },
  upcomingScrollContent: {
    gap: 12,
    paddingHorizontal: 20,
  },
  attentionScroll: {
    marginHorizontal: -22,
  },
  attentionScrollContent: {
    gap: 12,
    paddingHorizontal: 22,
  },
  circleSectionGroup: {
    gap: 12,
  },
  circlesSection: {
    gap: 14,
  },
  emptyActions: {
    gap: 12,
  },
  emptyPanel: {
    gap: 16,
  },
  homeCardLift: {
    elevation: 9,
    shadowOffset: {height: 10, width: 0},
    shadowOpacity: 0.13,
    shadowRadius: 22,
  },
});
