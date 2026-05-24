import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, Pressable, Share, StyleSheet, View} from 'react-native';
import {Bell, ChevronRight, Medal} from 'lucide-react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {actionMotion, actionShadow} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {
  createEmptyHomeData,
  getHomeFilterCounts,
  getHomeGreetingContext,
  getHomeGreetingFallback,
  getHomePersonalProgressState,
  matchesHomeCircleFilter,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeCreateCircleButton,
  shouldShowHomeDataErrorPanel,
  sortHomeCircles,
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
  CircleManagementFilter,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {nudgeCircleMembers} from '../../circles/services/circle-service';

const filterLabels: Record<CircleManagementFilter, string> = {
  all: 'All',
  needsYou: 'Needs you',
  atRisk: 'At risk',
  done: 'Done',
};

const filterTones: Record<
  CircleManagementFilter,
  NonNullable<React.ComponentProps<typeof HoystChip>['tone']>
> = {
  all: 'neutral',
  needsYou: 'orange',
  atRisk: 'purple',
  done: 'green',
};

const filters: CircleManagementFilter[] = ['all', 'needsYou', 'atRisk', 'done'];

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

function HeaderAction({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.headerAction,
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
  const [activeFilter, setActiveFilter] =
    useState<CircleManagementFilter>('all');
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [nudgedCircleIds, setNudgedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingCircleIds, setNudgingCircleIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [homeGreetingState, setHomeGreetingState] =
    useState<HomeGreetingState>();
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

  const filterCounts = useMemo(
    () => getHomeFilterCounts(homeData.circles),
    [homeData.circles],
  );
  const displayedCircles = useMemo(
    () =>
      sortHomeCircles(
        homeData.circles.filter(circle =>
          matchesHomeCircleFilter(circle, activeFilter),
        ),
      ),
    [activeFilter, homeData.circles],
  );
  const selectedFilterChipStyles = useMemo(
    () => ({
      all: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.textMuted,
      },
      needsYou: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.warningForeground,
      },
      atRisk: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.accentSecondaryForeground,
      },
      done: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.successForeground,
      },
    }),
    [
      theme.accentSecondaryForeground,
      theme.successForeground,
      theme.surfaceStrong,
      theme.textMuted,
      theme.warningForeground,
    ],
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
  const progressLabel =
    isAuthenticatedHome && homeData.hasRealProgress
      ? `${homeData.progressPercent}%`
      : 'Start';
  const personalProgressState = getHomePersonalProgressState({
    homeData,
    isAuthenticatedHome,
    isIncompleteProfile,
  });
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
            ? `${result.nudged} member${
                result.nudged === 1 ? '' : 's'
              } nudged.`
            : 'Everyone has completed their Commitment Frequency.',
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
    if (circle.viewerMembershipStatus === 'pending') {
      openCircleDetail(circle.id);
      return;
    }

    if (!circle.viewerHasCheckedIn && !circle.viewerHasTappedInToday) {
      requireAccount({circleId: circle.id, source: 'home', type: 'tapIn'}, () =>
        rootNavigation?.navigate('TapInComposer', {
          circleId: circle.id,
          source: 'home',
        }),
      );
      return;
    }

    if ((circle.nudgeTargetCount ?? 0) > 0) {
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

  const handlePersonalProgressPress = () => {
    if (personalProgressState.action === 'auth') {
      openAccountAuth();
      return;
    }

    if (personalProgressState.action === 'finishProfile') {
      setOnboardingStep('finishProfile');
      navigateToAuthWelcome(rootNavigation);
      return;
    }

    if (personalProgressState.action === 'chooseProgressStart') {
      Alert.alert(
        'Start Progression',
        'Choose how you want to make your first Tap In count.',
        [
          {
            text: 'Explore circles',
            onPress: () => navigation.navigate('Explore'),
          },
          {
            text: 'Create Circle',
            onPress: openCreateCircle,
          },
          {
            style: 'cancel',
            text: 'Cancel',
          },
        ],
      );
      return;
    }

    if (personalProgressState.action === 'shareProgress') {
      Share.share({
        message: "I finished today's Hoyst Tap Ins. Your move.",
        title: 'Hoyst Progression',
      }).catch(() => undefined);
      return;
    }

    navigation.navigate('Profile');
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <View style={styles.topActions}>
          <HeaderAction onPress={() => navigation.navigate('Inbox')}>
            <Bell
              color={theme.accentSecondaryForeground}
              size={22}
              strokeWidth={2.2}
            />
          </HeaderAction>
          <HeaderAction onPress={() => navigation.navigate('Profile')}>
            <LayeredAvatar
              initials={initials}
              imageSource={avatarSource}
              size={32}
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

      <GlassPanel style={styles.progressPanel}>
        <View style={styles.progressHeader}>
          <HoystText style={styles.progressTitle} tone="muted" variant="label">
            Last 7 Days
          </HoystText>
          <HoystText style={styles.progressPercent} variant="bodyStrong">
            {progressLabel}
          </HoystText>
        </View>
        <View style={styles.progressGrid}>
          {homeData.progressDays.map(day => {
            const isDone = day.state === 'done';
            const isMissed = day.state === 'missed';
            const isToday = day.state === 'today';
            const progressCellStateStyle = isDone
              ? {
                  backgroundColor: `${theme.success}14`,
                  borderColor: `${theme.successForeground}55`,
                }
              : isMissed
              ? {
                  backgroundColor: `${theme.danger}14`,
                  borderColor: `${theme.dangerForeground}55`,
                }
              : isToday
              ? {
                  backgroundColor: `${theme.accentSecondary}16`,
                  borderColor: `${theme.accentSecondaryForeground}80`,
                  borderStyle: 'dashed' as const,
                }
              : undefined;
            const progressCellThemeStyle = progressCellStateStyle
              ? undefined
              : {
                  backgroundColor: theme.surfaceStrong,
                  borderColor: theme.border,
                };

            return (
              <View
                key={day.label}
                style={[
                  styles.progressCell,
                  progressCellStateStyle,
                  progressCellThemeStyle,
                ]}>
                <HoystText
                  style={{
                    color: isDone
                      ? theme.successForeground
                      : isMissed
                      ? theme.dangerForeground
                      : isToday
                      ? theme.accentSecondaryForeground
                      : theme.textMuted,
                  }}
                  variant="bodyStrong">
                  {day.label}
                </HoystText>
              </View>
            );
          })}
        </View>
      </GlassPanel>

      <Pressable
        accessibilityLabel={`${personalProgressState.label}. ${personalProgressState.detail}`}
        accessibilityRole="button"
        onPress={handlePersonalProgressPress}
        style={({pressed}) => [
          styles.streakSummaryPressable,
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}>
        <View
          style={[
            styles.streakSummary,
            {
              backgroundColor: theme.surfaceStrong,
              borderColor: theme.border,
            },
          ]}>
          <View style={[styles.streakIconWrap, styles.streakIconTint]}>
            <Medal
              color={theme.warningForeground}
              size={20}
              strokeWidth={2.1}
            />
          </View>
          <View style={styles.streakCopy}>
            <HoystText style={styles.streakEyebrow} tone="muted" variant="tiny">
              Personal Progression
            </HoystText>
            <HoystText style={styles.streakValue}>
              {personalProgressState.label}
            </HoystText>
          </View>
          <ChevronRight color={theme.textSubtle} size={20} strokeWidth={2.2} />
        </View>
      </Pressable>

      {showAccountPrompt ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyCopy}>
            <HoystText variant="title">
              {isIncompleteProfile
                ? 'Complete your profile'
                : 'Start making Progression'}
            </HoystText>
            <HoystText tone="muted">
              {isIncompleteProfile
                ? 'Finish your handle and profile before circles and Tap Ins unlock.'
                : 'Get started to save Progression, join Circles, and build your Tap In streak.'}
            </HoystText>
          </View>
          <View style={styles.emptyActions}>
            <HoystButton
              label={isIncompleteProfile ? 'Complete profile' : 'Get started'}
              onPress={openAccountAuth}
            />
            <HoystButton
              label="Explore circles"
              onPress={() => navigation.navigate('Explore')}
              variant="outline"
            />
          </View>
        </GlassPanel>
      ) : null}

      {isAuthenticatedHome ? (
        <View style={styles.circlesSection}>
          <View style={styles.circlesHeader}>
            <HoystText variant="title">Your circles</HoystText>
            <HoystText tone="muted">
              {showAuthenticatedEmptyState
                ? 'Create a Circle or find one in Explore to begin tracking real Tap Ins.'
                : 'Manage your Circles, invite your people, and handle what needs you this week.'}
            </HoystText>
          </View>

          {homeData.circles.length > 0 ? (
            <View style={styles.filterRow}>
              {filters.map(filter => {
                const isSelected = activeFilter === filter;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{selected: isSelected}}
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    style={({pressed}) => [
                      styles.filterChipButton,
                      {opacity: pressed ? 0.88 : 1},
                    ]}>
                    <HoystChip
                      label={`${filterLabels[filter]} ${filterCounts[filter]}`}
                      style={[
                        styles.filterChip,
                        isSelected
                          ? selectedFilterChipStyles[filter]
                          : styles.filterChipInactive,
                      ]}
                      tone={filterTones[filter]}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {isLoadingHomeData ? (
        <GlassPanel style={styles.emptyPanel}>
          <HoystText variant="title">Loading your circles</HoystText>
          <HoystText tone="muted">
            Pulling your live Circle Progression from Hoyst.
          </HoystText>
        </GlassPanel>
      ) : null}

      {showHomeDataErrorPanel ? (
        <GlassPanel style={styles.emptyPanel}>
          <HoystText variant="title">Could not load Home</HoystText>
          <HoystText tone="muted">
            Your account is connected, but Home could not load live circle data.
          </HoystText>
        </GlassPanel>
      ) : null}

      {showAuthenticatedEmptyState ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyActions}>
            <HoystButton
              label="Explore circles"
              onPress={() => navigation.navigate('Explore')}
            />
            <HoystButton
              label="Create Circle"
              onPress={openCreateCircle}
              variant="outline"
            />
          </View>
        </GlassPanel>
      ) : null}

      {displayedCircles.map(circle => (
        <TodayCircleCard
          card={circle}
          isNudged={nudgedCircleIds.has(circle.id)}
          isNudging={nudgingCircleIds.has(circle.id)}
          key={circle.id}
          onActionPress={() => handleCircleAction(circle)}
          onCardPress={() => openCircleDetail(circle.id)}
        />
      ))}

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
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    height: 34,
    width: 81,
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  progressPanel: {
    marginHorizontal: 0,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  progressPercent: {
    fontSize: 11,
    lineHeight: 11,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  progressCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 9,
    borderWidth: 1.25,
    flex: 1,
    justifyContent: 'center',
  },
  streakSummary: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    paddingHorizontal: 16,
  },
  streakSummaryPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    width: '100%',
  },
  streakIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  streakIconTint: {
    backgroundColor: 'rgba(255,138,61,0.14)',
  },
  streakCopy: {
    flex: 1,
    gap: 4,
  },
  streakEyebrow: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChipButton: {
    borderRadius: radius.pill,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipInactive: {
    borderColor: 'transparent',
  },
});
