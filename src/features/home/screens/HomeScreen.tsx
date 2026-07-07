import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
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
import {
  getHomeAvatarBadgeKind,
  getHomeHeroCopy,
} from '../services/home-hero-copy';
import {
  createEmptyHomeData,
  getHomeCircleActionVariant,
  getHomeGreetingContext,
  getHomeGreetingFallback,
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
                accessibilityLabel="All my circles"
                onPress={() => rootNavigation?.navigate('Circles')}
                renderIcon={color => (
                  <UsersRound color={color} size={24} strokeWidth={2.4} />
                )}
                subtitle="View commitments and join requests"
                testID="all-my-circles-card"
                title="All my circles"
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
