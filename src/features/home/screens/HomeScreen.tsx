import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, View} from 'react-native';
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
  matchesHomeCircleFilter,
  shouldShowAuthenticatedHomeEmptyState,
  shouldShowHomeCreateCircleButton,
  shouldShowHomeDataErrorPanel,
  sortHomeCircles,
  subscribeToHomeData,
  type HomeData,
} from '../services/home-data-service';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../../profile/services/profile-display';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import type {
  CircleManagementCard,
  CircleManagementFilter,
} from '../../../types/models';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';

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

export function HomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();
  const [activeFilter, setActiveFilter] =
    useState<CircleManagementFilter>('all');
  const [homeData, setHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const [hasHomeDataError, setHasHomeDataError] = useState(false);
  const [pokedCircleIds, setPokedCircleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );
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
        borderColor: theme.warning,
      },
      atRisk: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.accentSecondary,
      },
      done: {
        backgroundColor: theme.surfaceStrong,
        borderColor: theme.success,
      },
    }),
    [
      theme.accentSecondary,
      theme.success,
      theme.surfaceStrong,
      theme.textMuted,
      theme.warning,
    ],
  );
  const firstName = profile ? profile.name.split(' ')[0] : 'there';
  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);
  const progressLabel =
    isAuthenticatedHome && homeData.hasRealProgress
      ? `${homeData.progressPercent}%`
      : 'Start';
  const streakLabel =
    homeData.personalStreakDays > 0
      ? `${homeData.personalStreakDays}-day streak`
      : 'Start your streak';
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

  const openAccountAuth = () => {
    if (isIncompleteProfile) {
      rootNavigation?.navigate('Auth', {screen: 'CompleteProfile'});
      return;
    }

    clearPendingAction();
    beginAuthFlow();
    startOnboardingWizard();
    rootNavigation?.navigate('Auth', {screen: 'Welcome'});
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

  const pokeCircle = (circle: CircleManagementCard) => {
    if (circle.remainingCheckIns <= 0) {
      openCircleDetail(circle.id);
      return;
    }

    setPokedCircleIds(currentPokedCircleIds => {
      if (currentPokedCircleIds.has(circle.id)) {
        return currentPokedCircleIds;
      }

      const nextPokedCircleIds = new Set(currentPokedCircleIds);
      nextPokedCircleIds.add(circle.id);
      return nextPokedCircleIds;
    });
  };

  const handleCircleAction = (circle: CircleManagementCard) => {
    if (circle.viewerMembershipStatus === 'pending') {
      openCircleDetail(circle.id);
      return;
    }

    if (!circle.viewerHasCheckedIn) {
      requireAccount(
        {circleId: circle.id, source: 'home', type: 'tapIn'},
        () =>
          rootNavigation?.navigate('TapInComposer', {
            circleId: circle.id,
            source: 'home',
          }),
      );
      return;
    }

    if (circle.remainingCheckIns > 0) {
      pokeCircle(circle);
      return;
    }

    shareCircle(circle);
  };

  const openCreateCircle = () => {
    requireAccount({type: 'createCircle'}, () =>
      rootNavigation?.navigate('CreateCircle'),
    );
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        <View style={styles.topActions}>
          <HeaderAction onPress={() => navigation.navigate('Inbox')}>
            <Bell color={theme.accentSecondary} size={22} strokeWidth={2.2} />
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
        <HoystText variant="headline">Good morning, {firstName}</HoystText>
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
              ? styles.progressCellDone
              : isMissed
                ? styles.progressCellMissed
                : isToday
                  ? styles.progressCellToday
                  : undefined;
            const progressCellThemeStyle = progressCellStateStyle
              ? undefined
              : {backgroundColor: theme.surfaceStrong, borderColor: theme.border};

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
                      ? theme.success
                      : isMissed
                        ? theme.danger
                        : isToday
                          ? theme.accentSecondary
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

      <View
        style={[
          styles.streakSummary,
          {
            backgroundColor: theme.surfaceStrong,
            borderColor: theme.border,
          },
        ]}>
        <View style={[styles.streakIconWrap, styles.streakIconTint]}>
          <Medal color={theme.warning} size={20} strokeWidth={2.1} />
        </View>
        <View style={styles.streakCopy}>
          <HoystText style={styles.streakEyebrow} tone="muted" variant="tiny">
            Personal Progress
          </HoystText>
          <HoystText style={styles.streakValue}>{streakLabel}</HoystText>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} strokeWidth={2.2} />
      </View>

      {showAccountPrompt ? (
        <GlassPanel style={styles.emptyPanel}>
          <View style={styles.emptyCopy}>
            <HoystText variant="title">
              {isIncompleteProfile
                ? 'Complete your profile'
                : 'Start making progress'}
            </HoystText>
            <HoystText tone="muted">
              {isIncompleteProfile
                ? 'Finish your handle and profile before circles and Tap Ins unlock.'
                : 'Get started to save progress, join circles, and build your Tap In streak.'}
            </HoystText>
          </View>
          <View style={styles.emptyActions}>
            <HoystButton
              label={
                isIncompleteProfile ? 'Complete profile' : 'Get started'
              }
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
                ? 'Create a circle or find one in Explore to begin tracking real Tap Ins.'
                : 'Manage your circles, invite your people, and handle what needs you today.'}
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
            Pulling your live circle progress from Hoyst.
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
          isPoked={pokedCircleIds.has(circle.id)}
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
              style={[styles.createButtonLabel, {color: theme.actionForeground}]}
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
  progressCellDone: {
    backgroundColor: 'rgba(68,216,92,0.14)',
    borderColor: 'rgba(68,216,92,0.34)',
  },
  progressCellMissed: {
    backgroundColor: 'rgba(255,110,132,0.14)',
    borderColor: 'rgba(255,110,132,0.32)',
  },
  progressCellToday: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(186,158,255,0.5)',
    borderStyle: 'dashed',
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
