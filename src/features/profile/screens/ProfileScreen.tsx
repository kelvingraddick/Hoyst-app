import React, {useEffect, useRef} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CalendarCheck,
  ChevronRight,
  Pencil,
  Settings,
  Share2,
  Trophy,
  UsersRound,
} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  DSButton,
  DSIconButton,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {navigateToAuthWelcome} from '../../../navigation/auth-modal-navigation';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useSessionStore} from '../../../store/session-store';
import {ProfileAvatar} from '../components/ProfileAvatar';
import {
  ProfileIcon,
  ProfileScaffold,
  ProfileTheme,
} from '../components/ProfileScaffold';
import {
  ProfileStats,
  ProfileTextLink,
  ProfileXP,
} from '../components/ProfileSummaryParts';
import {useProfileOverview} from '../hooks/useProfileOverview';
import {getEarnedProfileMilestones} from '../services/profile-personalization';
import {useProfilePreview} from '../components/ProfilePreviewContext';

type Props = BottomTabScreenProps<AppTabsParamList, 'Profile'>;
export function ProfileScreen(props: Props) {
  return (
    <ProfileTheme>
      <Content {...props} />
    </ProfileTheme>
  );
}
function Content({navigation}: Props) {
  const theme = useSystemTheme();
  const overview = useProfileOverview();
  const preview = useProfilePreview();
  const {width, fontScale} = useWindowDimensions();
  const stackBests = width < 360 || fontScale > 1.3;
  const scrollRef = useRef<ScrollView>(null);
  const fallbackUrl = useSessionStore(state => state.user?.photoURL);
  const root =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const openProgress = (section: 'xp' | 'streak' | 'momentum') =>
    root?.navigate('ProgressDetails', {section});
  const profile = overview.profile;
  const stats = overview.stats;
  const earned = getEarnedProfileMilestones(overview.progress);
  const onGetStarted = () => {
    if (preview) return;
    const session = useSessionStore.getState();
    session.clearPendingAction();
    session.beginAuthFlow();
    const onboarding = useOnboardingStore.getState();
    if (overview.status === 'incomplete')
      onboarding.setCurrentStep('finishProfile');
    else onboarding.startOnboardingWizard();
    navigateToAuthWelcome(root);
  };
  useEffect(() => {
    if (preview?.captureBottom) {
      const timer = setTimeout(
        () => scrollRef.current?.scrollToEnd({animated: false}),
        400,
      );
      return () => clearTimeout(timer);
    }
  }, [preview?.captureBottom]);
  const trailing = profile ? (
    <View style={[styles.gear, {backgroundColor: theme.surface}]}>
      <DSIconButton
        label="Settings"
        onPress={() => root?.navigate('Settings')}
        icon={<Settings size={22} color={theme.text} />}
        testID="profile-settings"
      />
    </View>
  ) : undefined;
  const leading = profile ? (
    <View style={[styles.gear, {backgroundColor: theme.surface}]}>
      <DSIconButton
        label="Share profile"
        onPress={() => root?.navigate('ProfileShare')}
        icon={<Share2 size={22} color={theme.text} />}
        testID="profile-share"
      />
    </View>
  ) : undefined;
  return (
    <ProfileScaffold
      tab
      leading={leading}
      trailing={trailing}
      scrollRef={scrollRef}>
      {!profile ? (
        <DSSurface raised style={styles.guest}>
          <ProfileIcon icon={UsersRound} tone="green" />
          <DSText variant="heading">
            {overview.status === 'loading'
              ? 'Loading your profile'
              : overview.status === 'incomplete'
              ? 'Complete your profile'
              : 'Make your progress yours'}
          </DSText>
          <DSText tone="muted">
            {overview.status === 'loading'
              ? 'Your saved identity and accomplishments will appear here.'
              : overview.status === 'incomplete'
              ? 'Choose your username to unlock your profile and commitments.'
              : 'Save your identity, build commitments, and celebrate the days you show up.'}
          </DSText>
          {overview.status !== 'loading' ? (
            <DSButton
              label={
                overview.status === 'incomplete'
                  ? 'Complete profile'
                  : 'Get started'
              }
              onPress={onGetStarted}
              testID="profile-get-started"
            />
          ) : null}
        </DSSurface>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              <ProfileAvatar
                profile={profile}
                fallbackUrl={preview ? undefined : fallbackUrl}
                size={104}
              />
              <DSIconButton
                label="Edit profile photo"
                onPress={() =>
                  root?.navigate('EditProfile', {focusPhoto: true})
                }
                style={styles.pencil}
                icon={
                  <View
                    style={[styles.pencilFace, {borderColor: theme.canvas}]}>
                    <Pencil size={16} color="#070B1A" />
                  </View>
                }
                testID="profile-edit-photo"
              />
            </View>
            <DSText variant="screenTitle" style={styles.center}>
              {profile.name}
            </DSText>
            <DSText tone="muted" style={styles.center}>
              @{profile.handle}
            </DSText>
            {profile.bio ? (
              <DSText tone="muted" style={[styles.center, styles.bio]}>
                {profile.bio}
              </DSText>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => root?.navigate('EditProfile')}
              style={styles.action}
              testID="profile-edit">
              <DSText variant="action" style={styles.actionText}>
                Edit profile
              </DSText>
            </Pressable>
          </View>
          {overview.error || overview.momentumError ? (
            <DSSurface>
              <DSText tone="danger" accessibilityLiveRegion="polite">
                {overview.error ?? 'Momentum is unavailable. Please try again.'}
              </DSText>
              <DSButton
                label="Try again"
                variant="quiet"
                onPress={overview.refresh}
                testID="profile-retry"
              />
            </DSSurface>
          ) : null}
          <ProfileXP
            summary={overview.progress}
            onPress={() => openProgress('xp')}
          />
          <View>
            <ProfileStats
              streak={
                stats
                  ? `${stats.personalStreakDays} ${
                      stats.personalStreakDays === 1 ? 'day' : 'days'
                    }`
                  : '-'
              }
              momentum={
                overview.momentumError
                  ? 'Unavailable'
                  : overview.momentumLabel ?? '-'
              }
              tapIns={stats ? stats.totalTapIns.toLocaleString() : '-'}
              onStreak={() => openProgress('streak')}
              onMomentum={() => openProgress('momentum')}
            />
            <ProfileTextLink
              label="View progress"
              onPress={() => navigation.navigate('Progress')}
              testID="profile-view-progress"
            />
          </View>
          <DSSurface raised>
            <Pressable
              accessibilityRole="button"
              onPress={() => root?.navigate('Circles')}
              style={styles.commitments}
              testID="profile-commitments">
              <View style={styles.categoryIcons}>
                {overview.categories?.length ? (
                  overview.categories.map(category => (
                    <CircleCategoryIcon
                      key={category}
                      category={category}
                      size={32}
                    />
                  ))
                ) : (
                  <ProfileIcon icon={UsersRound} tone="green" />
                )}
              </View>
              <View style={styles.grow}>
                <DSText variant="title">My commitments</DSText>
                <DSText variant="secondary" tone="muted">
                  {stats
                    ? `${
                        stats.activeCircleCount +
                        stats.activePersonalCommitmentCount
                      } active`
                    : 'Loading commitments'}
                  {overview.categories?.length
                    ? ` · ${overview.categories
                        .map(
                          category => getCircleCategoryVisual(category).label,
                        )
                        .join(', ')}`
                    : ''}
                </DSText>
              </View>
              <ChevronRight color={theme.muted} size={20} />
            </Pressable>
          </DSSurface>
          <View style={styles.bests}>
            <DSText accessibilityRole="header" variant="heading">
              Personal bests
            </DSText>
            <DSSurface
              style={[
                styles.bestSurface,
                {backgroundColor: theme.isDark ? '#302717' : '#FFF6DC'},
              ]}>
              <View
                style={[
                  styles.bestMetrics,
                  stackBests && styles.bestMetricsStack,
                ]}>
                <View
                  style={[
                    styles.bestMetric,
                    stackBests && styles.bestMetricStack,
                  ]}>
                  <ProfileIcon icon={Trophy} tone="gold" />
                  <View style={styles.grow}>
                    <DSText variant="statistic">
                      {stats
                        ? `${stats.longestStreakDays} ${
                            stats.longestStreakDays === 1 ? 'day' : 'days'
                          }`
                        : '-'}
                    </DSText>
                    <DSText variant="statCaption" tone="muted">
                      Longest streak
                    </DSText>
                  </View>
                </View>
                <View
                  style={[
                    styles.bestMetric,
                    stackBests && styles.bestMetricStack,
                  ]}>
                  <ProfileIcon icon={CalendarCheck} tone="green" />
                  <View style={styles.grow}>
                    <DSText variant="statistic">
                      {stats ? stats.totalTapIns.toLocaleString() : '-'}
                    </DSText>
                    <DSText variant="statCaption" tone="muted">
                      Total Tap Ins
                    </DSText>
                  </View>
                </View>
              </View>
              <View style={[styles.rule, {backgroundColor: theme.border}]} />
              <DSText variant="secondary" tone="muted">
                Earned milestones
              </DSText>
              <View style={styles.milestones}>
                {earned.slice(0, 3).map(milestone => (
                  <View
                    key={milestone.id}
                    style={[
                      styles.milestone,
                      {borderColor: theme.isDark ? '#AD842C' : '#C7962B'},
                    ]}>
                    <Trophy
                      size={14}
                      color={theme.isDark ? '#FFD269' : '#A36C00'}
                    />
                    <DSText variant="secondary">{milestone.label}</DSText>
                  </View>
                ))}
              </View>
              {!earned.length ? (
                <DSText tone="muted" variant="secondary">
                  {overview.progress
                    ? 'Your first earned milestone will appear here.'
                    : 'Loading earned milestones'}
                </DSText>
              ) : null}
              <ProfileTextLink
                label="View milestones"
                onPress={() => root?.navigate('ProfileMilestones')}
                testID="profile-milestones"
              />
            </DSSurface>
          </View>
        </>
      )}
    </ProfileScaffold>
  );
}
const styles = StyleSheet.create({
  gear: {borderRadius: 24},
  hero: {alignItems: 'center', gap: 4, paddingTop: 0},
  avatarWrap: {marginBottom: 4},
  pencil: {
    position: 'absolute',
    right: -9,
    bottom: -8,
    width: 48,
    height: 48,
  },
  pencilFace: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
  },
  center: {textAlign: 'center'},
  bio: {marginTop: 6},
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    backgroundColor: '#FFFFFF',
    maxWidth: '100%',
    minHeight: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  actionText: {color: '#000000', textAlign: 'center', flexShrink: 1},
  commitments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  categoryIcons: {flexDirection: 'row', flexWrap: 'wrap', maxWidth: 96},
  grow: {flex: 1, minWidth: 0},
  bests: {gap: 8},
  bestSurface: {gap: 8},
  bestMetrics: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  bestMetricsStack: {flexDirection: 'column', flexWrap: 'nowrap'},
  bestMetricStack: {flex: 0, width: '100%'},
  bestMetric: {
    flex: 1,
    minWidth: 125,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rule: {height: StyleSheet.hairlineWidth, marginVertical: 4},
  milestones: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  guest: {gap: 12},
});
