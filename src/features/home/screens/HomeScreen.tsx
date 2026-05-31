import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import {Bell} from 'lucide-react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {MomentumStageIcon} from '../../../design/components/MomentumStageIcon';
import {MomentumStatusPill} from '../../../design/components/MomentumStatusPill';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {brandColors} from '../../../design/tokens/colors';
import {actionMotion, actionShadow} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {
  createEmptyHomeData,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getTodayAttentionCircles,
  getUpcomingAttentionCircles,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeCreateCircleButton,
  shouldShowHomeDataErrorPanel,
  subscribeToHomeData,
  type HomeData,
  type HomeProgressCell,
} from '../services/home-data-service';
import {
  buildHomeGreetingCacheKey,
  clearExpiredHomeGreetingCacheEntries,
  generateHomeGreeting,
  getCachedHomeGreeting,
  setCachedHomeGreeting,
} from '../services/home-greeting-service';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../../profile/services/profile-display';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {navigateToAuthWelcome} from '../../../navigation/auth-modal-navigation';
import type {
  CircleManagementCard,
  MomentumSummary,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {nudgeCircleMembers} from '../../circles/services/circle-service';
import {
  buildMomentumSummaryFromHomeData,
  formatOpportunityCount,
  subscribeToMomentumSummary,
} from '../../momentum/services/momentum-service';
import {
  markAllInboxEventsRead,
  subscribeToInboxUnreadCount,
} from '../../settings/services/notification-settings-service';

type HomeGreetingState = {
  requestKey: string;
  headline: string;
  source: 'fallback' | 'gemini';
};

const MOMENTUM_ICON_SIZE = 54;

function MomentumBars({percentage}: {percentage: number}) {
  const theme = useHoystTheme();
  const barHeights = [20, 27, 34, 41, 48, 55];
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const activeBarCount =
    clampedPercentage <= 0
      ? 0
      : Math.ceil((clampedPercentage / 100) * barHeights.length);

  return (
    <View accessibilityElementsHidden style={styles.momentumBars}>
      {barHeights.map((height, index) => (
        <View
          key={height}
          style={[
            styles.momentumBar,
            {
              backgroundColor:
                index < activeBarCount ? theme.success : theme.surfaceMuted,
              height,
            },
          ]}
        />
      ))}
    </View>
  );
}

function getStreakCalendarDayStyle(
  theme: ReturnType<typeof useHoystTheme>,
  state: HomeProgressCell['state'],
) {
  if (state === 'done') {
    return {
      cell: {
        backgroundColor: `${theme.success}14`,
        borderColor: `${theme.successForeground}55`,
      },
      text: theme.successForeground,
    };
  }

  if (state === 'missed') {
    return {
      cell: {
        backgroundColor: `${theme.danger}14`,
        borderColor: `${theme.dangerForeground}55`,
      },
      text: theme.dangerForeground,
    };
  }

  if (state === 'today') {
    return {
      cell: {
        backgroundColor: `${theme.accentSecondary}16`,
        borderColor: `${theme.accentSecondaryForeground}80`,
        borderStyle: 'dashed' as const,
      },
      text: theme.accentSecondaryForeground,
    };
  }

  return {
    cell: {
      backgroundColor: theme.surfaceSoft,
      borderColor: theme.border,
    },
    text: theme.textMuted,
  };
}

function HomeStreakCalendar({
  days,
  streakDays,
}: {
  days: HomeProgressCell[];
  streakDays: number;
}) {
  const theme = useHoystTheme();
  const streakLabel = streakDays > 0 ? `${streakDays}d streak` : 'Start';

  return (
    <GlassPanel padding="compact" style={styles.streakCalendarPanel}>
      <View style={styles.streakCalendarHeader}>
        <HoystText tone="muted" variant="bodyStrong">
          Last 7 days
        </HoystText>
        <HoystText style={styles.streakCalendarBadge} tone="muted">
          {streakLabel}
        </HoystText>
      </View>
      <View style={styles.streakCalendarGrid}>
        {days.map(day => {
          const stateStyle = getStreakCalendarDayStyle(theme, day.state);

          return (
            <View
              accessibilityLabel={`${day.label}: ${day.state}`}
              key={day.dateKey}
              style={[styles.streakCalendarDay, stateStyle.cell]}>
              <HoystText
                style={[styles.streakCalendarDayText, {color: stateStyle.text}]}
                variant="bodyStrong">
                {day.label}
              </HoystText>
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
}

function canInvite(circle: CircleManagementCard) {
  return Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );
}

function HeaderAction({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.headerAction,
        style,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

function getInboxBadgeText(unreadCount: number) {
  if (unreadCount <= 0) {
    return undefined;
  }

  return String(Math.min(unreadCount, 9));
}

function getInboxAccessibilityLabel(unreadCount: number) {
  if (unreadCount <= 0) {
    return 'Open Inbox';
  }

  const countLabel = unreadCount > 9 ? '9 or more' : String(unreadCount);
  const updateLabel = unreadCount === 1 ? 'update' : 'updates';

  return `Open Inbox, ${countLabel} unread ${updateLabel}`;
}

function InboxHeaderAction({
  onPress,
  unreadCount,
}: {
  onPress: () => void;
  unreadCount: number;
}) {
  const theme = useHoystTheme();
  const badgeText = getInboxBadgeText(unreadCount);

  return (
    <Pressable
      accessibilityLabel={getInboxAccessibilityLabel(unreadCount)}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({pressed}) => [
        styles.inboxHeaderAction,
        {
          backgroundColor: theme.actionSurface,
          borderColor: theme.actionBorder,
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          shadowColor: theme.actionShadowColor,
          shadowOpacity: theme.actionShadowOpacity,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <Bell color={theme.actionForeground} size={25} strokeWidth={2.2} />
      {badgeText ? (
        <View style={styles.inboxBadge}>
          <HoystText
            allowFontScaling={false}
            numberOfLines={1}
            style={styles.inboxBadgeText}>
            {badgeText}
          </HoystText>
        </View>
      ) : null}
    </Pressable>
  );
}

function AnimatedHomeGreeting({headline}: {headline: string}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(
    undefined,
  );
  const [displayedHeadline, setDisplayedHeadline] = useState(headline);

  useEffect(() => {
    let isActive = true;

    animationRef.current?.stop();

    if (headline === displayedHeadline) {
      const fadeIn = Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      });

      animationRef.current = fadeIn;
      fadeIn.start();

      return () => {
        isActive = false;
        fadeIn.stop();
      };
    }

    const fadeOut = Animated.timing(opacity, {
      duration: 140,
      toValue: 0,
      useNativeDriver: true,
    });

    animationRef.current = fadeOut;
    fadeOut.start(({finished}) => {
      if (!finished || !isActive) {
        return;
      }

      setDisplayedHeadline(headline);
      opacity.setValue(0);

      const fadeIn = Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      });

      animationRef.current = fadeIn;
      fadeIn.start();
    });

    return () => {
      isActive = false;
      fadeOut.stop();
    };
  }, [displayedHeadline, headline, opacity]);

  return (
    <Animated.View style={{opacity}}>
      <HoystText style={styles.homeGreetingHeadline} variant="headline">
        {displayedHeadline}
      </HoystText>
    </Animated.View>
  );
}

export function HomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [homeGreetingState, setHomeGreetingState] =
    useState<HomeGreetingState>();
  const [remoteMomentumSummary, setRemoteMomentumSummary] =
    useState<MomentumSummary>();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
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

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticatedHome || !user?.uid) {
        setHomeData(createEmptyHomeData(timezone));
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
    }, [isAuthenticatedHome, timezone, user?.uid]),
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

  const todayActionCircles = useMemo(
    () => getTodayAttentionCircles(homeData.circles),
    [homeData.circles],
  );
  const upcomingActionCircles = useMemo(
    () => getUpcomingAttentionCircles(homeData.circles),
    [homeData.circles],
  );
  const homeGreetingContext = useMemo(
    () =>
      getHomeGreetingContext({
        circles: homeData.circles,
        firstName: profile?.name,
        timezone,
      }),
    [homeData.circles, profile?.name, timezone],
  );
  const homeGreetingFallback = useMemo(
    () =>
      getHomeGreetingFallback({
        circles: homeData.circles,
        firstName: profile?.name,
        timezone,
      }),
    [homeData.circles, profile?.name, timezone],
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
    (homeData.hasLoadedMemberships || hasHomeDataError);
  const shouldHoldHomeGreeting =
    isAuthenticatedHome && !activeHomeGreetingState;
  const homeGreeting =
    activeHomeGreetingState?.headline ??
    (isAuthenticatedHome ? undefined : homeGreetingFallback);
  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);
  const momentumSummary =
    remoteMomentumSummary ?? buildMomentumSummaryFromHomeData(homeData);
  const showAccountPrompt = !isAuthenticatedHome;
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
  const showCreateCircleButton = shouldShowHomeCreateCircleButton({
    isAuthenticatedHome,
    showAccountPrompt,
  });

  useEffect(() => {
    clearExpiredHomeGreetingCacheEntries().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!canGenerateHomeGreeting) {
      setHomeGreetingState(undefined);
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
      } else {
        setHomeGreetingState(undefined);
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
    hasHomeDataError,
    homeData.hasLoadedMemberships,
    homeGreetingContext,
    homeGreetingDateKey,
    homeGreetingFallback,
    homeGreetingRequestKey,
    isAuthenticatedHome,
    isLoadingHomeData,
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

  const openCreateCircle = () => {
    requireAccount({type: 'createCircle'}, () =>
      rootNavigation?.navigate('CreateCircle'),
    );
  };

  const openInbox = () => {
    setUnreadInboxCount(0);

    if (isAuthenticatedHome && user?.uid) {
      markAllInboxEventsRead().catch(() => undefined);
    }

    rootNavigation?.navigate('Inbox');
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <View style={styles.topActions}>
          <InboxHeaderAction
            onPress={openInbox}
            unreadCount={unreadInboxCount}
          />
          <HeaderAction
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatarHeaderAction}>
            <LayeredAvatar
              initials={initials}
              imageSource={avatarSource}
              size={38}
              state="done"
            />
          </HeaderAction>
        </View>
      </View>

      <View style={styles.heroCopy}>
        {homeGreeting ? (
          <AnimatedHomeGreeting headline={homeGreeting} />
        ) : shouldHoldHomeGreeting ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.homeGreetingPlaceholder}>
            <View
              style={[
                styles.homeGreetingSkeletonLine,
                {
                  backgroundColor: theme.surfaceStrong,
                  borderColor: theme.border,
                },
              ]}
            />
            <View
              style={[
                styles.homeGreetingSkeletonLineShort,
                {
                  backgroundColor: theme.surfaceStrong,
                  borderColor: theme.border,
                },
              ]}
            />
          </View>
        ) : null}
        <HoystText tone="muted" variant="label">
          {homeData.todayLabel}
        </HoystText>
      </View>

      <View style={styles.momentumStack}>
        <Pressable
          accessibilityLabel={`Your momentum. ${momentumSummary.percentage}%. ${
            momentumSummary.label
          }. ${formatOpportunityCount(momentumSummary)}`}
          accessibilityRole="button"
          onPress={() => navigation.navigate('Momentum')}
          style={({pressed}) => [
            styles.momentumPanelPressable,
            {
              opacity: pressed ? actionMotion.pressedOpacity : 1,
              transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
            },
          ]}>
          <GlassPanel padding="compact" style={styles.momentumPanel}>
            <View style={styles.momentumPanelContent}>
              <View style={styles.momentumStageIconWrap}>
                <MomentumStageIcon
                  status={momentumSummary.status}
                  size={MOMENTUM_ICON_SIZE}
                />
              </View>
              <View style={styles.momentumCopy}>
                <HoystText
                  numberOfLines={1}
                  style={styles.momentumTitleText}
                  tone="muted">
                  Your momentum
                </HoystText>
                <View style={styles.momentumValueRow}>
                  <HoystText style={styles.momentumPercent}>
                    {momentumSummary.percentage}%
                  </HoystText>
                  <MomentumStatusPill
                    label={momentumSummary.label}
                    status={momentumSummary.status}
                  />
                </View>
                <HoystText
                  numberOfLines={2}
                  style={styles.momentumMetaText}
                  tone="muted">
                  {formatOpportunityCount(momentumSummary)}
                </HoystText>
              </View>
              <View style={styles.momentumTrendWrap}>
                <MomentumBars percentage={momentumSummary.percentage} />
              </View>
            </View>
          </GlassPanel>
        </Pressable>

        <HomeStreakCalendar
          days={homeData.progressDays}
          streakDays={homeData.personalStreakDays}
        />
      </View>

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
              label={isIncompleteProfile ? 'Complete profile' : 'Get started'}
              onPress={openAccountAuth}
            />
            <HoystButton
              label="Find circles"
              onPress={() => navigation.navigate('Circles')}
              variant="outline"
            />
          </View>
        </GlassPanel>
      ) : null}

      {isAuthenticatedHome ? (
        <View style={styles.circlesSection}>
          <SectionHeader
            description={
              showAuthenticatedEmptyState
                ? 'Create a Circle or find one in Circles to begin tracking real Tap Ins.'
                : 'These circles need your attention for tap-in or nudging others.'
            }
            title="Today"
          />

          {todayActionCircles.length > 0 ? (
            todayActionCircles.map(circle => (
              <TodayCircleCard
                card={circle}
                isNudged={nudgedCircleIds.has(circle.id)}
                isNudging={nudgingCircleIds.has(circle.id)}
                key={circle.id}
                onActionPress={() => handleCircleAction(circle)}
                onCardPress={() => openCircleDetail(circle.id)}
                variant="today"
              />
            ))
          ) : !showAuthenticatedEmptyState ? (
            <GlassPanel style={styles.emptyPanel}>
              <SectionHeader
                description="No Tap In or Nudge needs your attention today."
                title="Today is clear"
              />
            </GlassPanel>
          ) : null}
        </View>
      ) : null}

      {isAuthenticatedHome && upcomingActionCircles.length > 0 ? (
        <View style={styles.circleSectionGroup}>
          <SectionHeader
            description="Circles that will need attention tomorrow or later this week."
            title="Upcoming"
          />
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
              onPress={() => navigation.navigate('Circles')}
            />
            <HoystButton
              label="Create Circle"
              onPress={openCreateCircle}
              variant="outline"
            />
          </View>
        </GlassPanel>
      ) : null}

      {showCreateCircleButton ? (
        <Pressable
          accessibilityLabel="Create Circle"
          hitSlop={8}
          onPress={openCreateCircle}
          style={({pressed}) => [
            styles.createButtonPressable,
            {
              opacity: pressed ? actionMotion.pressedOpacity : 1,
              shadowColor: theme.actionShadowColor,
              shadowOpacity: theme.actionShadowOpacity,
              transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
            },
          ]}>
          <View
            style={[
              styles.createButton,
              {
                backgroundColor: theme.actionSurface,
                borderColor: theme.actionBorder,
              },
            ]}>
            <View style={styles.createIcon}>
              <TapInRingMark innerSize={19} outerSize={34} />
            </View>
            <HoystText
              numberOfLines={1}
              style={[
                styles.createButtonLabel,
                {color: theme.actionForeground},
              ]}
              variant="button">
              Create Circle
            </HoystText>
          </View>
        </Pressable>
      ) : null}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 172,
  },
  upcomingScroll: {
    marginHorizontal: -20,
  },
  upcomingScrollContent: {
    gap: 12,
    paddingHorizontal: 20,
  },
  circleSectionGroup: {
    gap: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    alignSelf: 'center',
    height: 38,
    width: 90,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarHeaderAction: {
    transform: [{translateY: -4}],
  },
  inboxBadge: {
    alignItems: 'center',
    backgroundColor: brandColors.red,
    borderColor: brandColors.white,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  inboxBadgeText: {
    color: brandColors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
    textAlign: 'center',
  },
  inboxHeaderAction: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    overflow: 'visible',
    shadowOffset: {height: 4, width: 0},
    shadowRadius: 10,
    width: 44,
  },
  heroCopy: {
    gap: 8,
  },
  homeGreetingHeadline: {
    fontSize: 25,
    letterSpacing: 0,
    lineHeight: 29,
  },
  homeGreetingPlaceholder: {
    gap: 8,
    minHeight: 58,
    paddingTop: 3,
  },
  homeGreetingSkeletonLine: {
    borderRadius: 8,
    borderWidth: 1,
    height: 20,
    opacity: 0.7,
    width: '92%',
  },
  homeGreetingSkeletonLineShort: {
    borderRadius: 8,
    borderWidth: 1,
    height: 20,
    opacity: 0.5,
    width: '64%',
  },
  momentumCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  momentumBar: {
    borderRadius: radius.pill,
    width: 7,
  },
  momentumBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 56,
  },
  momentumPanel: {
    minHeight: 104,
  },
  momentumPanelContent: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  momentumPanelPressable: {
    borderRadius: radius.lg,
  },
  momentumStack: {
    gap: 10,
  },
  momentumPercent: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 30,
  },
  momentumStageIconWrap: {
    alignItems: 'center',
    flexShrink: 0,
    height: MOMENTUM_ICON_SIZE,
    justifyContent: 'center',
    marginRight: 4,
    width: MOMENTUM_ICON_SIZE,
  },
  momentumTitleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  momentumMetaText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  momentumTrendWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 9,
  },
  momentumValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minWidth: 0,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  streakCalendarBadge: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
  },
  streakCalendarDay: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.25,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  streakCalendarDayText: {
    fontSize: 14,
    lineHeight: 18,
  },
  streakCalendarGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  streakCalendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakCalendarPanel: {
    gap: 14,
    minHeight: 108,
  },
  circlesSection: {
    gap: 14,
  },
  circlesHeader: {
    gap: 8,
  },
  createButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 68,
    overflow: 'hidden',
    paddingHorizontal: 24,
    width: '100%',
  },
  createButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  createButtonPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    elevation: actionShadow.elevation,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
    width: '100%',
  },
  createIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyActions: {
    gap: 12,
  },
  emptyCopy: {
    gap: 8,
  },
  emptyPanel: {
    gap: 16,
  },
});
