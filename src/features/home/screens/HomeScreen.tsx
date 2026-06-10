import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, Share, StyleSheet, View} from 'react-native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {CircleSummaryRings} from '../../../design/components/CircleSummaryRings';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HomeHeroHeader, homeHeroPalettes} from '../../../design/components/HomeHeroHeader';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystText} from '../../../design/components/HoystText';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {TodayCircleCard} from '../../../design/components/TodayCircleCard';
import {WeekProgressStrip} from '../../../design/components/WeekProgressStrip';
import {actionMotion, actionShadow} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {getHomeAvatarBadgeKind, getHomeHeroCopy} from '../services/home-hero-copy';
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
  CircleActivityItem,
  CircleManagementCard,
  InboxEvent,
  MomentumSummary,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
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

function mapInboxEventToActivity(event: InboxEvent): CircleActivityItem {
  const actorName = event.actor?.displayName ?? event.title;

  return {
    actorAvatarUrl: event.actor?.avatarUrl,
    actorInitials: getInitials(actorName) || 'HO',
    actorName,
    actionLabel: event.type === 'join_request' ? 'Review' : 'Update',
    id: event.id,
    message: event.body,
    timestamp: event.createdAtLabel,
    tone:
      event.type === 'circle_at_risk' || event.type === 'tap_in_final_warning'
        ? 'alert'
        : event.type === 'join_approved' || event.type === 'member_joined'
        ? 'success'
        : 'pending',
  };
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
  const bubbleText =
    activeHomeGreetingState?.headline ??
    (isAuthenticatedHome ? undefined : homeGreetingFallback);
  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);
  const momentumSummary =
    remoteMomentumSummary ?? buildMomentumSummaryFromHomeData(homeData);
  const avatarBadgeKind = getHomeAvatarBadgeKind(events[0]?.type);
  const heroCopy = getHomeHeroCopy({
    dateKey: homeData.todayDateKey,
    momentumStatus: momentumSummary.status,
    streakDays: homeData.personalStreakDays,
    timeWindow: homeGreetingContext.timeWindow,
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
  const companionUpdates = useMemo(
    () => events.slice(0, 2).map(mapInboxEventToActivity),
    [events],
  );
  const heroPalette = theme.isDark
    ? homeHeroPalettes.dark
    : homeHeroPalettes.light;
  const sheetColor = theme.isDark ? theme.backgroundElevated : '#FFFFFF';

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

  const openEvent = (event: InboxEvent) => {
    markInboxEventRead(event.id).catch(() => undefined);

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
    <View style={[styles.root, {backgroundColor: sheetColor}]}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{backgroundColor: heroPalette.background}}>
        <HomeHeroHeader
          avatarAccessibilityLabel={getInboxAccessibilityLabel(
            unreadInboxCount,
          )}
          avatarSource={avatarSource}
          badgeKind={avatarBadgeKind}
          bubbleText={bubbleText}
          copy={heroCopy}
          initials={initials}
          momentumPercent={momentumSummary.percentage}
          momentumStatus={momentumSummary.status}
          onAvatarPress={openInbox}
          onMomentumPress={() => navigation.navigate('Momentum')}
          unreadBadgeText={getInboxBadgeText(unreadInboxCount)}
        />
        <View style={[styles.sheet, {backgroundColor: sheetColor}]}>
          <View style={styles.stripSection}>
            <SectionEyebrow>Recent activity and streak</SectionEyebrow>
            <WeekProgressStrip
              days={homeData.progressDays}
              streakDays={homeData.personalStreakDays}
            />
          </View>

          <CircleSummaryRings
            contributionPercent={homeData.progressPercent}
            momentumLabel={momentumSummary.label}
            momentumPercent={momentumSummary.percentage}
            momentumStatus={momentumSummary.status}
            onPress={() => navigation.navigate('Momentum')}
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
                  onPress={() => navigation.navigate('Circles')}
                  variant="outline"
                />
              </View>
            </GlassPanel>
          ) : null}

          {isAuthenticatedHome ? (
            <View style={styles.circlesSection}>
              <SectionEyebrow>Circles need your attention</SectionEyebrow>

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

          {isAuthenticatedHome ? (
            <View style={styles.circleSectionGroup}>
              <SectionEyebrow>Companion updates</SectionEyebrow>
              {companionUpdates.length > 0 ? (
                companionUpdates.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openEvent(events[index])}>
                    <ActivityFeedCard item={item} />
                  </Pressable>
                ))
              ) : (
                <GlassPanel>
                  <SectionHeader
                    description="Nudges, joins, and circle milestones will appear here."
                    title="No companion updates yet"
                  />
                </GlassPanel>
              )}
            </View>
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexGrow: 1,
    gap: 24,
    marginTop: -28,
    paddingBottom: 172,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  stripSection: {
    gap: 12,
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
  circlesSection: {
    gap: 14,
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
  emptyPanel: {
    gap: 16,
  },
});
