import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  History,
  RotateCcw,
  FastForward,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {
  DesignSystemProvider,
  DSSurface,
  DSText,
  DSButton,
  DSIconButton,
  minimumTarget,
  layout as systemLayout,
  space,
  useSystemTheme,
} from '../../../design/system';
import {brandColors} from '../../../design/tokens/colors';
import {useSettingsStore} from '../../../store/settings-store';
import {useSessionStore} from '../../../store/session-store';
import {useProgress} from '../hooks/useProgress';
import {ProgressGuestStart} from '../components/ProgressGuestStart';
import {ProgressLadder} from '../components/ProgressLadder';
import {ProgressStatsSection} from '../components/ProgressStatsSection';
import {ProgressStatsRow} from '../components/ProgressStatsRow';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {
  PROGRESS_TASKS,
  type ProgressTaskId,
  type ProgressSummary,
} from '../services/progress-service';
import {getProfileSummary} from '../../profile/services/profile-summary-service';
import {
  subscribeToMomentumSummary,
  getMomentumDisplayModel,
} from '../../momentum/services/momentum-service';
import {useQuery} from '@tanstack/react-query';
type Props = BottomTabScreenProps<AppTabsParamList, 'Progress'>;
export type ProgressSection =
  | 'xp'
  | 'streak'
  | 'momentum'
  | 'history'
  | 'checklist'
  | 'skips'
  | 'restores'
  | 'packs'
  | 'achievements'
  | 'dayActivity'
  | 'activity';
/** Read-only development fixtures reuse the production presentation without account or network access. */
export const ProgressPreviewContext = createContext<
  | undefined
  | {
      scheme: 'light' | 'dark';
      captureBottom?: boolean;
      captureEarning?: boolean;
      captureStats?: boolean;
      captureStatsDetails?: boolean;
      summary?: ProgressSummary;
      loading?: boolean;
      error?: string;
      guest?: boolean;
      streak: number;
      momentum: number;
    }
>(undefined);
export function ProgressScreen(props: Props) {
  const appearance = useSettingsStore(state => state.appearance);
  const preview = useContext(ProgressPreviewContext);
  return (
    <DesignSystemProvider scheme={preview?.scheme || appearance}>
      <ProgressContent {...props} />
    </DesignSystemProvider>
  );
}
export function ProgressBadge({
  icon: Icon,
  tone = 'blue',
  size = 40,
  color,
}: {
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'orange' | 'neutral';
  size?: number;
  color?: string;
}) {
  const theme = useSystemTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.category[tone].surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon size={size / 2} color={color ?? theme.category[tone].foreground} />
    </View>
  );
}
/** Bright fills are local to Progress; shared category buttons retain their defaults. */
function RewardBuyButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.rewardBuyTarget,
        {minHeight: minimumTarget(), minWidth: minimumTarget()},
        pressed && styles.pressed,
      ]}>
      <View style={[styles.rewardBuyFace, {backgroundColor: color}]}>
        <DSText variant="action" style={styles.rewardBuyLabel}>
          {label}
        </DSText>
      </View>
    </Pressable>
  );
}
export function ProgressRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const theme = useSystemTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <ProgressBadge icon={icon} />
      <View style={styles.grow}>
        <DSText variant="body">{title}</DSText>
        {subtitle ? (
          <DSText variant="secondary" tone="muted">
            {subtitle}
          </DSText>
        ) : null}
      </View>
      <ChevronRight color={theme.muted} size={20} />
    </Pressable>
  );
}
function ProgressContent({navigation}: Props) {
  const theme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const captureScroll = useRef<ScrollView>(null);
  const earningOffset = useRef(0);
  const statsOffset = useRef(0);
  const {fontScale, width: windowWidth} = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [rewardRowWidth, setRewardRowWidth] = useState<number>();
  const preview = useContext(ProgressPreviewContext);
  const live = useProgress(!preview);
  const {summary, uid, loading, error, refresh} = preview
    ? {
        ...preview,
        uid: preview.guest ? undefined : 'preview',
        refresh: () => undefined,
      }
    : live;
  const [expanded, setExpanded] = useState(false);
  const [momentumError, setMomentumError] = useState(false);
  const [momentum, setMomentum] =
    useState<ReturnType<typeof getMomentumDisplayModel>>();
  useEffect(() => {
    setMomentum(undefined);
    setMomentumError(false);
    if (!uid || preview) {
      return;
    }
    return subscribeToMomentumSummary({
      uid,
      onSummary: value => setMomentum(getMomentumDisplayModel(value)),
      onError: () => {
        setMomentum(undefined);
        setMomentumError(true);
      },
    });
  }, [uid, preview]);
  const stats = useQuery({
    queryKey: ['progressStats', uid],
    enabled: Boolean(uid) && !preview,
    queryFn: getProfileSummary,
    refetchOnMount: 'always',
  });
  const stack =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const open = (section: ProgressSection, packType?: 'skips' | 'restores') =>
    stack?.navigate('ProgressDetails', {section, packType});
  const taskAction = (id: ProgressTaskId) => {
    if (id === 'profile') {
      stack?.navigate('EditProfile');
    } else if (id === 'commitment') {
      stack?.navigate('CreateCircle');
    } else if (id === 'circle') {
      navigation.navigate('Explore');
    } else if (id === 'share_invite') {
      stack?.navigate('Circles');
    } else if (id === 'reminders') {
      open('checklist');
    } else {
      stack?.navigate('TapInPicker');
    }
  };
  const nextTask = PROGRESS_TASKS.find(task => !summary?.tasks[task.id]);
  const completed = PROGRESS_TASKS.filter(
    task => summary?.tasks[task.id],
  ).length;
  const canRoutine = (summary?.routineRemainingXP ?? 0) > 0;
  const unearned = [
    ['streak_3', 'Reach a 3-day personal streak', 10],
    ['streak_7', 'Reach a 7-day personal streak', 20],
    ['momentum_strong', 'Reach Strong momentum', 20],
    ['streak_14', 'Reach a 14-day personal streak', 30],
    ['momentum_peak', 'Reach Peak momentum', 30],
    ['streak_30', 'Reach a 30-day personal streak', 50],
    ['tap_ins_50', 'Complete 50 successful Tap Ins', 50],
  ].find(([id]) => !summary?.milestones[id as string]);
  const columns = width >= 360 && fontScale < 1.5;
  const rewardCardWidth =
    ((rewardRowWidth ?? Math.max(0, width - 2 * systemLayout.gutter)) - 12) / 2;
  const boostHorizontal = width >= 390 && fontScale <= 1.15;
  return (
    <View
      onLayout={({nativeEvent: {layout}}) => setWidth(layout.width)}
      style={[styles.flex, {backgroundColor: theme.canvas}]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />
      <LinearGradient
        pointerEvents="none"
        colors={[theme.isDark ? '#E9BA4626' : '#FFE69AA6', '#FFE69A00']}
        style={styles.tint}
      />
      <ScrollView
        ref={captureScroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={{top: insets.top, bottom: 0}}
        onContentSizeChange={
          preview?.captureBottom
            ? () => captureScroll.current?.scrollToEnd({animated: false})
            : preview?.captureStats
            ? () =>
                captureScroll.current?.scrollTo({
                  y: Math.max(
                    0,
                    statsOffset.current -
                      insets.top -
                      16 +
                      (preview?.captureStatsDetails ? 370 : 0),
                  ),
                  animated: false,
                })
            : preview?.captureEarning
            ? () =>
                captureScroll.current?.scrollTo({
                  y: earningOffset.current,
                  animated: false,
                })
            : undefined
        }
        style={[styles.flex, {marginBottom: insets.bottom}]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: space.xxl + 110,
            paddingLeft: systemLayout.gutter + insets.left,
            paddingRight: systemLayout.gutter + insets.right,
          },
        ]}>
        <View style={styles.header}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../../assets/hoy/progress-rewards-get-started.png')}
            style={styles.hoy}
          />
          <View style={styles.grow}>
            <DSText accessibilityRole="header" variant="screenTitle">
              Progress
            </DSText>
            <DSText variant="body" style={styles.subtitle}>
              Show up. Earn XP.{' '}
              <DSText variant="body" style={styles.subtitleEmphasis}>
                Unlock rewards.
              </DSText>
            </DSText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reward history"
            onPress={() => uid && open('history')}
            style={[
              styles.history,
              boostHorizontal && styles.headerHistory,
              {backgroundColor: theme.surface},
            ]}>
            <History size={21} color={theme.text} />
          </Pressable>
        </View>
        {!uid ? (
          <ProgressGuestStart
            onGetStarted={() => {
              const session = useSessionStore.getState();
              session.clearPendingAction();
              session.beginAuthFlow();
              useOnboardingStore.getState().startOnboardingWizard();
              stack?.navigate('Auth', {screen: 'Welcome'});
            }}
            onSignIn={() => {
              const session = useSessionStore.getState();
              session.clearPendingAction();
              session.beginAuthFlow();
              stack?.navigate('Auth', {screen: 'SignIn'});
            }}
          />
        ) : loading ? (
          <View accessibilityLabel="Loading Progress" style={styles.stack}>
            <ActivityIndicator color={theme.action} />
            <DSText tone="muted">Loading your progress…</DSText>
          </View>
        ) : !summary ? (
          <DSSurface style={styles.stack}>
            <DSText variant="heading">Progress is unavailable</DSText>
            <DSText tone="muted">
              {error || 'Your rewards could not be loaded.'}
            </DSText>
            <DSButton label="Try again" onPress={refresh} />
          </DSSurface>
        ) : (
          <>
            {error ? (
              <DSSurface>
                <DSText tone="danger">{error}</DSText>
                <DSButton variant="quiet" label="Refresh" onPress={refresh} />
              </DSSurface>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Level ${summary.level}. ${summary.levelXP} of ${summary.requiredXP} XP. ${summary.remainingXP} XP to level up.`}
              onPress={() => open('xp')}
              style={styles.xp}>
              <View style={[styles.wrap, {justifyContent: 'space-between'}]}>
                <View style={[styles.levelPill, {backgroundColor: '#FFFFFF'}]}>
                  <DSText variant="action" style={{color: '#070B1A'}}>
                    Level {summary.level}
                  </DSText>
                </View>
                <DSText variant="body">
                  <DSText variant="title">{summary.levelXP}</DSText> /{' '}
                  {summary.requiredXP} XP
                </DSText>
                <DSText variant="secondary" tone="muted">
                  {summary.remainingXP} XP to level up
                </DSText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: summary.requiredXP,
                  now: summary.levelXP,
                }}
                style={[styles.track, {backgroundColor: theme.track}]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${(summary.levelXP / summary.requiredXP) * 100}%`,
                    },
                  ]}
                />
              </View>
              <DSText variant="secondary" tone="muted">
                {summary.totalXP} total XP
              </DSText>
              {!summary.flags.earning ? (
                <DSText tone="muted" variant="secondary">
                  XP earning is paused. Your earned XP and rewards stay saved.
                </DSText>
              ) : null}
            </Pressable>
            <ProgressLadder summary={summary} onDetails={() => open('xp')} />
            <DSSurface
              raised
              style={styles.earnPanel}
              onLayout={({nativeEvent: {layout}}) => {
                earningOffset.current = Math.max(0, layout.y - 16);
                if (preview?.captureEarning) {
                  captureScroll.current?.scrollTo({
                    y: earningOffset.current,
                    animated: false,
                  });
                }
              }}>
              <DSText variant="action">Earn more XP</DSText>
              <View
                style={[
                  styles.earnRow,
                  !boostHorizontal && styles.boostVertical,
                ]}>
                <View style={[styles.earnTask, boostHorizontal && styles.grow]}>
                  <ProgressBadge icon={Users} size={44} />
                  <View style={styles.grow}>
                    <DSText variant="message" style={styles.taskTitle}>
                      {nextTask?.title ||
                        (canRoutine
                          ? 'Show up for your next Tap In'
                          : unearned?.[1] || 'All milestone bonuses earned')}
                    </DSText>
                    <DSText variant="secondary" tone="muted">
                      {nextTask?.description ||
                        (canRoutine
                          ? `${summary.routineRemainingXP} routine XP available today.`
                          : 'Your routine XP limit is reached. Bonuses remain available when you reach a new milestone.')}{' '}
                      <DSText
                        variant="secondary"
                        tone="action"
                        style={styles.subtitleEmphasis}>
                        {nextTask
                          ? '+10 XP'
                          : canRoutine
                          ? '+10 XP'
                          : unearned
                          ? `+${unearned[2]} XP milestone`
                          : 'No further XP available today'}
                      </DSText>
                    </DSText>
                  </View>
                </View>
                <DSIconButton
                  testID="progress-earning-action"
                  style={[
                    {width: minimumTarget(), height: minimumTarget()},
                    !boostHorizontal && styles.earnActionBelow,
                  ]}
                  icon={
                    <View
                      style={[
                        styles.earnArrow,
                        {backgroundColor: theme.actionFill},
                      ]}>
                      <ArrowRight size={18} color={theme.onAction} />
                    </View>
                  }
                  label={
                    nextTask?.action ||
                    (canRoutine ? 'Tap In' : 'View milestones')
                  }
                  onPress={() =>
                    nextTask
                      ? taskAction(nextTask.id)
                      : canRoutine
                      ? stack?.navigate('TapInPicker')
                      : open('xp')
                  }
                />
              </View>
              <View style={[styles.divider, {backgroundColor: theme.border}]} />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{expanded}}
                hitSlop={{
                  top: (minimumTarget() - 32) / 2,
                  bottom: (minimumTarget() - 32) / 2,
                }}
                onPress={() => setExpanded(value => !value)}
                style={[
                  styles.checklistRow,
                  fontScale > 1.15 && styles.checklistStack,
                ]}>
                <View
                  style={[
                    styles.checklistCount,
                    fontScale <= 1.15 && styles.grow,
                  ]}>
                  <ProgressBadge icon={Check} size={24} />
                  <DSText variant="secondary" style={styles.grow}>
                    {completed} of 7 complete
                  </DSText>
                </View>
                <View
                  style={[
                    styles.checklistAction,
                    fontScale > 1.15 && styles.earnActionBelow,
                  ]}>
                  <DSText variant="action" tone="action" style={styles.shrink}>
                    {expanded ? 'Hide checklist' : 'View checklist'}
                  </DSText>
                  <ChevronRight color={theme.action} size={18} />
                </View>
              </Pressable>
              {expanded
                ? PROGRESS_TASKS.map(task => (
                    <ProgressRow
                      key={task.id}
                      title={
                        task.title +
                        (summary.tasks[task.id] ? ' · Complete' : ' · +10 XP')
                      }
                      icon={summary.tasks[task.id] ? Check : ChevronRight}
                      onPress={() => taskAction(task.id)}
                    />
                  ))
                : null}
            </DSSurface>
            <ProgressStatsSection
              key={uid}
              onLayout={({nativeEvent: {layout}}) => {
                statsOffset.current = layout.y;
                if (preview?.captureStats)
                  captureScroll.current?.scrollTo({
                    y: Math.max(
                      0,
                      layout.y -
                        insets.top -
                        16 +
                        (preview?.captureStatsDetails ? 370 : 0),
                    ),
                    animated: false,
                  });
              }}
              uid={uid}
              width={width - systemLayout.gutter * 2}
              preview={Boolean(preview)}
              profile={stats.data}
              profileError={stats.isError}
              onDay={dateKey =>
                stack?.navigate('ProgressDetails', {
                  section: 'dayActivity',
                  dateKey,
                })
              }
              onActivity={(dateKey, entry) =>
                stack?.navigate('ProgressDetails', {
                  section: 'activity',
                  dateKey,
                  activityId: entry.id,
                  ownerUid: uid,
                })
              }
              onAchievements={() => open('achievements')}>
              <ProgressStatsRow
                viewportWidth={width}
                streak={
                  preview
                    ? `${preview.streak} ${
                        preview.streak === 1 ? 'day' : 'days'
                      }`
                    : stats.isError
                    ? 'Unavailable'
                    : stats.data
                    ? `${stats.data.personalStreakDays} ${
                        stats.data.personalStreakDays === 1 ? 'day' : 'days'
                      }`
                    : '…'
                }
                momentum={
                  preview
                    ? `${preview.momentum}%`
                    : momentumError
                    ? 'Unavailable'
                    : momentum
                    ? momentum.isCalibrating
                      ? `${momentum.resolvedOpportunityCount} of 3`
                      : `${momentum.rawRollingPercentage}%`
                    : '…'
                }
                onStreakPress={() => open('streak')}
                onMomentumPress={() => open('momentum')}
              />
            </ProgressStatsSection>
            <View style={styles.stackSmall}>
              <DSText variant="heading">Your rewards</DSText>
              <DSText variant="secondary" tone="muted">
                Use these anytime. They don’t affect your XP.
              </DSText>
            </View>
            <View
              testID="progress-reward-grid"
              onLayout={({nativeEvent: {layout}}) =>
                setRewardRowWidth(layout.width)
              }
              style={[
                styles.rewardGrid,
                columns ? styles.columns : styles.stack,
              ]}>
              {(
                [
                  {
                    item: 'skips',
                    title: 'Skips',
                    description: 'Skip one Tap In and protect your streak.',
                    button: 'Buy skips',
                    icon: FastForward,
                    category: 'green',
                    color: brandColors.green,
                  },
                  {
                    item: 'restores',
                    title: 'Streak restore',
                    description: 'Recover one missed streak.',
                    button: 'Buy restores',
                    icon: RotateCcw,
                    category: 'orange',
                    color: brandColors.orangeStrong,
                  },
                ] as const
              ).map(reward => (
                <DSSurface
                  raised
                  key={reward.item}
                  testID={`progress-reward-${reward.item}`}
                  style={[
                    styles.rewardCard,
                    {width: columns ? Math.max(0, rewardCardWidth) : '100%'},
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${summary.inventory[reward.item]} ${
                      reward.title
                    }. Use reward.`}
                    onPress={() => open(reward.item)}
                    style={styles.rewardBody}>
                    <View style={[styles.row, styles.rewardHeader]}>
                      <ProgressBadge
                        icon={reward.icon}
                        tone={reward.category}
                        color={reward.color}
                        size={40}
                      />
                      <View style={styles.rewardCopy}>
                        <DSText variant="statistic">
                          {summary.inventory[reward.item]}
                        </DSText>
                        <DSText variant="body" style={{fontWeight: '600'}}>
                          {reward.title}
                        </DSText>
                      </View>
                    </View>
                    <DSText variant="secondary" tone="muted">
                      {reward.description}
                    </DSText>
                  </Pressable>
                  <RewardBuyButton
                    label={reward.button}
                    color={reward.color}
                    onPress={() => open('packs', reward.item)}
                  />
                </DSSurface>
              ))}
            </View>
            <View>
              {[
                {
                  title: 'XP and level details',
                  icon: BarChart3,
                  section: 'xp' as const,
                },
                {
                  title: 'Reward history',
                  icon: History,
                  section: 'history' as const,
                },
              ].map(option => (
                <Pressable
                  key={option.section}
                  accessibilityRole="button"
                  accessibilityLabel={option.title}
                  onPress={() => open(option.section)}
                  style={({pressed}) => [{opacity: pressed ? 0.8 : 1}]}
                  testID={`progress-option-${option.section}`}>
                  <View
                    style={[
                      styles.optionRow,
                      {borderBottomColor: theme.border},
                    ]}>
                    <View
                      style={[
                        styles.optionIcon,
                        {backgroundColor: theme.isDark ? '#252527' : '#EEEEF0'},
                      ]}>
                      <option.icon
                        color={theme.muted}
                        size={20}
                        strokeWidth={2.4}
                      />
                    </View>
                    <DSText style={styles.optionLabel} tone="muted">
                      {option.title}
                    </DSText>
                    <ChevronRight
                      color={theme.muted}
                      size={20}
                      strokeWidth={2.6}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  flex: {flex: 1},
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600'},
  grow: {flex: 1},
  shrink: {flexShrink: 1},
  content: {gap: 16, flexGrow: 1},
  tint: {position: 'absolute', left: 0, right: 0, top: 0, height: 240},
  header: {flexDirection: 'row', alignItems: 'center', gap: 16},
  hoy: {
    width: 52,
    height: 60,
    resizeMode: 'contain',
    transform: [{scale: 1.3}],
  },
  subtitle: {fontWeight: '400', marginTop: 6},
  subtitleEmphasis: {fontWeight: '700'},
  headerHistory: {position: 'absolute', right: 0, top: 0},
  history: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {gap: 12},
  stackSmall: {gap: 4},
  rewardGrid: {width: '100%', minWidth: 0},
  rewardCard: {minWidth: 0, flexShrink: 1, gap: 12},
  rewardHeader: {alignItems: 'flex-start', width: '100%', minWidth: 0},
  rewardCopy: {flex: 1, minWidth: 0, flexShrink: 1},
  rewardBody: {flexGrow: 1, gap: 4, minHeight: 48, width: '100%', minWidth: 0},
  rewardBuyTarget: {justifyContent: 'center', width: '100%', maxWidth: '100%'},
  rewardBuyFace: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  rewardBuyLabel: {
    color: brandColors.white,
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {opacity: 0.7},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 6,
  },
  wrap: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8},
  xp: {gap: 6},
  boostVertical: {flexDirection: 'column', alignItems: 'stretch'},
  levelPill: {paddingHorizontal: 14, paddingVertical: 4, borderRadius: 100},
  track: {height: 8, borderRadius: 8, overflow: 'hidden', marginTop: 2},
  fill: {height: '100%', borderRadius: 8, backgroundColor: '#FF6D00'},
  earnPanel: {gap: 8, padding: 12},
  earnRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  earnTask: {flexDirection: 'row', alignItems: 'center', gap: 8},
  taskTitle: {fontWeight: '600'},
  earnActionBelow: {alignSelf: 'flex-end'},
  earnArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  checklistStack: {flexDirection: 'column', alignItems: 'stretch'},
  checklistCount: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checklistAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columns: {flexDirection: 'row', gap: 12, alignItems: 'stretch'},
  divider: {height: StyleSheet.hairlineWidth},
});
