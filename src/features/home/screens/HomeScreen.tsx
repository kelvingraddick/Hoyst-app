import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  AccessibilityInfo,
  StatusBar,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {ChevronRight, List} from 'lucide-react-native';
import {DateTime} from 'luxon';

import {
  HomeActivityRow,
  HomeButton as HoystButton,
  HomeSurface as GlassPanel,
  HomeSectionTitle as SectionEyebrow,
  HomeStateCopy as SectionHeader,
} from '../components/HomeSurfaces';
import {
  HomeDailyActionProgress,
  HomeProgress,
  HomeWeekPath,
} from '../components/HomeProgress';
import {
  getHomeDailyAction,
  getHomeDailyProgress,
} from '../services/home-daily-actions';
import {getCircleCategoryVisual} from '../../../design/components/CircleCategoryIcon';
import {
  HomeHeroHeader,
  HomeNotificationButton,
} from '../../../design/components/HomeHeroHeader';
import {homeTypography} from '../../../design/tokens/home';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {actionMotion} from '../../../design/tokens/actions';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {
  createEmptyHomeData,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomeCommitmentStackCircles,
  getHomePrimaryAction,
  getNextHomeActionBoundary,
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
import {
  navigateToAuthSignIn,
  navigateToAuthWelcome,
} from '../../../navigation/auth-modal-navigation';
import type {
  CircleActivityItem,
  CircleManagementCard,
  ExploreCircle,
  InboxEvent,
  MomentumSummary,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useHoyFeedbackStore} from '../../../store/hoy-feedback-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {nudgeCircleMembers} from '../../circles/services/circle-service';
import {subscribeToPublicCircles} from '../../circles/services/public-circle-service';
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

const guestStarterArtwork = require('../../../assets/hoy/get-started-invites-network-hands.png');

type HomeGreetingState = {
  requestKey: string;
  headline: string;
  source: 'fallback' | 'gemini';
};

function nudgeKey(
  uid: string | undefined,
  circle: CircleManagementCard,
  now = new Date(),
) {
  return `${uid}:${circle.id}:${DateTime.fromJSDate(now, {
    zone: circle.timezone ?? 'UTC',
  }).toISODate()}`;
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

  return unreadCount > 9 ? '9+' : String(unreadCount);
}

function getFeaturedPublicCircle(circles: ExploreCircle[]) {
  return [...circles].sort((left, right) => {
    if (right.completionRate !== left.completionRate) {
      return right.completionRate - left.completionRate;
    }

    return right.memberCount - left.memberCount;
  })[0];
}

export function HomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const [homeSnapshot, setHomeSnapshot] = useState<{
    uid?: string;
    data: HomeData;
  }>(() => ({data: createEmptyHomeData()}));
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [inboxSnapshot, setInboxSnapshot] = useState<{
    uid?: string;
    events: InboxEvent[];
  }>({events: []});
  const [unreadSnapshot, setUnreadSnapshot] = useState<{
    uid?: string;
    count: number;
  }>({count: 0});
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [focusedCommitmentId, setFocusedCommitmentId] = useState<string>();
  const [homeGreetingState, setHomeGreetingState] =
    useState<HomeGreetingState>();
  const nudgeInFlight = useRef(new Set<string>());
  const [homeClock, setHomeClock] = useState(() => new Date());
  const [hoyCelebrationKey, setHoyCelebrationKey] = useState(0);
  const [isHoyCelebrating, setIsHoyCelebrating] = useState(false);
  const [momentumSnapshot, setMomentumSnapshot] = useState<{
    uid?: string;
    summary?: MomentumSummary;
  }>({});
  const [publicCircles, setPublicCircles] = useState<ExploreCircle[]>([]);
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
  const events = useMemo(
    () => (inboxSnapshot.uid === user?.uid ? inboxSnapshot.events : []),
    [inboxSnapshot, user?.uid],
  );
  const unreadInboxCount =
    unreadSnapshot.uid === user?.uid ? unreadSnapshot.count : 0;
  const remoteMomentumSummary =
    momentumSnapshot.uid === user?.uid ? momentumSnapshot.summary : undefined;
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
  const isGuestHome = status === 'guest';
  const isSessionResolving =
    status === 'initializing' || status === 'authenticating';

  const homeData = useMemo(
    () =>
      homeSnapshot.uid === user?.uid
        ? homeSnapshot.data
        : createEmptyHomeData(timezone, homeClock),
    [homeSnapshot, user?.uid, timezone, homeClock],
  );
  const currentAccountRef = useRef(user?.uid);
  currentAccountRef.current = user?.uid;

  const actionCircles = useMemo(
    () =>
      homeData.circles.map(circle => ({
        ...circle,
        viewerHasNudgedToday: Boolean(
          circle.viewerHasNudgedToday ||
            nudgedCircleIds.has(nudgeKey(user?.uid, circle, homeClock)),
        ),
      })),
    [homeData.circles, homeClock, nudgedCircleIds, user?.uid],
  );
  const dailyProgress = useMemo(
    () => getHomeDailyProgress(actionCircles),
    [actionCircles],
  );

  useEffect(() => {
    if (!isGuestHome) {
      setPublicCircles([]);
      return undefined;
    }

    return subscribeToPublicCircles(setPublicCircles, () =>
      setPublicCircles([]),
    );
  }, [isGuestHome]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticatedHome || !user?.uid) {
        setHomeSnapshot({data: createEmptyHomeData(timezone, homeClock)});
        setIsLoadingHomeData(false);
        setHasHomeDataError(false);
        return undefined;
      }

      setIsLoadingHomeData(true);
      setHasHomeDataError(false);

      let active = true;
      const unsubscribe = subscribeToHomeData({
        onData: data => {
          if (!active) {
            return;
          }
          setHomeSnapshot(previous =>
            !data.hasResolvedGreetingContext &&
            previous.uid === user.uid &&
            previous.data.hasResolvedGreetingContext
              ? previous
              : {uid: user.uid, data},
          );
          setHasHomeDataError(false);
          setIsLoadingHomeData(!data.hasResolvedGreetingContext);
        },
        onError: () => {
          if (!active) {
            return;
          }
          setHasHomeDataError(true);
          setIsLoadingHomeData(false);
        },
        timezone,
        uid: user.uid,
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }, [homeClock, isAuthenticatedHome, timezone, user?.uid]),
  );

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setMomentumSnapshot({});
      return undefined;
    }

    return subscribeToMomentumSummary({
      onError: () => undefined,
      onSummary: summary => setMomentumSnapshot({uid: user.uid, summary}),
      uid: user.uid,
    });
  }, [isAuthenticatedHome, user?.uid]);

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setUnreadSnapshot({count: 0});
      return undefined;
    }

    return subscribeToInboxUnreadCount({
      onCount: count => setUnreadSnapshot({uid: user.uid, count}),
      onError: () => setUnreadSnapshot({uid: user.uid, count: 0}),
      uid: user.uid,
    });
  }, [isAuthenticatedHome, user?.uid]);

  useEffect(() => {
    if (!isAuthenticatedHome || !user?.uid) {
      setInboxSnapshot({events: []});
      return undefined;
    }

    return subscribeToInboxEvents({
      onEvents: nextEvents =>
        setInboxSnapshot({uid: user.uid, events: nextEvents}),
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

  const commitmentStackCircles = useMemo(
    () =>
      getHomeCommitmentStackCircles({
        personalCommitments: actionCircles.filter(
          circle => circle.circleMode === 'personal',
        ),
        todayAttentionCircles: actionCircles.filter(
          circle => circle.circleMode !== 'personal',
        ),
        upcomingAttentionCircles: [],
      }),
    [actionCircles],
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
        ['tap_in', 'nudge'].includes(
          getHomeDailyAction(previousFocusedCommitment),
        ) &&
        !['tap_in', 'nudge'].includes(getHomeDailyAction(focusedCommitment)),
    );
    const nextIncompleteCommitment = commitmentStackCircles.find(circle =>
      ['tap_in', 'nudge'].includes(getHomeDailyAction(circle)),
    );
    const nextFocusedCommitment =
      !focusedCommitment || completedWhileFocused
        ? nextIncompleteCommitment
        : focusedCommitment;

    if (nextFocusedCommitment?.id !== focusedCommitmentId) {
      setFocusedCommitmentId(nextFocusedCommitment?.id);
    }

    previousFocusedCommitmentRef.current = nextFocusedCommitment;
  }, [commitmentStackCircles, focusedCommitmentId]);
  const homePrimaryAction = useMemo(
    () =>
      getHomePrimaryAction({
        circles: actionCircles,
        firstName: profile?.name,
        now: homeClock,
      }),
    [homeClock, actionCircles, profile?.name],
  );
  const homeGreetingContext = useMemo(
    () =>
      getHomeGreetingContext({
        circles: actionCircles,
        firstName: profile?.name,
        now: homeClock,
        timezone,
      }),
    [homeClock, actionCircles, profile?.name, timezone],
  );
  const homeGreetingFallback = useMemo(
    () =>
      getHomeGreetingFallback({
        circles: actionCircles,
        firstName: profile?.name,
        now: homeClock,
        timezone,
      }),
    [homeClock, actionCircles, profile?.name, timezone],
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
    (isGuestHome
      ? 'Ready to make a promise? Let’s build your first commitment.'
      : isIncompleteProfile
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
  const featuredPublicCircle = useMemo(
    () => (isGuestHome ? getFeaturedPublicCircle(publicCircles) : undefined),
    [isGuestHome, publicCircles],
  );
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
  const homeLinkIconColor = theme.isDark ? '#252527' : '#EEEEF0';
  const homeNeutralSurfaceColor = theme.isDark ? '#252527' : '#FFFFFF';
  const homeCardLiftStyle = [
    {backgroundColor: theme.isDark ? '#1D1D20' : '#F1F1EE'},
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

  const openReturningMemberSignIn = () => {
    clearPendingAction();
    beginAuthFlow();
    navigateToAuthSignIn(rootNavigation);
  };

  const openCircleDetail = (circleId: string) => {
    rootNavigation?.navigate('CircleDetail', {circleId});
  };

  const nudgeCircle = (circle: CircleManagementCard) => {
    if ((circle.nudgeTargetCount ?? 0) <= 0) {
      openCircleDetail(circle.id);
      return;
    }

    const key = nudgeKey(user?.uid, circle);
    if (
      circle.viewerHasNudgedToday ||
      nudgedCircleIds.has(key) ||
      nudgeInFlight.current.has(key)
    ) {
      return;
    }

    nudgeInFlight.current.add(key);
    setNudgingCircleIds(currentNudgingCircleIds => {
      const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
      nextNudgingCircleIds.add(key);
      return nextNudgingCircleIds;
    });

    const sendingAccount = user?.uid;
    nudgeCircleMembers(circle.id)
      .then(result => {
        if (currentAccountRef.current !== sendingAccount) {
          return;
        }
        if (result.nudged > 0) {
          setNudgedCircleIds(currentNudgedCircleIds => {
            const nextNudgedCircleIds = new Set(currentNudgedCircleIds);
            nextNudgedCircleIds.add(key);
            return nextNudgedCircleIds;
          });
        }

        AccessibilityInfo.announceForAccessibility(
          result.nudged > 0 ? 'Nudge complete' : 'No members need a nudge',
        );
        if (result.nudged === 0) {
          setHomeClock(new Date());
        }
        Alert.alert(
          result.nudged > 0 ? 'Nudge sent' : 'No nudge needed',
          result.nudged > 0
            ? `${result.nudged} ${
                result.nudged === 1 ? 'Member' : 'Members'
              } nudged.`
            : 'Everyone is covered right now.',
        );
      })
      .catch(error => {
        if (currentAccountRef.current !== sendingAccount) {
          return;
        }
        AccessibilityInfo.announceForAccessibility(
          'Nudge failed. Please try again.',
        );
        Alert.alert(
          'Nudge failed',
          (error as {message?: string}).message ?? 'Could not send a nudge.',
        );
      })
      .finally(() => {
        nudgeInFlight.current.delete(key);
        setNudgingCircleIds(currentNudgingCircleIds => {
          if (!currentNudgingCircleIds.has(key)) {
            return currentNudgingCircleIds;
          }

          const nextNudgingCircleIds = new Set(currentNudgingCircleIds);
          nextNudgingCircleIds.delete(key);
          return nextNudgingCircleIds;
        });
      });
  };

  const handleCircleAction = (circle: CircleManagementCard) => {
    const actionVariant = getHomeDailyAction(circle);

    if (circle.viewerMembershipStatus === 'pending') {
      openCircleDetail(circle.id);
      return;
    }

    if (actionVariant === 'tap_in') {
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

    openCircleDetail(circle.id);
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
    setUnreadSnapshot({count: 0});

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
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        <HomeHeroHeader
          bubbleText={bubbleText}
          emphasis={[
            homeGreetingContext.firstName ?? '',
            homeGreetingContext.primaryAction?.circleTitle ?? '',
          ]}
          notification={
            <HomeNotificationButton
              accessibilityLabel={getNotificationAccessibilityLabel(
                unreadInboxCount,
              )}
              badgeText={getInboxBadgeText(unreadInboxCount)}
              onPress={openInbox}
            />
          }
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
            style={[
              styles.homeProgressSection,
              isIncompleteProfile && styles.hidden,
            ]}
            testID="home-progress-section">
            {isGuestHome || homeData.hasResolvedGreetingContext ? (
              <HomeWeekPath days={homeData.progressDays} />
            ) : (
              <View
                accessibilityLabel="Loading your week"
                style={styles.progressPlaceholder}
              />
            )}
            {isGuestHome ? (
              <HoystText style={styles.guestProgressCopy} tone="muted">
                Your first streak starts with one Tap In.
              </HoystText>
            ) : isAuthenticatedHome &&
              homeData.hasResolvedGreetingContext &&
              !hasHomeDataError ? (
              <HomeProgress
                streakDays={homeData.personalStreakDays}
                momentumPercent={momentumDisplay.rawRollingPercentage}
                onMomentumPress={() => navigation.navigate('Momentum')}
              />
            ) : isSessionResolving || isLoadingHomeData ? (
              <View
                accessibilityLabel="Loading your progress"
                style={styles.progressPlaceholder}
              />
            ) : null}
          </View>

          {isGuestHome ? (
            <View style={styles.guestStarterSection}>
              <Image
                accessible={false}
                resizeMode="contain"
                source={guestStarterArtwork}
                style={styles.guestStarterArtwork}
                testID="guest-home-get-started-artwork"
              />
              <View style={styles.guestStarterPanelContainer}>
                <GlassPanel
                  padding="compact"
                  style={[styles.guestStarterPanel, homeCardLiftStyle]}>
                  <View style={styles.guestStarterCopy}>
                    <SectionEyebrow>GET STARTED</SectionEyebrow>
                    <HoystText
                      style={styles.guestStarterDescription}
                      tone="muted">
                      Create a Circle. Invite your people.
                    </HoystText>
                  </View>
                  <Pressable
                    accessibilityLabel="Start your commitment"
                    accessibilityRole="button"
                    onPress={openAccountAuth}
                    style={({pressed}) => [
                      styles.guestStarterAction,
                      {
                        opacity: pressed ? actionMotion.pressedOpacity : 1,
                      },
                    ]}
                    testID="guest-home-start-commitment">
                    <View
                      style={[
                        styles.guestStarterActionFill,
                        {backgroundColor: theme.actionSurface},
                      ]}>
                      <HoystText
                        style={[
                          styles.guestStarterActionText,
                          {color: theme.actionForeground},
                        ]}>
                        Start your commitment
                      </HoystText>
                      <ChevronRight color={theme.actionForeground} size={18} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Already a member? Log in"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={openReturningMemberSignIn}
                    style={({pressed}) => [
                      {opacity: pressed ? actionMotion.pressedOpacity : 1},
                    ]}
                    testID="guest-home-log-in-link">
                    <View
                      style={[
                        styles.returningMemberLink,
                        {borderColor: theme.borderStrong},
                      ]}>
                      <HoystText
                        style={[
                          styles.returningMemberLinkText,
                          {color: theme.text},
                        ]}>
                        Already a member?{' '}
                        <HoystText style={styles.returningMemberActionText}>
                          Log in
                        </HoystText>
                      </HoystText>
                      <ChevronRight color={theme.text} size={16} />
                    </View>
                  </Pressable>
                </GlassPanel>
              </View>
            </View>
          ) : isIncompleteProfile ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description="Finish your handle and profile before circles and Tap Ins unlock."
                title="Complete your profile"
              />
              <View style={styles.emptyActions}>
                <HoystButton
                  label="Complete profile"
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

          {isGuestHome ? (
            <View style={styles.guestDiscoverySection}>
              <SectionEyebrow>DISCOVER A CIRCLE</SectionEyebrow>
              {featuredPublicCircle ? (
                <Pressable
                  accessibilityLabel={`View ${featuredPublicCircle.title}`}
                  accessibilityRole="button"
                  onPress={() => openCircleDetail(featuredPublicCircle.id)}
                  style={({pressed}) => [
                    styles.guestFeaturedPressable,
                    {opacity: pressed ? actionMotion.pressedOpacity : 1},
                  ]}
                  testID="guest-home-featured-circle">
                  <GlassPanel
                    style={[styles.guestFeaturedCard, homeCardLiftStyle]}
                    variant="panel">
                    <View style={styles.guestFeaturedTopRow}>
                      <HoystText style={homeTypography.category} tone="muted">
                        {getCircleCategoryVisual(
                          featuredPublicCircle.category,
                        ).label.toUpperCase()}
                      </HoystText>
                      <HoystText style={styles.guestFeaturedPace} tone="muted">
                        {featuredPublicCircle.joinLabel}
                      </HoystText>
                    </View>
                    <View style={styles.guestFeaturedCopy}>
                      <HoystText style={homeTypography.title}>
                        {featuredPublicCircle.title}
                      </HoystText>
                      <HoystText style={homeTypography.body} tone="muted">
                        {featuredPublicCircle.commitment}
                      </HoystText>
                    </View>
                    <View style={styles.guestFeaturedFooter}>
                      <View style={styles.guestFeaturedMembers}>
                        <View style={styles.guestFeaturedAvatarRow}>
                          {featuredPublicCircle.members
                            .slice(0, 3)
                            .map((member, index) => (
                              <View
                                key={member.id}
                                style={
                                  index === 0
                                    ? undefined
                                    : styles.guestFeaturedAvatarOverlap
                                }>
                                <LayeredAvatar
                                  chrome="minimal"
                                  imageSource={member.avatarImage}
                                  imageUrl={member.avatarUrl}
                                  initials={member.initials}
                                  size={24}
                                  state={member.state}
                                />
                              </View>
                            ))}
                        </View>
                        <HoystText
                          numberOfLines={1}
                          style={styles.guestFeaturedMembersLabel}
                          tone="muted"
                          variant="caption">
                          {featuredPublicCircle.memberCount} member
                          {featuredPublicCircle.memberCount === 1 ? '' : 's'}
                        </HoystText>
                      </View>
                      <ChevronRight color={theme.textMuted} size={20} />
                    </View>
                  </GlassPanel>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel="Explore all circles"
                accessibilityRole="button"
                onPress={() => navigation.navigate('Explore')}
                style={({pressed}) => [
                  styles.exploreAllLink,
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
                ]}
                testID="guest-home-explore-all-link">
                <View style={styles.exploreAllLinkContent}>
                  <HoystText style={styles.exploreAllLinkText}>
                    Explore all circles
                  </HoystText>
                  <ChevronRight color={theme.textMuted} size={18} />
                </View>
              </Pressable>
            </View>
          ) : null}

          {isAuthenticatedHome ? (
            <View style={styles.circlesSection}>
              <View style={styles.commitmentsHeading}>
                <SectionEyebrow>Your commitments</SectionEyebrow>
                {homeData.hasResolvedGreetingContext && !hasHomeDataError ? (
                  <HomeDailyActionProgress progress={dailyProgress} />
                ) : null}
              </View>
              {commitmentStackCircles.length > 0 &&
              homeData.hasResolvedGreetingContext ? (
                <HomeCommitmentStack
                  cards={commitmentStackCircles}
                  focusedCardId={focusedCommitmentId}
                  isNudged={circleId =>
                    Boolean(
                      actionCircles.find(circle => circle.id === circleId)
                        ?.viewerHasNudgedToday,
                    )
                  }
                  isNudging={circleId => {
                    const circle = actionCircles.find(
                      item => item.id === circleId,
                    );
                    return Boolean(
                      circle &&
                        nudgingCircleIds.has(
                          nudgeKey(user?.uid, circle, homeClock),
                        ),
                    );
                  }}
                  onActionPress={handleCircleAction}
                  onFocusCard={setFocusedCommitmentId}
                  onViewDetails={openCircleDetail}
                />
              ) : !showAuthenticatedEmptyState &&
                homeData.hasResolvedGreetingContext &&
                !isLoadingHomeData &&
                !hasHomeDataError ? (
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
                  style={[
                    styles.allMyCommitmentsLink,
                    {borderBottomColor: theme.border},
                  ]}
                  testID="all-my-commitments-link-content">
                  <View
                    style={[
                      styles.linkIcon,
                      {backgroundColor: homeLinkIconColor},
                    ]}>
                    <List
                      color={theme.textMuted}
                      size={20}
                      strokeWidth={2.4}
                      testID="all-my-commitments-list-icon"
                    />
                  </View>
                  <HoystText
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

          {isLoadingHomeData && !homeData.hasResolvedGreetingContext ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description="Pulling your live Circle Progress from Hoyst."
                title="Loading your circles"
              />
            </GlassPanel>
          ) : null}

          {hasHomeDataError && isAuthenticatedHome ? (
            <GlassPanel style={[styles.emptyPanel, homeCardLiftStyle]}>
              <SectionHeader
                description="Your account is connected, but Home could not load live circle data."
                title="Could not load Home"
              />
              <HoystButton
                label="Retry"
                onPress={() => setHomeClock(new Date())}
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
              <View style={styles.sectionHeadingRow}>
                <SectionEyebrow>Circle activity</SectionEyebrow>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="See all activity in Inbox"
                  onPress={openInbox}
                  style={styles.seeAll}>
                  <HoystText style={styles.secondaryCopy} tone="muted">
                    See all
                  </HoystText>
                </Pressable>
              </View>
              {circleActivityUpdates.length > 0 ? (
                circleActivityUpdates.map((item, index) => (
                  <HomeActivityRow
                    key={item.id}
                    item={item}
                    onPress={() => openEvent(circleActivityEvents[index])}
                  />
                ))
              ) : (
                <View style={styles.activityEmpty}>
                  <SectionHeader
                    description="Tap Ins, skips, joins, nudges, and milestones will appear here."
                    title="No Circle activity yet"
                  />
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {display: 'none'},
  secondaryCopy: homeTypography.secondary,
  progressPlaceholder: {
    height: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  seeAll: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  activityEmpty: {paddingVertical: 16},
  allMyCommitmentsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  allMyCommitmentsLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allMyCommitmentsPressable: {
    marginBottom: 0,
    marginTop: 0,
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
    gap: 16,
    paddingBottom: 172,
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  homeProgressSection: {
    gap: 12,
  },
  guestProgressCopy: homeTypography.body,
  circleSectionGroup: {
    gap: 0,
  },
  circleSectionGroupAfterCommitments: {
    marginTop: 0,
  },
  commitmentsHeading: {gap: 4},
  circlesSection: {
    gap: 12,
  },
  emptyActions: {
    gap: 12,
  },
  emptyPanel: {
    gap: 12,
  },
  guestStarterPanel: {
    gap: 12,
  },
  guestStarterArtwork: {
    height: 190,
    width: '100%',
  },
  guestStarterPanelContainer: {
    paddingHorizontal: 22,
  },
  guestStarterSection: {
    gap: 4,
    marginHorizontal: -22,
  },
  guestStarterCopy: {
    gap: 4,
  },
  guestStarterDescription: homeTypography.body,
  guestStarterAction: {
    width: '100%',
  },
  guestStarterActionFill: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  guestStarterActionText: homeTypography.action,
  returningMemberLink: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  returningMemberLinkText: homeTypography.action,
  returningMemberActionText: homeTypography.action,
  guestDiscoverySection: {
    gap: 12,
  },
  guestFeaturedPressable: {
    borderRadius: 18,
  },
  guestFeaturedCard: {
    gap: 12,
  },
  guestFeaturedTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  guestFeaturedPace: homeTypography.category,
  guestFeaturedCopy: {
    gap: 4,
  },
  guestFeaturedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  guestFeaturedMembers: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minWidth: 0,
  },
  guestFeaturedAvatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  guestFeaturedAvatarOverlap: {
    marginLeft: -7,
  },
  guestFeaturedMembersLabel: {
    ...homeTypography.secondary,
    flexShrink: 1,
  },
  exploreAllLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingRight: 6,
  },
  exploreAllLinkContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    minHeight: 44,
  },
  exploreAllLinkText: homeTypography.action,
});
