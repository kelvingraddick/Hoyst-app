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
import {ChevronRight, Handshake} from 'lucide-react-native';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {
  HomeHeroHeader,
  HomeMomentumBar,
  HomeNotificationButton,
} from '../../../design/components/HomeHeroHeader';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystText} from '../../../design/components/HoystText';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {WeekProgressStrip} from '../../../design/components/WeekProgressStrip';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {actionMotion} from '../../../design/tokens/actions';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {
  createEmptyHomeData,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomeCommitmentStackCircles,
  getHomePrimaryAction,
  getNextHomeActionBoundary,
  getTodayAttentionCircles,
  getUpcomingAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeDataErrorPanel,
  subscribeToHomeData,
  type HomeData,
} from '../services/home-data-service';
import {HomeCommitmentStack} from '../components/HomeCommitmentStack';
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
import {nudgeCircleMembers} from '../../circles/services/circle-service';
import {
  isCircleActivityEvent,
  legacyCircleActivityEventTypes,
} from '../../inbox/circle-activity-compat';
import {
  getMomentumDisplayModel,
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

function isCompletedDailyHomeCommitment(circle: CircleManagementCard) {
  return Boolean(
    circle.commitmentCadence === 'daily' &&
      circle.viewerHasTappedInToday &&
      getHomeCircleActionVariant(circle) !== 'nudge',
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

function getCircleActivityActionLabel(event: InboxEvent) {
  if (event.type === 'circle_complete') {
    return 'Complete';
  }
  if (event.type === legacyCircleActivityEventTypes.achievementUnlocked) {
    return 'Unlocked';
  }
  if (event.type === legacyCircleActivityEventTypes.circleCreated) {
    return 'Created';
  }
  if (
    event.type === legacyCircleActivityEventTypes.circleJoined ||
    event.type === 'member_joined'
  ) {
    return 'Joined';
  }
  if (event.type === legacyCircleActivityEventTypes.momentumLevelUp) {
    return 'Level up';
  }
  if (event.type === legacyCircleActivityEventTypes.skipped) {
    return 'Skip';
  }
  if (event.type === legacyCircleActivityEventTypes.streakMilestone) {
    return 'Streak';
  }
  if (event.type === legacyCircleActivityEventTypes.tappedIn) {
    return 'Tapped in';
  }
  if (event.type === 'nudge') {
    return 'Nudge';
  }

  return 'Update';
}

function getCircleActivityTone(event: InboxEvent) {
  if (event.type === legacyCircleActivityEventTypes.skipped) {
    return 'alert' as const;
  }

  if (
    event.type === 'nudge' ||
    event.type === legacyCircleActivityEventTypes.circleCreated
  ) {
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
    actionLabel: getCircleActivityActionLabel(event),
    id: event.id,
    mediaImageUrl: event.mediaImageUrl,
    message: getEventMessage(event),
    timestamp: event.createdAtLabel,
    tone: getCircleActivityTone(event),
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
  const [focusedCommitmentId, setFocusedCommitmentId] = useState<string>();
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
  const previousFocusedCommitmentRef = useRef<CircleManagementCard | undefined>(
    undefined,
  );
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
  const commitmentStackCircles = useMemo(
    () =>
      getHomeCommitmentStackCircles({
        personalCommitments,
        todayAttentionCircles: todayActionCircles,
        upcomingAttentionCircles: upcomingActionCircles,
      }),
    [personalCommitments, todayActionCircles, upcomingActionCircles],
  );

  useEffect(() => {
    if (commitmentStackCircles.length === 0) {
      previousFocusedCommitmentRef.current = undefined;
      if (focusedCommitmentId) {
        setFocusedCommitmentId(undefined);
      }
      return;
    }

    const focusedCommitment = commitmentStackCircles.find(
      circle => circle.id === focusedCommitmentId,
    );
    const previousFocusedCommitment = previousFocusedCommitmentRef.current;
    const completedWhileFocused = Boolean(
      focusedCommitment &&
        previousFocusedCommitment?.id === focusedCommitment.id &&
        !previousFocusedCommitment.viewerHasTappedInToday &&
        isCompletedDailyHomeCommitment(focusedCommitment),
    );
    const nextIncompleteCommitment = commitmentStackCircles.find(
      circle => !isCompletedDailyHomeCommitment(circle),
    );
    const nextFocusedCommitment =
      !focusedCommitment || completedWhileFocused
        ? nextIncompleteCommitment ?? commitmentStackCircles[0]
        : focusedCommitment;

    if (nextFocusedCommitment.id !== focusedCommitmentId) {
      setFocusedCommitmentId(nextFocusedCommitment.id);
    }

    previousFocusedCommitmentRef.current = nextFocusedCommitment;
  }, [commitmentStackCircles, focusedCommitmentId]);
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
  const momentumDisplay = getMomentumDisplayModel(remoteMomentumSummary);
  const activeCircleCount =
    homeGreetingContext.circleSummary.circleCount -
    homeGreetingContext.circleSummary.pendingCount;
  const rollingMomentumStatus = momentumDisplay.status;
  const candidateHoyState = getHoyState({
    activeCircleCount,
    hasDeadlineRisk:
      homeGreetingContext.primaryAction?.kind === 'tap_in' &&
      homeGreetingContext.primaryAction.urgency === 'deadline',
    hasUnrecoveredMiss:
      remoteMomentumSummary?.rollingMomentum?.hasUnrecoveredMiss ?? false,
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
  const circleActivityEvents = useMemo(
    () =>
      events
        .filter(event => isCircleActivityEvent(event, user?.uid))
        .slice(0, 6),
    [events, user?.uid],
  );
  const circleActivityUpdates = useMemo(
    () => circleActivityEvents.map(mapInboxEventToActivity),
    [circleActivityEvents],
  );
  const homeNeutralSurfaceColor = theme.neutralSurface;
  const homeCardLiftStyle = [
    styles.homeCardLift,
    {
      backgroundColor: homeNeutralSurfaceColor,
      borderWidth: 0,
      shadowColor: theme.glassShadow,
    },
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
            ? `${result.nudged} ${
                result.nudged === 1 ? 'Member' : 'Members'
              } nudged.`
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
    <View
      style={[styles.root, theme.isDark ? styles.rootDark : styles.rootLight]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        <HomeHeroHeader
          bubbleText={bubbleText}
          hoyAccessibilityLabel={getHoyAccessibilityLabel({
            headline: bubbleText,
            isDisabled: isHoyActionDisabled,
            state: displayedHoyState,
          })}
          hoyCelebrationKey={hoyCelebrationKey}
          hoyState={displayedHoyState}
          isHoyActionDisabled={isHoyActionDisabled}
          onHoyActionPress={handleHoyAction}
          surfaceColor={homeNeutralSurfaceColor}
        />
        <View style={styles.sheet}>
          <View
            style={styles.homeProgressSection}
            testID="home-progress-section">
            <WeekProgressStrip
              compact
              days={homeData.progressDays}
              headerAccessory={
                <HomeNotificationButton
                  accessibilityLabel={getNotificationAccessibilityLabel(
                    unreadInboxCount,
                  )}
                  badgeText={getInboxBadgeText(unreadInboxCount)}
                  onPress={openInbox}
                />
              }
              streakDays={homeData.personalStreakDays}
              title="YOUR PROGRESS"
              weekdayLabelLength={3}
            />
            <HomeMomentumBar
              momentumPercent={momentumDisplay.rawRollingPercentage}
              momentumStatus={momentumDisplay.status}
              onPress={() => navigation.navigate('Momentum')}
              trackColor={homeNeutralSurfaceColor}
            />
          </View>

          {showAccountPrompt ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description={
                  isIncompleteProfile
                    ? 'Finish your handle and profile before circles and Tap Ins unlock.'
                    : 'Get started to save Progress, join Circles, and build your Tap In streak.'
                }
                title={
                  isIncompleteProfile
                    ? 'Complete your profile'
                    : 'Start making Progress'
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
              <SectionEyebrow>YOUR COMMITMENTS</SectionEyebrow>

              {commitmentStackCircles.length > 0 ? (
                <HomeCommitmentStack
                  cards={commitmentStackCircles}
                  focusedCardId={focusedCommitmentId}
                  isNudged={circleId => nudgedCircleIds.has(circleId)}
                  isNudging={circleId => nudgingCircleIds.has(circleId)}
                  onActionPress={handleCircleAction}
                  onFocusCard={setFocusedCommitmentId}
                  onViewDetails={openCircleDetail}
                />
              ) : !showAuthenticatedEmptyState ? (
                <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
                  <SectionHeader
                    description="No Tap In or Nudge needs your attention today."
                    title="Today is clear"
                  />
                </GlassPanel>
              ) : null}

              <Pressable
                accessibilityLabel="All my commitments"
                accessibilityRole="button"
                onPress={() => rootNavigation?.navigate('Circles')}
                style={({pressed}) => [
                  styles.allMyCommitmentsPressable,
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
                ]}
                testID="all-my-commitments-link">
                <View
                  style={styles.allMyCommitmentsLink}
                  testID="all-my-commitments-link-content">
                  <Handshake
                    color={theme.textMuted}
                    size={20}
                    strokeWidth={2.4}
                    testID="all-my-commitments-handshake"
                  />
                  <HoystText
                    numberOfLines={1}
                    style={[
                      styles.allMyCommitmentsLabel,
                      {color: theme.textMuted},
                    ]}
                    testID="all-my-commitments-label">
                    All my commitments
                  </HoystText>
                  <ChevronRight
                    color={theme.textMuted}
                    size={20}
                    strokeWidth={2.6}
                    testID="all-my-commitments-chevron"
                  />
                </View>
              </Pressable>
            </View>
          ) : null}

          {isLoadingHomeData ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description="Pulling your live Circle Progress from Hoyst."
                title="Loading your circles"
              />
            </GlassPanel>
          ) : null}

          {showHomeDataErrorPanel ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description="Your account is connected, but Home could not load live circle data."
                title="Could not load Home"
              />
            </GlassPanel>
          ) : null}

          {showAuthenticatedEmptyState ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <View style={styles.emptyActions}>
                <HoystButton
                  label="Find circles"
                  onPress={() => navigation.navigate('Explore')}
                />
              </View>
            </GlassPanel>
          ) : null}

          {isAuthenticatedHome ? (
            <View
              style={[
                styles.circleSectionGroup,
                !isLoadingHomeData &&
                !showHomeDataErrorPanel &&
                !showAuthenticatedEmptyState
                  ? styles.circleSectionGroupAfterCommitments
                  : null,
              ]}>
              <SectionEyebrow>CIRCLE ACTIVITY</SectionEyebrow>
              {circleActivityUpdates.length > 0 ? (
                circleActivityUpdates.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openEvent(circleActivityEvents[index])}>
                    <ActivityFeedCard
                      density="compact"
                      item={item}
                      style={homeCardLiftStyle}
                    />
                  </Pressable>
                ))
              ) : (
                <GlassPanel style={homeCardLiftStyle}>
                  <SectionHeader
                    description="Tap Ins, skips, joins, nudges, and milestones will appear here."
                    title="No Circle activity yet"
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
  allMyCommitmentsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  allMyCommitmentsLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingVertical: 8,
    transform: [{translateY: -10}],
  },
  allMyCommitmentsPressable: {
    marginBottom: -48,
    marginTop: -18,
    width: '100%',
  },
  root: {
    flex: 1,
  },
  rootDark: {
    backgroundColor: '#121212',
  },
  rootLight: {
    backgroundColor: '#FAFAF7',
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
  homeProgressSection: {
    gap: 8,
  },
  circleSectionGroup: {
    gap: 12,
  },
  circleSectionGroupAfterCommitments: {
    marginTop: -20,
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
