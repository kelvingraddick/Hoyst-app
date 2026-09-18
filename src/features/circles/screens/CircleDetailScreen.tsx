import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  Share,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Archive,
  ArrowLeft,
  Check,
  Clock3,
  Crown,
  Globe2,
  Lock,
  Settings2,
  Target,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {MomentumFlameIllustration} from '../../../design/components/MomentumIllustrations';
import {
  CircleCategoryIcon,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {HeroIconButton} from '../../../design/components/ScreenHeroHeader';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
import {NudgeMark} from '../../../design/components/NudgeMark';
import {getPulseRingStateForCircle} from '../../../design/components/pulse-ring-state';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {
  DesignSystemProvider,
  DSListRow,
  DSSectionHeading,
  useSystemTheme,
} from '../../../design/system';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../../profile/services/profile-display';
import {removeTapIn} from '../../check-in/services/check-in-service';
import {getCircleDetail} from '../mockData';
import {CircleThreadSection} from '../components/CircleThreadSection';
import {CircleGroupWeekPath} from '../components/CircleGroupWeekPath';
import {
  CircleMemberStrip,
  type CircleMemberStripAction,
} from '../components/CircleMemberStrip';
import {
  joinCircle,
  nudgeCircleMembers,
  reviewJoinRequest,
} from '../services/circle-service';
import {subscribeToPublicCircle} from '../services/public-circle-service';
import {circleProgressToWeekCells} from '../services/week-progress-adapter';
import {
  buildPublicCircleDetail,
  subscribeToMemberCircleDetail,
} from '../../home/services/home-data-service';
import {getCircleCycleProgressPresentation} from '../../commitments/cycle-progress-presentation';
import {getCommitmentGoalPresentation} from '../../commitments/commitment-goal-label';
import {collections} from '../../../types/firestore';
import type {
  CircleDetailModel,
  CircleMemberStatus,
  CircleSummary,
  CircleThreadItem,
  ProgressDayState,
} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleDetail'>;
type HeroPillTone =
  | 'blue'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple'
  | 'yellow';
type DetailStatusPill = {
  label: string;
  tone: HeroPillTone;
};
const THREAD_LOAD_MORE_THRESHOLD = 240;

function getDetailStatusPill(
  detail: CircleDetailModel,
): DetailStatusPill | undefined {
  if (detail.lifecycleStatus === 'archived') {
    return {label: 'Archived', tone: 'neutral'};
  }

  if (detail.viewerMembershipStatus === 'pending') {
    return {label: 'Pending approval', tone: 'purple'};
  }

  return undefined;
}

function getRoleLabel(detail: CircleDetailModel) {
  if (detail.viewerRole === 'owner') {
    return 'Owner';
  }

  if (detail.viewerRole === 'admin') {
    return 'Admin';
  }

  return 'Member';
}

function formatArchivedDate(date?: Date) {
  return date
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : undefined;
}

function TopBarButton({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({pressed}) => [
        styles.topBarButton,
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

function HeroTextPill({
  backgroundColor,
  foregroundColor,
  icon,
  label,
  style,
}: {
  backgroundColor: string;
  foregroundColor: string;
  icon?: React.ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.heroPill, {backgroundColor}, style]}>
      {icon ? <View style={styles.heroPillIcon}>{icon}</View> : null}
      <HoystText
        numberOfLines={1}
        style={[styles.heroPillLabel, {color: foregroundColor}]}
        variant="tiny">
        {label}
      </HoystText>
    </View>
  );
}

function HeroInlineMetaItem({
  color,
  icon,
  label,
}: {
  color?: string;
  icon: React.ReactNode;
  label: string;
}) {
  const theme = useHoystTheme();

  return (
    <View style={styles.heroInlineMetaItem}>
      <View style={styles.heroInlineMetaIcon}>{icon}</View>
      <HoystText
        numberOfLines={1}
        style={[styles.heroInlineMetaLabel, {color: color ?? theme.textMuted}]}
        variant="caption">
        {label}
      </HoystText>
    </View>
  );
}

function HeroInlineMetaSegment({
  children,
  separated = false,
}: {
  children: React.ReactNode;
  separated?: boolean;
}) {
  const theme = useHoystTheme();

  return (
    <View style={styles.heroInlineMetaSegment}>
      {separated ? (
        <View
          style={[
            styles.heroInlineMetaDivider,
            {backgroundColor: theme.border},
          ]}
          testID="circle-detail-meta-divider"
        />
      ) : null}
      {children}
    </View>
  );
}

function CircleNudgeAllRow({
  isLoading,
  isSent,
  onPress,
  targetCount,
}: {
  isLoading: boolean;
  isSent: boolean;
  onPress: () => void;
  targetCount: number;
}) {
  const theme = useSystemTheme();
  const isUnavailable = isLoading || isSent;
  const memberLabel = targetCount === 1 ? '1 member' : `${targetCount} members`;
  const targetDescription =
    targetCount === 1
      ? '1 member who needs Tap In'
      : `${targetCount} members who need Tap In`;
  const subtitle = isLoading
    ? `Sending to ${memberLabel}...`
    : isSent
    ? `Sent to ${memberLabel}`
    : 'Remind everyone who still needs to Tap In';
  const accessibilityLabel = isLoading
    ? `Sending nudge to ${memberLabel}`
    : isSent
    ? `Nudge sent to ${memberLabel}`
    : `Nudge all ${targetDescription}`;
  const isReady = !isUnavailable;

  return (
    <View
      accessibilityLabel={isUnavailable ? accessibilityLabel : undefined}
      accessibilityRole={isUnavailable ? 'button' : undefined}
      accessibilityState={
        isUnavailable ? {busy: isLoading, disabled: true} : undefined
      }
      accessible={isUnavailable}
      style={styles.nudgeAllRow}
      testID="circle-nudge-all-row">
      <DSListRow
        accessibilityLabel={accessibilityLabel}
        action={
          isUnavailable ? (
            <View style={styles.nudgeAllTrailing}>
              {isLoading ? (
                <ActivityIndicator color={theme.progress} size="small" />
              ) : (
                <Check color={theme.success} size={20} strokeWidth={2.5} />
              )}
            </View>
          ) : undefined
        }
        leading={
          <View
            style={[
              styles.nudgeAllIconTile,
              {backgroundColor: theme.category.purple.surface},
            ]}>
            <NudgeMark
              color={theme.category.purple.foreground}
              size={18}
              strokeWidth={4.4}
            />
          </View>
        }
        onPress={isReady ? onPress : undefined}
        subtitle={subtitle}
        testID={isReady ? 'circle-nudge-all-action' : undefined}
        title="Nudge all"
      />
    </View>
  );
}

function CircleRemoveTapInRow({
  isLoading,
  label,
  onPress,
}: {
  isLoading: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useSystemTheme();
  const subtitle = isLoading ? "Undoing today's Tap In..." : 'Undo today';
  const accessibilityLabel = isLoading
    ? "Removing today's Tap In"
    : `${label}. Undo today's Tap In`;

  return (
    <View
      accessibilityLabel={isLoading ? accessibilityLabel : undefined}
      accessibilityRole={isLoading ? 'button' : undefined}
      accessibilityState={isLoading ? {busy: true, disabled: true} : undefined}
      accessible={isLoading}
      style={styles.removeTapInRow}
      testID="circle-remove-tap-in-row">
      <DSListRow
        accessibilityLabel={accessibilityLabel}
        action={
          isLoading ? (
            <View style={styles.removeTapInTrailing}>
              <ActivityIndicator color={theme.danger} size="small" />
            </View>
          ) : undefined
        }
        chevronTone="danger"
        leading={
          <View
            style={[
              styles.removeTapInIconTile,
              {backgroundColor: `${theme.danger}1A`},
            ]}
            testID="circle-remove-tap-in-icon-tile">
            <Trash2 color={theme.danger} size={18} strokeWidth={2.3} />
          </View>
        }
        onPress={isLoading ? undefined : onPress}
        subtitle={subtitle}
        testID={isLoading ? undefined : 'circle-remove-tap-in-action'}
        title={isLoading ? 'Removing Tap In...' : label}
        titleTone="danger"
      />
    </View>
  );
}

function getHeroStatusPillPalette(
  tone: HeroPillTone,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (tone === 'green') {
    return {
      backgroundColor: 'rgba(68,216,92,0.14)',
      foregroundColor: theme.successForeground,
    };
  }

  if (tone === 'blue') {
    return {
      backgroundColor: 'rgba(104,184,232,0.14)',
      foregroundColor: theme.accentTertiaryForeground,
    };
  }

  if (tone === 'orange') {
    return {
      backgroundColor: 'rgba(255,138,61,0.14)',
      foregroundColor: theme.warningForeground,
    };
  }

  if (tone === 'yellow') {
    return {
      backgroundColor: 'rgba(255,196,0,0.18)',
      foregroundColor: theme.isDark ? '#FFC400' : '#7A5C00',
    };
  }

  if (tone === 'purple') {
    return {
      backgroundColor: 'rgba(139,92,246,0.16)',
      foregroundColor: theme.accentSecondaryForeground,
    };
  }

  return {
    backgroundColor: theme.surfaceHigh,
    foregroundColor: theme.textMuted,
  };
}

function CircleDetailCanvas() {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        theme.isDark
          ? styles.circleDetailCanvasDark
          : styles.circleDetailCanvasLight,
      ]}
      testID="circle-detail-home-canvas"
    />
  );
}

function CircleDetailTopTint({
  accentColor,
  height,
  translateY,
}: {
  accentColor: string;
  height: number;
  translateY: ReturnType<typeof Animated.multiply>;
}) {
  const theme = useHoystTheme();
  const canvasColor = theme.isDark ? '#121212' : '#FAFAF7';
  const tintColor = `${accentColor}${theme.isDark ? '30' : '24'}`;
  const measuredHeightStyle = {height};

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.circleDetailTopTint,
        measuredHeightStyle,
        {transform: [{translateY}]},
      ]}
      testID="circle-detail-top-tint-frame">
      <LinearGradient
        colors={[tintColor, canvasColor]}
        end={{x: 0.5, y: 1}}
        locations={[0, 1]}
        start={{x: 0.5, y: 0}}
        style={StyleSheet.absoluteFill}
        testID="circle-detail-top-tint"
      />
    </Animated.View>
  );
}

function CircleDetailBackground({
  accentColor,
  tintTranslateY,
  tintHeight,
}: {
  accentColor: string;
  tintTranslateY: ReturnType<typeof Animated.multiply>;
  tintHeight: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} testID="circle-detail-background">
      <CircleDetailCanvas />
      <CircleDetailTopTint
        accentColor={accentColor}
        height={tintHeight}
        translateY={tintTranslateY}
      />
    </View>
  );
}

function CircleDetailHero({
  detail,
  onBack,
  onOpenSettings,
  onTintLayout,
  primaryAction,
  statusPill,
}: {
  detail: CircleDetailModel;
  onBack: () => void;
  onOpenSettings: () => void;
  onTintLayout: (event: LayoutChangeEvent) => void;
  primaryAction?: React.ReactNode;
  statusPill?: DetailStatusPill;
}) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(detail.category);
  const categoryColor = getCircleCategoryForegroundColor(
    detail.category,
    theme,
  );
  const isPersonal = detail.circleMode === 'personal';
  const statusPalette = statusPill
    ? getHeroStatusPillPalette(statusPill.tone, theme)
    : undefined;
  const roleLabel = getRoleLabel(detail);
  const roleMetaColor =
    detail.viewerRole === 'owner'
      ? theme.warningForeground
      : detail.viewerRole === 'admin'
      ? theme.accentSecondaryForeground
      : theme.textMuted;
  const commitmentPace =
    detail.commitmentCadence === 'monthly'
      ? 'Monthly pace'
      : detail.commitmentCadence === 'weekly'
      ? 'Weekly pace'
      : 'Daily pace';
  const goal = getCommitmentGoalPresentation(detail);
  const previewCopy =
    detail.matchCopy ?? 'Preview the circle before you jump in.';

  return (
    <View style={styles.circleHero}>
      <View
        onLayout={onTintLayout}
        style={styles.circleHeroTintRegion}
        testID="circle-detail-hero-tint-region">
        <View style={styles.circleHeroNav}>
          <View style={styles.circleHeroNavSide}>
            <HeroIconButton accessibilityLabel="Go back" onPress={onBack}>
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
            </HeroIconButton>
          </View>
          <HoystText numberOfLines={1} style={styles.circleHeroNavTitle}>
            {isPersonal ? 'Personal Commitment' : 'Circle'}
          </HoystText>
          <View style={[styles.circleHeroNavSide, styles.circleHeroNavSideEnd]}>
            <HeroIconButton
              accessibilityLabel="Open circle settings"
              onPress={onOpenSettings}>
              <Settings2 color={theme.textMuted} size={20} strokeWidth={2.2} />
            </HeroIconButton>
          </View>
        </View>

        <View
          style={styles.circleHeroContent}
          testID="circle-detail-hero-content">
          <View style={styles.circleHeroIdentityRow}>
            <View testID="circle-detail-title-category-icon">
              <CircleCategoryIcon
                category={detail.category}
                showBackplate={false}
                size={34}
              />
            </View>
            <View style={styles.circleHeroIdentityCopy}>
              <HoystText numberOfLines={2} style={styles.circleHeroTitle}>
                {detail.title}
              </HoystText>
              <HoystText
                style={[styles.circleHeroCategory, {color: categoryColor}]}
                variant="caption">
                {visual.label.toUpperCase()}
              </HoystText>
            </View>
          </View>

          <View style={styles.circleHeroDescriptionGroup}>
            <HoystText style={styles.circleHeroCommitment} tone="muted">
              {detail.commitment}
            </HoystText>
            {goal ? (
              <View
                style={styles.circleHeroGoalLine}
                testID="circle-detail-goal">
                <Target
                  accessible={false}
                  color={theme.textMuted}
                  size={14}
                  strokeWidth={2.2}
                  style={styles.circleHeroGoalIcon}
                />
                <HoystText
                  style={styles.circleHeroGoalCopy}
                  tone="muted"
                  variant="caption">
                  {goal.label}
                </HoystText>
                <HoystText
                  style={styles.circleHeroGoalCopy}
                  tone="muted"
                  variant="caption">
                  {goal.label === 'Goal' ? ': ' : ' · '}
                </HoystText>
                <HoystText
                  style={[styles.circleHeroGoalCopy, styles.circleHeroGoalText]}
                  tone="muted"
                  variant="caption">
                  {goal.value}
                </HoystText>
              </View>
            ) : null}
          </View>

          <View style={styles.circleHeroMetaRow}>
            <HeroInlineMetaSegment>
              <HeroInlineMetaItem
                color={theme.textMuted}
                icon={
                  <Clock3 color={theme.textMuted} size={15} strokeWidth={2.2} />
                }
                label={commitmentPace}
              />
            </HeroInlineMetaSegment>
            {statusPill && statusPalette ? (
              <HeroTextPill
                backgroundColor={statusPalette.backgroundColor}
                foregroundColor={statusPalette.foregroundColor}
                icon={
                  detail.viewerMembershipStatus === 'pending' ? (
                    <Clock3
                      color={statusPalette.foregroundColor}
                      size={14}
                      strokeWidth={2.3}
                      testID="circle-detail-pending-clock"
                    />
                  ) : undefined
                }
                label={statusPill.label}
                style={styles.circleHeroStatusPill}
              />
            ) : null}
            {isPersonal ? (
              <HeroInlineMetaSegment separated>
                <HeroInlineMetaItem
                  color={theme.successForeground}
                  icon={
                    <Lock
                      color={theme.successForeground}
                      size={15}
                      strokeWidth={2.2}
                    />
                  }
                  label="Personal"
                />
              </HeroInlineMetaSegment>
            ) : (
              <>
                <HeroInlineMetaSegment separated>
                  <HeroInlineMetaItem
                    color={theme.textMuted}
                    icon={
                      detail.privacy === 'private' ? (
                        <Lock
                          color={theme.textMuted}
                          size={15}
                          strokeWidth={2.2}
                        />
                      ) : (
                        <Globe2
                          color={theme.textMuted}
                          size={15}
                          strokeWidth={2.2}
                        />
                      )
                    }
                    label={detail.privacy === 'private' ? 'Private' : 'Public'}
                  />
                </HeroInlineMetaSegment>
                <HeroInlineMetaSegment separated>
                  <HeroInlineMetaItem
                    color={theme.textMuted}
                    icon={
                      <UsersRound
                        color={theme.textMuted}
                        size={15}
                        strokeWidth={2.2}
                      />
                    }
                    label={`${detail.memberCount}/${detail.maxSize}`}
                  />
                </HeroInlineMetaSegment>
                {detail.viewerRole ? (
                  <HeroInlineMetaSegment separated>
                    <HeroInlineMetaItem
                      color={roleMetaColor}
                      icon={
                        <Crown
                          color={roleMetaColor}
                          size={15}
                          strokeWidth={2.2}
                        />
                      }
                      label={roleLabel}
                    />
                  </HeroInlineMetaSegment>
                ) : null}
              </>
            )}
          </View>

          {!statusPill && !detail.viewerRole && !isPersonal ? (
            <HoystText style={styles.circleHeroPreview} tone="muted">
              {previewCopy}
            </HoystText>
          ) : null}
        </View>
      </View>

      {primaryAction ? (
        <View
          style={styles.circleHeroPrimaryAction}
          testID="circle-detail-hero-primary-action">
          {primaryAction}
        </View>
      ) : null}
    </View>
  );
}

function TapInReferenceAction({
  heroPalette,
  heroTrailingState,
  label,
  onPress,
  ringState,
  supportingText,
  variant = 'reference',
}: {
  heroPalette?: React.ComponentProps<typeof TapInPulseButton>['heroPalette'];
  heroTrailingState?: React.ComponentProps<
    typeof TapInPulseButton
  >['heroTrailingState'];
  label: string;
  onPress: () => void;
  ringState: React.ComponentProps<typeof TapInPulseButton>['ringState'];
  supportingText: string;
  variant?: React.ComponentProps<typeof TapInPulseButton>['variant'];
}) {
  return (
    <TapInPulseButton
      heroPalette={heroPalette}
      heroTrailingState={heroTrailingState}
      label={label}
      onPress={() => onPress()}
      ringState={ringState}
      supportingText={supportingText}
      variant={variant}
    />
  );
}

function normalizeGroupStreakDays(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

type CircleDetailWeekCell = {
  coveredCount?: number;
  dateKey: string;
  quantityLabel?: string;
  quantityValue?: number;
  state: ProgressDayState;
  totalCount?: number;
};

function CircleStatsSection({
  detail,
  progressColor,
  weekCells,
}: {
  detail: CircleDetailModel;
  progressColor: string;
  weekCells: readonly CircleDetailWeekCell[];
}) {
  const theme = useHoystTheme();
  const isPersonal = detail.circleMode === 'personal';
  const streakSource = isPersonal
    ? detail.streakDays ?? Number.parseInt(detail.streakLabel, 10)
    : detail.groupStreakDays ?? 0;
  const streakValue = Number.isFinite(streakSource)
    ? Math.max(0, Math.round(streakSource))
    : 0;
  const streakDayLabel = streakValue === 1 ? 'day' : 'days';
  const activeMembers = detail.members.filter(
    member => member.membershipStatus !== 'pending',
  );
  const cadence = detail.commitmentCadence ?? 'weekly';
  const sectionTitle =
    cadence === 'daily'
      ? 'Today'
      : cadence === 'monthly'
      ? 'This month'
      : 'This week';
  const cycleProgress = getCircleCycleProgressPresentation(detail);
  const todayTapInCount =
    detail.todayTapInCount ??
    activeMembers.filter(member =>
      member.todayStatus
        ? member.todayStatus !== 'skip'
        : member.state === 'done',
    ).length;
  const todaySkipCount =
    detail.todaySkipCount ??
    activeMembers.filter(member =>
      member.todayStatus
        ? member.todayStatus === 'skip'
        : member.state === 'skipped',
    ).length;
  const todaySummary =
    todayTapInCount === 0 && todaySkipCount === 0
      ? 'No Tap Ins yet today'
      : [
          'Today',
          ...(todayTapInCount > 0 ? [`${todayTapInCount} tapped in`] : []),
          ...(todaySkipCount > 0 ? [`${todaySkipCount} skipped`] : []),
        ].join(' · ');
  const progressTrackSurfaceStyle = {
    backgroundColor: theme.isDark ? '#303036' : '#E9E9ED',
  };

  return (
    <View style={styles.statsSection} testID="circle-detail-stats-content">
      <View style={styles.statsSummaryGrid}>
        <View
          style={styles.statsProgressSummary}
          testID="circle-stats-progress">
          <DSSectionHeading title={sectionTitle} />
          <View style={styles.statsProgressLabelRow}>
            <HoystText
              style={styles.statsProgressLabel}
              testID="circle-stats-progress-label"
              tone="muted">
              {cycleProgress.detailLabel}
            </HoystText>
          </View>
        </View>
        <View
          accessibilityLabel={`${
            isPersonal ? 'Streak' : 'Group streak'
          } ${streakValue} ${streakDayLabel}`}
          style={styles.statsStreakPill}
          testID="circle-stats-streak-pill">
          <View style={styles.statsStreakValueRow}>
            <MomentumFlameIllustration
              size={16}
              testID="circle-stats-streak-icon"
            />
            <HoystText
              allowFontScaling={false}
              style={[
                styles.statsStreakPillLabel,
                {color: theme.streakForeground},
              ]}
              testID="circle-stats-streak-label">
              {`${streakValue} ${streakDayLabel}`}
            </HoystText>
          </View>
          <HoystText style={styles.statsStreakCaption} tone="muted">
            {isPersonal ? 'Current streak' : 'Group streak'}
          </HoystText>
        </View>
      </View>
      <View
        style={[styles.statsProgressTrack, progressTrackSurfaceStyle]}
        testID="circle-stats-progress-track">
        <View
          style={[
            styles.statsProgressFill,
            {
              backgroundColor: progressColor,
              width: `${cycleProgress.percent}%`,
            },
          ]}
          testID="circle-stats-progress-fill"
        />
      </View>
      {cadence !== 'daily' ? (
        <HoystText
          style={styles.statsTodayLabel}
          testID="circle-stats-today-summary"
          tone="muted"
          variant="caption">
          {todaySummary}
        </HoystText>
      ) : null}
      <View style={styles.statsWeekHistory} testID="circle-detail-week-history">
        <CircleGroupWeekPath days={weekCells} />
      </View>
    </View>
  );
}

function CircleDetailScreenContent({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const systemTheme = useSystemTheme();
  const insets = useSafeAreaInsets();
  const navigateBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  }, [navigation]);
  const [nudged, setNudged] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [nudgedMemberIds, setNudgedMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [nudgingMemberIds, setNudgingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [reviewingRequestId, setReviewingRequestId] = useState<string>();
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [joinRequested, setJoinRequested] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [publicCircle, setPublicCircle] = useState<CircleSummary | undefined>();
  const [memberCircle, setMemberCircle] = useState<
    CircleDetailModel | undefined
  >();
  const [groupStreakDays, setGroupStreakDays] = useState(0);
  const [isThreadVisible, setIsThreadVisible] = useState(false);
  const [threadLoadMoreRequestToken, setThreadLoadMoreRequestToken] =
    useState(0);
  const [heroTintRegionHeight, setHeroTintRegionHeight] = useState(0);
  const bodyOffsetYRef = useRef<number | undefined>(undefined);
  const threadOffsetYRef = useRef<number | undefined>(undefined);
  const wasNearThreadEndRef = useRef(false);
  const heroTintScrollY = useRef(new Animated.Value(0)).current;
  const heroTintTranslateY = useMemo(
    () => Animated.multiply(heroTintScrollY, -1),
    [heroTintScrollY],
  );
  const scrollMetricsRef = useRef({
    contentHeight: 0,
    offsetY: 0,
    viewportHeight: 0,
  });
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const requireAccount = useProtectedAction(navigation);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadMemberCircle =
    status === 'authenticatedReady' && Boolean(user?.uid);
  const detail = useMemo(() => {
    const baseDetail =
      memberCircle ??
      (publicCircle ? buildPublicCircleDetail(publicCircle) : undefined) ??
      getCircleDetail(route.params.circleId);

    if (!baseDetail || baseDetail.circleMode === 'personal') {
      return baseDetail;
    }

    return {
      ...baseDetail,
      groupStreakDays: memberCircle
        ? groupStreakDays
        : publicCircle?.groupStreakDays ?? baseDetail.groupStreakDays ?? 0,
    };
  }, [groupStreakDays, memberCircle, publicCircle, route.params.circleId]);
  const canShowThread = Boolean(
    canLoadMemberCircle &&
      user?.uid &&
      detail?.viewerRole &&
      detail.viewerMembershipStatus !== 'pending' &&
      detail.circleMode !== 'personal',
  );
  const updateThreadScrollState = useCallback(() => {
    const bodyOffsetY = bodyOffsetYRef.current;
    const threadOffsetY = threadOffsetYRef.current;
    const {contentHeight, offsetY, viewportHeight} = scrollMetricsRef.current;

    if (
      !canShowThread ||
      bodyOffsetY === undefined ||
      threadOffsetY === undefined ||
      viewportHeight <= 0
    ) {
      setIsThreadVisible(false);
      wasNearThreadEndRef.current = false;
      return;
    }

    const viewportBottom = offsetY + viewportHeight;
    const threadTop = bodyOffsetY + threadOffsetY;
    const nextIsThreadVisible = viewportBottom >= threadTop;
    const isNearThreadEnd =
      nextIsThreadVisible &&
      contentHeight > 0 &&
      contentHeight - viewportBottom <= THREAD_LOAD_MORE_THRESHOLD;

    setIsThreadVisible(current =>
      current === nextIsThreadVisible ? current : nextIsThreadVisible,
    );

    if (isNearThreadEnd && !wasNearThreadEndRef.current) {
      wasNearThreadEndRef.current = true;
      setThreadLoadMoreRequestToken(currentToken => currentToken + 1);
    } else if (!isNearThreadEnd) {
      wasNearThreadEndRef.current = false;
    }
  }, [canShowThread]);
  const handleBodyLayout = useCallback(
    (event: LayoutChangeEvent) => {
      bodyOffsetYRef.current = event.nativeEvent.layout.y;
      updateThreadScrollState();
    },
    [updateThreadScrollState],
  );
  const handleHeroTintLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setHeroTintRegionHeight(currentHeight =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);
  const handleThreadLayout = useCallback(
    (event: LayoutChangeEvent) => {
      threadOffsetYRef.current = event.nativeEvent.layout.y;
      updateThreadScrollState();
    },
    [updateThreadScrollState],
  );
  const handleScreenContentSizeChange = useCallback(
    (_width: number, height: number) => {
      scrollMetricsRef.current.contentHeight = height;
      updateThreadScrollState();
    },
    [updateThreadScrollState],
  );
  const handleScreenLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
      updateThreadScrollState();
    },
    [updateThreadScrollState],
  );
  const handleScreenScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
      heroTintScrollY.setValue(contentOffset.y);
      scrollMetricsRef.current = {
        contentHeight: contentSize.height,
        offsetY: contentOffset.y,
        viewportHeight: layoutMeasurement.height,
      };
      updateThreadScrollState();
    },
    [heroTintScrollY, updateThreadScrollState],
  );
  const nudgeTargetMembers = useMemo(
    () =>
      detail?.members.filter(
        member =>
          member.membershipStatus !== 'pending' &&
          member.cycleGoalMet !== true &&
          !member.todayStatus &&
          member.id !== user?.uid,
      ) ?? [],
    [detail?.members, user?.uid],
  );
  useEffect(() => {
    setNudged(false);
    setNudgedMemberIds(new Set());
    setNudgingMemberIds(new Set());
    setSelectedMemberId(undefined);
    setIsThreadVisible(false);
    setThreadLoadMoreRequestToken(0);
    bodyOffsetYRef.current = undefined;
    threadOffsetYRef.current = undefined;
    wasNearThreadEndRef.current = false;
    heroTintScrollY.setValue(0);
  }, [detail?.id, heroTintScrollY]);

  useEffect(() => {
    return subscribeToPublicCircle(route.params.circleId, setPublicCircle, () =>
      setPublicCircle(undefined),
    );
  }, [route.params.circleId]);

  useEffect(() => {
    if (!canLoadMemberCircle || !user?.uid) {
      setMemberCircle(undefined);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: setMemberCircle,
      onError: () => setMemberCircle(undefined),
      timezone,
      uid: user.uid,
    });
  }, [canLoadMemberCircle, route.params.circleId, timezone, user?.uid]);

  useEffect(() => {
    if (!canLoadMemberCircle) {
      setGroupStreakDays(0);
      return undefined;
    }

    return firebaseFirestore()
      .collection(collections.circles)
      .doc(route.params.circleId)
      .onSnapshot(
        snapshot => {
          setGroupStreakDays(
            normalizeGroupStreakDays(snapshot.data()?.groupStreakDays),
          );
        },
        () => setGroupStreakDays(0),
      );
  }, [canLoadMemberCircle, route.params.circleId]);

  const handleJoinCircle = useCallback(async () => {
    if (!detail) {
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinCircle(detail.id);
      setJoinRequested(true);
      Alert.alert(
        result.status === 'active' ? 'Joined circle' : 'Request sent',
        result.status === 'active'
          ? 'You are now in this circle.'
          : 'The circle owner will review your request.',
      );
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not join this circle. Try again.';
      Alert.alert('Join failed', message);
    } finally {
      setIsJoining(false);
    }
  }, [detail]);

  useEffect(() => {
    if (
      detail &&
      route.params.resumeAction === 'join' &&
      !joinRequested &&
      !isJoining
    ) {
      handleJoinCircle().catch(() => undefined);
    }
  }, [
    detail,
    handleJoinCircle,
    isJoining,
    joinRequested,
    route.params.resumeAction,
  ]);

  if (!detail) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.topBarSlot}>
            <TopBarButton accessibilityLabel="Go back" onPress={navigateBack}>
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
            </TopBarButton>
          </View>
          <HoystText numberOfLines={1} style={styles.topTitle}>
            Circle unavailable
          </HoystText>
          <View style={styles.topBarSlot} />
        </View>
        <GlassPanel>
          <SectionHeader
            description="This circle was not found, or your account does not have access to it yet."
            title="Circle unavailable"
          />
        </GlassPanel>
      </HoystScreen>
    );
  }

  const isPendingMembership = detail.viewerMembershipStatus === 'pending';
  const isMemberCircle = Boolean(detail.viewerRole) && !isPendingMembership;
  const isPersonal = detail.circleMode === 'personal';
  const isArchived = detail.lifecycleStatus === 'archived';
  const canInvite =
    !isArchived &&
    Boolean(detail.inviteUrl) &&
    (detail.viewerRole === 'owner' || detail.viewerRole === 'admin');
  const detailStatusPill = getDetailStatusPill(detail);
  const nudgeTargetCount = detail.nudgeTargetCount ?? nudgeTargetMembers.length;
  const canNudgeTargets = nudgeTargetCount > 0;
  const joinActionLabel = joinRequested
    ? detail.joinLabel === 'Open seats'
      ? 'Joined'
      : 'Request sent'
    : detail.joinLabel === 'Open seats'
    ? 'Join Circle'
    : 'Request to join';
  const canRemoveTodayCheckIn =
    !isArchived &&
    isMemberCircle &&
    detail.viewerHasTappedInToday &&
    Boolean(detail.viewerTodayStatus) &&
    detail.viewerTodayStatus !== 'rest';
  const canReviewTodayCheckIn =
    canRemoveTodayCheckIn && !detail.viewerCanUpdateTapIn;
  const canUpdateTodayQuantity = Boolean(detail.viewerCanUpdateTapIn);
  const quantityTapInRemoveCopy =
    "This will delete today's saved quantity and reopen this Tap In.";
  const tapInPrimaryActionLabel = canUpdateTodayQuantity
    ? 'Update Tap In'
    : canReviewTodayCheckIn
    ? 'Review Tap In'
    : 'Tap In';
  const tapInPulseRingState = getPulseRingStateForCircle(detail);
  const canReviewJoinRequests =
    !isArchived &&
    !isPersonal &&
    isMemberCircle &&
    detail.viewerRole === 'owner';
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const removeProgressCopy = canUpdateTodayQuantity
    ? quantityTapInRemoveCopy
    : 'This will undo Progress for this Cycle.';
  const viewerCycleRequiredCount = detail.viewerCycleRequiredCount ?? 1;
  const viewerCycleCoveredCount = Math.min(
    detail.viewerCycleCoveredCount ?? 0,
    viewerCycleRequiredCount,
  );
  const viewerCycleGoalMet =
    viewerCycleRequiredCount > 0 &&
    viewerCycleCoveredCount >= viewerCycleRequiredCount;
  const cyclePeriodCopy =
    detail.commitmentCadence === 'monthly' ? 'this month' : 'this week';
  const cycleGoalCopy =
    detail.commitmentCadence === 'monthly' ? 'Monthly' : 'Weekly';
  const tapInSupportingText =
    detail.commitmentCadence === 'weekly' ||
    detail.commitmentCadence === 'monthly'
      ? viewerCycleGoalMet
        ? detail.viewerHasTappedInToday
          ? `${cycleGoalCopy} goal complete · ${viewerCycleCoveredCount} of ${viewerCycleRequiredCount}`
          : `${cycleGoalCopy} goal complete · Optional extra`
        : `${viewerCycleCoveredCount} of ${viewerCycleRequiredCount} ${cyclePeriodCopy} · ${Math.max(
            viewerCycleRequiredCount - viewerCycleCoveredCount,
            0,
          )} left`
      : canReviewTodayCheckIn
      ? "Review or share today's Tap In"
      : 'Log progress for this circle';
  const categoryProgressColor = getCircleCategoryForegroundColor(
    detail.category,
    theme,
  );
  const categoryVisual = getCircleCategoryVisual(detail.category);
  const categoryAction = systemTheme.category[categoryVisual.tone];
  const tapInHeroPalette = {
    backgroundColor: categoryAction.foreground,
    chevronBackgroundColor: systemTheme.isDark
      ? 'rgba(7,11,26,0.14)'
      : 'rgba(255,255,255,0.14)',
    foregroundColor: systemTheme.isDark
      ? brandColors.charcoal
      : brandColors.white,
    supportingTextColor: systemTheme.isDark
      ? 'rgba(7,11,26,0.72)'
      : 'rgba(255,255,255,0.78)',
  };
  const categoryBackdropAccent = theme.isDark
    ? categoryVisual.accentLight
    : categoryVisual.accentColor;
  const weekCells =
    detail.groupProgressDays && detail.groupProgressDays.length > 0
      ? detail.groupProgressDays
      : circleProgressToWeekCells(detail.monthProgress, detail.timezone);

  const shareInvite = () => {
    if (!canInvite || !detail.inviteUrl) {
      return;
    }

    Share.share({
      title: `Join ${detail.title} on Hoyst`,
      message: `Join ${detail.title} on Hoyst: ${detail.inviteUrl}`,
      url: detail.inviteUrl,
    }).catch(() => undefined);
  };

  const openCircleSettings = () => {
    navigation.navigate('CircleTools', {circleId: detail.id});
  };

  const openTapInComposer = () => {
    requireAccount(
      {
        circleId: detail.id,
        source: 'circle_detail',
        type: 'tapIn',
      },
      () =>
        navigation.navigate('TapInComposer', {
          circleId: detail.id,
          source: 'circle_detail',
        }),
    );
  };

  const shareFeedTapIn = (item: CircleThreadItem) => {
    navigation.navigate('TapInStoryShare', {
      category: detail.category,
      circleId: detail.id,
      circleTitle: detail.title,
      commitment: detail.commitment,
      commitmentType: detail.commitmentType,
      inviteUrl: detail.inviteUrl,
      memberCount: detail.memberCount,
      members: detail.members,
      note: item.note,
      periodTapInCount: detail.periodTapInCount,
      photoUri: item.mediaImageUrl,
      progressLabel: detail.progressLabel,
      source: 'circle_detail',
      streakDays: detail.streakDays,
      streakLabel: detail.streakLabel,
    });
  };

  const handleSendNudge = () => {
    if (isNudging) {
      return;
    }

    setIsNudging(true);
    nudgeCircleMembers(detail.id)
      .then(result => {
        setNudged(true);
        if (result.nudged > 0) {
          setNudgedMemberIds(current => {
            const next = new Set(current);
            nudgeTargetMembers.forEach(member => next.add(member.id));
            return next;
          });
        }
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
      .finally(() => setIsNudging(false));
  };

  const handleSendMemberNudge = (member: CircleMemberStatus) => {
    if (nudgedMemberIds.has(member.id) || nudgingMemberIds.has(member.id)) {
      return;
    }

    setNudgingMemberIds(current => {
      const next = new Set(current);
      next.add(member.id);
      return next;
    });

    nudgeCircleMembers(detail.id, member.id)
      .then(result => {
        if (result.nudged > 0) {
          setNudgedMemberIds(current => {
            const next = new Set(current);
            next.add(member.id);
            return next;
          });
          Alert.alert('Nudge sent', `${member.name} was nudged.`);
          return;
        }

        Alert.alert(
          'Nudge not sent',
          `${member.name} is covered or not eligible for a nudge right now.`,
        );
      })
      .catch(error => {
        Alert.alert(
          'Nudge failed',
          (error as {message?: string}).message ?? 'Could not send a nudge.',
        );
      })
      .finally(() => {
        setNudgingMemberIds(current => {
          const next = new Set(current);
          next.delete(member.id);
          return next;
        });
      });
  };

  const handleRemoveTodayCheckIn = async () => {
    setIsRemovingTapIn(true);
    try {
      await removeTapIn({circleId: detail.id});
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not remove your Tap In. Try again.';
      Alert.alert('Remove failed', message);
    } finally {
      setIsRemovingTapIn(false);
    }
  };

  const confirmRemoveTodayCheckIn = () => {
    Alert.alert('Remove today?', removeProgressCopy, [
      {style: 'cancel', text: 'Keep'},
      {
        onPress: () => {
          handleRemoveTodayCheckIn().catch(() => undefined);
        },
        style: 'destructive',
        text: 'Remove',
      },
    ]);
  };

  const handleReviewJoinRequest = async (
    requesterId: string,
    approved: boolean,
  ) => {
    if (reviewingRequestId) {
      return;
    }

    setReviewingRequestId(requesterId);
    try {
      const result = await reviewJoinRequest({
        approved,
        circleId: detail.id,
        requesterId,
      });
      Alert.alert(
        result.status === 'approved' ? 'Request approved' : 'Request declined',
        result.status === 'approved'
          ? 'They can Tap In with the Circle now.'
          : 'The request has been declined.',
      );
    } catch (error) {
      Alert.alert(
        'Review failed',
        (error as {message?: string}).message ??
          'Could not review this request.',
      );
    } finally {
      setReviewingRequestId(undefined);
    }
  };

  const openReviewJoinRequestSheet = (member: CircleMemberStatus) => {
    if (reviewingRequestId) {
      return;
    }

    Alert.alert(
      'Review join request',
      `Approve or deny ${member.name}'s request to join ${detail.title}?`,
      [
        {style: 'cancel', text: 'Cancel'},
        {
          onPress: () => {
            handleReviewJoinRequest(member.id, false).catch(() => undefined);
          },
          style: 'destructive',
          text: 'Deny',
        },
        {
          onPress: () => {
            handleReviewJoinRequest(member.id, true).catch(() => undefined);
          },
          text: 'Approve',
        },
      ],
    );
  };

  const removeTapInAction = canRemoveTodayCheckIn ? (
    <CircleRemoveTapInRow
      isLoading={isRemovingTapIn}
      label={removeActionLabel}
      onPress={confirmRemoveTodayCheckIn}
    />
  ) : null;
  const memberBelowStripAction =
    isMemberCircle && !isPersonal && !isArchived && canNudgeTargets ? (
      <CircleNudgeAllRow
        isLoading={isNudging}
        isSent={nudged}
        onPress={handleSendNudge}
        targetCount={nudgeTargetCount}
      />
    ) : undefined;
  const memberCountLabel = `${detail.memberCount} ${
    detail.memberCount === 1 ? 'member' : 'members'
  } total`;
  const viewerMember = detail.members.find(member => member.id === user?.uid);
  const viewerAvatarSource =
    viewerMember?.avatarImage ??
    (viewerMember?.avatarUrl
      ? {uri: viewerMember.avatarUrl}
      : getProfileAvatarSource(profile));
  const viewerPresentation = {
    avatarSource: viewerAvatarSource,
    initials: viewerMember?.initials ?? getProfileInitials(profile),
    name: viewerMember?.name ?? profile?.name ?? 'You',
  };
  const selectedMember = detail.members.find(
    member => member.id === selectedMemberId,
  );
  const selectedMemberAction: CircleMemberStripAction | undefined =
    selectedMember && !isArchived
      ? selectedMember.id === user?.uid &&
        isMemberCircle &&
        !canRemoveTodayCheckIn
        ? {
            accessibilityLabel: `Tap In for ${selectedMember.name}`,
            label: 'Tap In',
            onPress: openTapInComposer,
            tone: 'primary',
          }
        : selectedMember.membershipStatus === 'pending' && canReviewJoinRequests
        ? {
            accessibilityLabel:
              reviewingRequestId === selectedMember.id
                ? `Reviewing ${selectedMember.name}'s join request`
                : `Review ${selectedMember.name}'s join request`,
            disabled: reviewingRequestId === selectedMember.id,
            isLoading: reviewingRequestId === selectedMember.id,
            label:
              reviewingRequestId === selectedMember.id ? 'Reviewing' : 'Review',
            onPress: () => openReviewJoinRequestSheet(selectedMember),
            tone: 'review',
          }
        : isMemberCircle &&
          selectedMember.membershipStatus !== 'pending' &&
          selectedMember.cycleGoalMet !== true &&
          !selectedMember.todayStatus &&
          selectedMember.id !== user?.uid
        ? {
            accessibilityLabel: nudgingMemberIds.has(selectedMember.id)
              ? `Nudging ${selectedMember.name}`
              : nudgedMemberIds.has(selectedMember.id)
              ? `${selectedMember.name} nudged`
              : `Nudge ${selectedMember.name}`,
            disabled:
              nudgingMemberIds.has(selectedMember.id) ||
              nudgedMemberIds.has(selectedMember.id),
            isLoading: nudgingMemberIds.has(selectedMember.id),
            label: nudgingMemberIds.has(selectedMember.id)
              ? 'Nudging...'
              : nudgedMemberIds.has(selectedMember.id)
              ? 'Nudged'
              : 'Nudge',
            onPress: () => handleSendMemberNudge(selectedMember),
            tone: 'nudge',
          }
        : undefined
      : undefined;

  return (
    <HoystScreen
      background={
        <CircleDetailBackground
          accentColor={categoryBackdropAccent}
          tintHeight={insets.top + heroTintRegionHeight}
          tintTranslateY={heroTintTranslateY}
        />
      }
      contentContainerStyle={styles.content}
      keyboardAvoiding
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={handleScreenContentSizeChange}
      onLayout={handleScreenLayout}
      onScroll={handleScreenScroll}
      padded={false}
      scrollEventThrottle={16}>
      <View style={styles.detailStack}>
        <CircleDetailHero
          detail={detail}
          onBack={navigateBack}
          onOpenSettings={openCircleSettings}
          onTintLayout={handleHeroTintLayout}
          primaryAction={
            isMemberCircle && !isArchived ? (
              <TapInReferenceAction
                heroPalette={tapInHeroPalette}
                heroTrailingState={
                  canReviewTodayCheckIn ? 'success' : undefined
                }
                label={tapInPrimaryActionLabel}
                onPress={openTapInComposer}
                ringState={tapInPulseRingState}
                supportingText={tapInSupportingText}
                variant="hero"
              />
            ) : undefined
          }
          statusPill={detailStatusPill}
        />

        <View
          onLayout={handleBodyLayout}
          style={styles.bodyStack}
          testID="circle-detail-body-stack">
          {isArchived ? (
            <GlassPanel style={styles.archivedBanner}>
              <View
                style={[
                  styles.archivedBannerIcon,
                  {backgroundColor: theme.surfaceHigh},
                ]}>
                <Archive color={theme.textMuted} size={20} strokeWidth={2.2} />
              </View>
              <View style={styles.archivedBannerCopy}>
                <HoystText style={styles.archivedBannerTitle}>
                  {isPersonal ? 'Commitment archived' : 'Circle archived'}
                </HoystText>
                <HoystText tone="muted" variant="caption">
                  Read-only history
                  {formatArchivedDate(detail.archivedAt)
                    ? ` · Archived ${formatArchivedDate(detail.archivedAt)}`
                    : ''}
                  . Owners can restore this from Settings.
                </HoystText>
              </View>
            </GlassPanel>
          ) : null}

          <CircleStatsSection
            detail={detail}
            progressColor={categoryProgressColor}
            weekCells={weekCells}
          />

          {!isPersonal ? (
            <>
              <CircleMemberStrip
                action={selectedMemberAction}
                belowStripAction={memberBelowStripAction}
                commitmentCadence={detail.commitmentCadence}
                inviteAction={
                  !isArchived && canInvite
                    ? {
                        accessibilityLabel: 'Invite Members',
                        onPress: shareInvite,
                      }
                    : undefined
                }
                members={detail.members}
                onSelectMember={member => setSelectedMemberId(member.id)}
                selectedMemberId={selectedMemberId}
                subtitle={memberCountLabel}
                viewerUid={user?.uid}
              />
            </>
          ) : null}

          {!isArchived && !isMemberCircle ? (
            isPendingMembership ? (
              <View style={styles.publicActionStack}>
                <HoystButton
                  icon={
                    <Clock3
                      color={theme.textMuted}
                      size={18}
                      strokeWidth={2.4}
                    />
                  }
                  disabled
                  label="Pending approval"
                />
                <HoystText tone="muted" variant="caption">
                  The circle owner will review your request.
                </HoystText>
              </View>
            ) : (
              <View style={styles.publicActionStack}>
                <HoystButton
                  icon={
                    <UserPlus
                      color={theme.actionForeground}
                      size={18}
                      strokeWidth={2.4}
                    />
                  }
                  disabled={isPendingMembership}
                  label={
                    isPendingMembership
                      ? 'Pending approval'
                      : isJoining
                      ? 'Working...'
                      : joinActionLabel
                  }
                  onPress={
                    isPendingMembership
                      ? undefined
                      : () =>
                          requireAccount(
                            {circleId: detail.id, type: 'joinCircle'},
                            () => {
                              handleJoinCircle().catch(() => undefined);
                            },
                          )
                  }
                />
                <HoystText tone="muted" variant="caption">
                  {isPendingMembership
                    ? 'The circle owner will review your request.'
                    : detail.joinLabel === 'Open seats'
                    ? `${detail.maxSize - detail.memberCount} seats open today`
                    : 'The circle owner will review your request.'}
                </HoystText>
              </View>
            )
          ) : null}

          {removeTapInAction}

          {canShowThread && user?.uid ? (
            <CircleThreadSection
              circleId={detail.id}
              isArchived={isArchived}
              isVisible={isThreadVisible}
              key={detail.id}
              loadMoreRequestToken={threadLoadMoreRequestToken}
              onLayout={handleThreadLayout}
              onShareTapIn={shareFeedTapIn}
              timezone={timezone}
              viewer={viewerPresentation}
              viewerUid={user.uid}
            />
          ) : null}
        </View>
      </View>
    </HoystScreen>
  );
}

export function CircleDetailScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);

  return (
    <DesignSystemProvider scheme={appearance}>
      <CircleDetailScreenContent {...props} />
    </DesignSystemProvider>
  );
}

const styles = StyleSheet.create({
  archivedBanner: {alignItems: 'center', flexDirection: 'row', gap: 12},
  archivedBannerCopy: {flex: 1, gap: 3},
  archivedBannerIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  archivedBannerTitle: {fontSize: 16, fontWeight: '800', lineHeight: 20},
  content: {
    paddingBottom: 148,
  },
  detailStack: {position: 'relative'},
  bodyStack: {
    gap: 22,
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  circleHero: {
    gap: 4,
  },
  circleDetailTopTint: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  circleDetailCanvasDark: {
    backgroundColor: '#121212',
  },
  circleDetailCanvasLight: {
    backgroundColor: '#FAFAF7',
  },
  circleHeroCategory: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    lineHeight: 15,
  },
  circleHeroCommitment: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  circleHeroDescriptionGroup: {gap: 4},
  circleHeroGoalLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  circleHeroGoalCopy: {fontWeight: '600'},
  circleHeroGoalIcon: {marginRight: 3},
  circleHeroGoalText: {flexShrink: 1},
  circleHeroIdentityCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  circleHeroIdentityRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  circleHeroMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  circleHeroNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  circleHeroNavSide: {
    alignItems: 'flex-start',
    flexShrink: 0,
    width: 84,
  },
  circleHeroNavSideEnd: {
    alignItems: 'flex-end',
  },
  circleHeroNavTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: 'center',
  },
  circleHeroPreview: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  circleHeroPrimaryAction: {
    paddingHorizontal: 22,
  },
  circleHeroStatusPill: {
    flexShrink: 1,
    height: 30,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  circleHeroContent: {
    gap: 10,
  },
  circleHeroTintRegion: {
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 22,
    paddingTop: 8,
    position: 'relative',
  },
  circleHeroTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 29,
  },
  heroPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    height: 34,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  heroInlineMetaDivider: {
    height: 16,
    width: StyleSheet.hairlineWidth,
  },
  heroInlineMetaIcon: {
    alignItems: 'center',
    height: 17,
    justifyContent: 'center',
    width: 17,
  },
  heroInlineMetaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  heroInlineMetaLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 16,
  },
  heroInlineMetaSegment: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  heroPillIcon: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  heroPillLabel: {
    flexShrink: 1,
    textAlign: 'center',
  },
  statsSection: {
    gap: 8,
  },
  statsWeekHistory: {
    paddingTop: 8,
  },
  statsProgressSummary: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statsProgressFill: {
    borderRadius: radius.pill,
    height: 5,
  },
  statsProgressLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsProgressLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  statsProgressTrack: {
    borderRadius: radius.pill,
    height: 5,
    overflow: 'hidden',
  },
  statsTodayLabel: {
    fontSize: 12,
    lineHeight: 17,
  },
  statsStreakPill: {
    alignItems: 'flex-start',
    flexShrink: 0,
    gap: 2,
  },
  statsStreakPillLabel: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 22,
  },
  statsStreakCaption: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
    marginLeft: 24,
  },
  statsStreakValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statsSummaryGrid: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  nudgeAllIconTile: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  nudgeAllRow: {
    width: '100%',
  },
  nudgeAllTrailing: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  removeTapInIconTile: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  removeTapInRow: {
    width: '100%',
  },
  removeTapInTrailing: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  topBarSlot: {
    alignItems: 'flex-start',
    width: 52,
  },
  topBarButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 8,
  },
  topTitle: {
    flexShrink: 1,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
  },
  publicActionStack: {
    gap: 10,
  },
});
