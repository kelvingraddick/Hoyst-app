import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  ChartColumnIncreasing,
  ChevronRight,
  Crown,
  Globe2,
  LogOut,
  Lock,
  Pencil,
  Settings2,
  Target,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {CircleCompanionGrid} from '../../../design/components/CircleCompanionGrid';
import {
  ContributionSummaryIcon,
  StreakSummaryIcon,
} from '../../../design/components/CircleSummaryRings';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {
  CircleCategoryIcon,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {
  ScreenHeroHeader,
  HeroIconButton,
} from '../../../design/components/ScreenHeroHeader';
import {
  SectionEyebrow,
  SectionEyebrowTrailing,
} from '../../../design/components/SectionEyebrow';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {
  StatBarCard,
  clampStatPercent,
} from '../../../design/components/StatBarCard';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
import {WeekProgressStrip} from '../../../design/components/WeekProgressStrip';
import {getPulseRingStateForCircle} from '../../../design/components/pulse-ring-state';
import {actionMotion} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {useProtectedAction} from '../../auth/hooks/useProtectedAction';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {removeTapIn} from '../../check-in/services/check-in-service';
import {getCircleDetail} from '../mockData';
import {
  deleteCircle,
  joinCircle,
  leaveCircle,
  nudgeCircleMembers,
  reviewJoinRequest,
} from '../services/circle-service';
import {subscribeToPublicCircle} from '../services/public-circle-service';
import {circleProgressToWeekCells} from '../services/week-progress-adapter';
import {
  buildPublicCircleDetail,
  subscribeToMemberCircleDetail,
} from '../../home/services/home-data-service';
import type {
  CircleDetailModel,
  CircleMemberStatus,
  CircleSummary,
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
type ToolTileTone = 'green' | 'purple' | 'blue' | 'orange';
type CircleDetailArtworkKind =
  | 'completion'
  | 'flame'
  | 'goals'
  | 'leaderboard'
  | 'members'
  | 'settings';
type CircleDetailArtworkAdjustment = {
  scale: number;
  translateX?: number;
  translateY?: number;
};

const STAT_ARTWORK_SIZE = 26;
const TOOL_ARTWORK_SIZE = 24;
const ARTWORK_ICON_ADJUSTMENTS: Record<
  CircleDetailArtworkKind,
  CircleDetailArtworkAdjustment
> = {
  completion: {scale: 1},
  flame: {scale: 1},
  goals: {scale: 1, translateX: 0.5, translateY: 0.5},
  leaderboard: {scale: 1, translateY: 0.5},
  members: {scale: 1, translateY: 1},
  settings: {scale: 1},
};

function getDetailStatusPill(
  detail: CircleDetailModel,
): DetailStatusPill | undefined {
  if (detail.viewerMembershipStatus === 'pending') {
    return {label: 'Pending', tone: 'purple'};
  }

  if (!detail.viewerRole) {
    return undefined;
  }

  if (detail.viewerTodayStatus === 'skip') {
    return {label: 'Skipped', tone: 'orange'};
  }

  if (detail.viewerHasTappedInToday) {
    return {label: 'Tapped today', tone: 'green'};
  }

  if (!detail.viewerHasCheckedIn) {
    return {label: 'Needs You', tone: 'orange'};
  }

  if (detail.remainingCheckIns && detail.remainingCheckIns > 0) {
    return {label: 'Others Needed', tone: 'yellow'};
  }

  return {label: 'Complete', tone: 'green'};
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

function getJoinModeLabel(detail: CircleDetailModel) {
  if (detail.joinMode === 'invite_only') {
    return 'Invite only';
  }

  return detail.joinLabel ?? 'Requests open';
}

function formatNudgeTargetCount(count: number) {
  return count === 1 ? '1 member to nudge' : `${count} members to nudge`;
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

function CategoryTextPill({
  category,
  style,
  uppercase = false,
}: {
  category: string;
  style?: StyleProp<ViewStyle>;
  uppercase?: boolean;
}) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category);
  const foregroundColor = getCircleCategoryForegroundColor(category, theme);
  const label = uppercase ? visual.label.toUpperCase() : visual.label;
  const backgroundColor =
    visual.tone === 'neutral' ? theme.surfaceHigh : `${visual.accentColor}22`;

  return (
    <HeroTextPill
      backgroundColor={backgroundColor}
      foregroundColor={foregroundColor}
      label={label}
      style={style}
    />
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

function CircleDetailArtworkIcon({
  color,
  kind,
  size = 30,
}: {
  color: string;
  kind: CircleDetailArtworkKind;
  size?: number;
}) {
  const adjustment = ARTWORK_ICON_ADJUSTMENTS[kind];
  const renderIcon = (children: React.ReactNode) => (
    <View
      style={[styles.artworkIconFrame, {height: size, width: size}]}
      testID={`circle-detail-artwork-${kind}`}>
      <View
        style={[
          styles.artworkIconContent,
          {
            transform: [
              {translateX: adjustment.translateX ?? 0},
              {translateY: adjustment.translateY ?? 0},
              {scale: adjustment.scale},
            ],
          },
        ]}>
        {children}
      </View>
    </View>
  );

  if (kind === 'completion') {
    return renderIcon(
      <ContributionSummaryIcon
        size={size}
        testID="circle-detail-completion-icon"
      />,
    );
  }

  if (kind === 'flame') {
    return renderIcon(
      <StreakSummaryIcon size={size} testID="circle-detail-streak-icon" />,
    );
  }

  if (kind === 'leaderboard') {
    return renderIcon(
      <ChartColumnIncreasing color={color} size={size} strokeWidth={3} />,
    );
  }

  if (kind === 'goals') {
    return renderIcon(<Target color={color} size={size} strokeWidth={3} />);
  }

  if (kind === 'settings') {
    return renderIcon(<Settings2 color={color} size={size} strokeWidth={3} />);
  }

  return renderIcon(<UsersRound color={color} size={size} strokeWidth={3} />);
}

function DashboardUtilityAction({
  icon,
  label,
  labelColor,
  onPress,
  showChevron = true,
  supportingText,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress?: () => void;
  showChevron?: boolean;
  supportingText: string;
}) {
  const theme = useHoystTheme();
  const content = (
    <View
      style={[
        styles.dashboardUtilityFill,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.borderStrong,
        },
      ]}>
      <View style={styles.dashboardUtilityIcon}>{icon}</View>
      <View style={styles.dashboardActionCopy}>
        <HoystText
          numberOfLines={1}
          style={[
            styles.dashboardUtilityLabel,
            labelColor ? {color: labelColor} : undefined,
          ]}
          variant="button">
          {label}
        </HoystText>
        <HoystText numberOfLines={1} tone="muted" variant="caption">
          {supportingText}
        </HoystText>
      </View>
      {showChevron ? (
        <ChevronRight color={theme.textSubtle} size={17} strokeWidth={2.2} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.dashboardUtilityPressable}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.dashboardUtilityPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      {content}
    </Pressable>
  );
}

function HeroTaskDescription({commitment}: {commitment: string}) {
  return (
    <View style={styles.heroTaskDescription}>
      <HoystText numberOfLines={2} style={styles.heroTaskPrimary} tone="muted">
        {commitment}
      </HoystText>
    </View>
  );
}

function TapInReferenceAction({
  label,
  onPress,
  ringState,
  supportingText,
  variant = 'reference',
}: {
  label: string;
  onPress: () => void;
  ringState: React.ComponentProps<typeof TapInPulseButton>['ringState'];
  supportingText: string;
  variant?: React.ComponentProps<typeof TapInPulseButton>['variant'];
}) {
  return (
    <TapInPulseButton
      label={label}
      onPress={() => onPress()}
      ringState={ringState}
      supportingText={supportingText}
      variant={variant}
    />
  );
}

function getCompanionPeriodLabel(detail: CircleDetailModel) {
  if (detail.commitmentCadence === 'monthly') {
    return 'this month';
  }

  if (detail.commitmentCadence === 'weekly') {
    return 'this week';
  }

  return 'today';
}

function getCompanionProgressSubtitle(detail: CircleDetailModel) {
  const activeMembers = detail.members.filter(
    member => member.membershipStatus !== 'pending',
  );
  const doneCount = activeMembers.filter(
    member => member.state === 'done',
  ).length;

  return `${doneCount} of ${activeMembers.length} ${getCompanionPeriodLabel(
    detail,
  )}`;
}

function CircleStatRings({
  detail,
  weekCells,
  weekStreakDays,
}: {
  detail: CircleDetailModel;
  weekCells: React.ComponentProps<typeof WeekProgressStrip>['days'];
  weekStreakDays: number;
}) {
  const theme = useHoystTheme();
  const completion = clampStatPercent(detail.completionRate);
  const streakSource =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const streakValue = Number.isFinite(streakSource) ? streakSource : 0;
  const streakProgress = Math.max(0, Math.min(1, streakValue / 7));
  const maxSize =
    detail.maxSize > 0 ? detail.maxSize : Math.max(detail.memberCount, 1);
  const memberProgress = Math.max(0, Math.min(1, detail.memberCount / maxSize));
  const statsRangeLabel =
    detail.commitmentCadence === 'monthly' ? 'This month' : 'This week';

  return (
    <View style={styles.statRingsSection}>
      <View style={styles.statsTitleRow}>
        <SectionEyebrow>Stats</SectionEyebrow>
        <SectionEyebrowTrailing>{statsRangeLabel}</SectionEyebrowTrailing>
      </View>
      <GlassPanel padding="compact" style={styles.statsWeekCard}>
        <WeekProgressStrip
          days={weekCells}
          showStreak={false}
          title="LAST 7 DAYS"
        />
      </GlassPanel>
      <View style={styles.statRingsRow}>
        <StatBarCard
          accessibilityLabel={`Completion ${completion}%.`}
          barColor="#10B967"
          chipColor="#E8F8EF"
          chipTestID="circle-stats-completion-disc"
          label="Completion"
          progress={completion / 100}
          surfaceStyle={styles.statBarCardSurface}
          trackColor="rgba(16,185,103,0.2)"
          value={`${completion}%`}>
          <CircleDetailArtworkIcon
            color={theme.successForeground}
            kind="completion"
            size={STAT_ARTWORK_SIZE}
          />
        </StatBarCard>
        <StatBarCard
          accessibilityLabel={`Streak ${streakValue} ${
            streakValue === 1 ? 'day' : 'days'
          }.`}
          barColor="#FF8A3D"
          chipColor="#FFE1D2"
          chipTestID="circle-stats-streak-disc"
          label="Streak"
          progress={streakProgress}
          surfaceStyle={styles.statBarCardSurface}
          trackColor="rgba(255,138,61,0.22)"
          value={String(streakValue)}>
          <CircleDetailArtworkIcon
            color={theme.warningForeground}
            kind="flame"
            size={STAT_ARTWORK_SIZE}
          />
        </StatBarCard>
        <StatBarCard
          accessibilityLabel={`Members ${detail.memberCount} of ${maxSize}.`}
          barColor="#7A55FF"
          chipColor="#ECE6FF"
          chipTestID="circle-stats-members-disc"
          label="Members"
          progress={memberProgress}
          surfaceStyle={styles.statBarCardSurface}
          trackColor="rgba(122,85,255,0.22)"
          value={`${detail.memberCount}/${maxSize}`}>
          <CircleDetailArtworkIcon
            color={theme.accentSecondaryForeground}
            kind="members"
            size={STAT_ARTWORK_SIZE}
          />
        </StatBarCard>
      </View>
    </View>
  );
}

function NudgePanel({
  isNudging,
  nudged,
  onPress,
  targetCount,
  targetCopy,
}: {
  isNudging: boolean;
  nudged: boolean;
  onPress: () => void;
  targetCount: number;
  targetCopy: string;
}) {
  const theme = useHoystTheme();
  const title = isNudging
    ? 'Nudging...'
    : nudged
    ? 'Nudge Sent'
    : 'Send a Nudge';
  const disabled = isNudging || nudged;
  const foregroundColor = theme.accentSecondaryForeground;

  return (
    <Pressable
      accessibilityLabel={`${title}. ${targetCopy}`}
      accessibilityRole="button"
      accessibilityState={{busy: isNudging, disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.nudgePanel,
        {
          opacity: disabled ? (nudged ? 0.84 : 0.58) : pressed ? 0.94 : 1,
          shadowColor: theme.shadow,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <View
        style={[
          styles.nudgePanelFrame,
          {
            backgroundColor: theme.isDark
              ? 'rgba(122,85,255,0.16)'
              : 'rgba(122,85,255,0.11)',
            borderColor: theme.isDark
              ? 'rgba(170,145,255,0.28)'
              : 'rgba(122,85,255,0.24)',
          },
        ]}>
        <View style={styles.nudgePanelContent}>
          <View
            style={[
              styles.nudgeMarkWrap,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.22)'
                  : 'rgba(122,85,255,0.12)',
              },
            ]}>
            <UserCheck color={foregroundColor} size={23} strokeWidth={2.7} />
            <View
              style={[
                styles.nudgeCountBadge,
                {
                  backgroundColor: foregroundColor,
                  borderColor: theme.isDark
                    ? 'rgba(18,20,34,0.98)'
                    : 'rgba(255,255,255,0.96)',
                },
              ]}>
              <HoystText style={styles.nudgeCountBadgeText} variant="tiny">
                {targetCount}
              </HoystText>
            </View>
          </View>
          <View style={styles.nudgeCopy}>
            <HoystText style={[styles.nudgeTitle, {color: foregroundColor}]}>
              {title}
            </HoystText>
            <HoystText
              numberOfLines={1}
              style={[styles.nudgeSubtitle, {color: foregroundColor}]}>
              {targetCopy}
            </HoystText>
          </View>
          <View
            style={[
              styles.nudgeActionIcon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.20)'
                  : 'rgba(122,85,255,0.12)',
              },
            ]}>
            <ChevronRight color={foregroundColor} size={17} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function getToolTileToneColors(
  tone: ToolTileTone,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (tone === 'purple') {
    return {
      backgroundColor: `${theme.accentSecondary}16`,
      color: theme.accentSecondaryForeground,
    };
  }

  if (tone === 'blue') {
    return {
      backgroundColor: `${theme.accentTertiary}16`,
      color: theme.accentTertiaryForeground,
    };
  }

  if (tone === 'orange') {
    return {
      backgroundColor: `${theme.warning}16`,
      color: theme.warningForeground,
    };
  }

  return {
    backgroundColor: `${theme.success}16`,
    color: theme.successForeground,
  };
}

function MemberToolTile({
  icon,
  onPress,
  subtitle,
  title,
  tone,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  subtitle: string;
  title: string;
  tone: ToolTileTone;
}) {
  const theme = useHoystTheme();
  const toneColors = getToolTileToneColors(tone, theme);
  const subtitleColor = theme.isDark ? '#AEB4C2' : '#9491B2';
  const content = (
    <GlassPanel
      padding="none"
      style={[
        styles.memberToolTileInner,
        {
          borderColor: theme.glassBorder,
        },
      ]}>
      <View style={styles.memberToolTileContent}>
        <View
          style={[
            styles.memberToolIcon,
            {backgroundColor: toneColors.backgroundColor},
          ]}>
          {icon}
        </View>
        <View style={styles.memberToolCopy}>
          <HoystText
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.memberToolTitle}>
            {title}
          </HoystText>
          <HoystText
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={[styles.memberToolSubtitle, {color: subtitleColor}]}>
            {subtitle}
          </HoystText>
        </View>
      </View>
    </GlassPanel>
  );

  if (!onPress) {
    return <View style={styles.memberToolTile}>{content}</View>;
  }

  return (
    <View style={styles.memberToolTile}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({pressed}) => [
          styles.memberToolPressable,
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}>
        {content}
      </Pressable>
    </View>
  );
}

function MemberToolsTiles({
  isExpanded,
  isOwner,
  onToggleManage,
}: {
  isExpanded: boolean;
  isOwner: boolean;
  onToggleManage: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <View style={styles.memberToolsSection}>
      <SectionEyebrow>
        {isOwner ? 'Circle Tools' : 'Member Tools'}
      </SectionEyebrow>
      <View style={styles.memberToolsGrid}>
        <MemberToolTile
          icon={
            <CircleDetailArtworkIcon
              color={theme.successForeground}
              kind="members"
              size={TOOL_ARTWORK_SIZE}
            />
          }
          subtitle="View all"
          title="Members"
          tone="green"
        />
        <MemberToolTile
          icon={
            <CircleDetailArtworkIcon
              color={theme.accentSecondaryForeground}
              kind="leaderboard"
              size={TOOL_ARTWORK_SIZE}
            />
          }
          subtitle="See ranks"
          title="Leaderboard"
          tone="purple"
        />
        <MemberToolTile
          icon={
            <CircleDetailArtworkIcon
              color={theme.accentTertiaryForeground}
              kind="goals"
              size={TOOL_ARTWORK_SIZE}
            />
          }
          subtitle="Track progress"
          title="Goals"
          tone="blue"
        />
        <MemberToolTile
          icon={
            <CircleDetailArtworkIcon
              color={theme.warningForeground}
              kind="settings"
              size={TOOL_ARTWORK_SIZE}
            />
          }
          onPress={onToggleManage}
          subtitle={isExpanded ? 'Hide tools' : 'Manage group'}
          title="Settings"
          tone="orange"
        />
      </View>
    </View>
  );
}

function DeleteCircleConfirmModal({
  canConfirm,
  circleTitle,
  confirmText,
  isDeleting,
  onCancel,
  onConfirm,
  onConfirmTextChange,
  visible,
}: {
  canConfirm: boolean;
  circleTitle: string;
  confirmText: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmTextChange: (value: string) => void;
  visible: boolean;
}) {
  const theme = useHoystTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onCancel}
      transparent
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}>
        <View style={styles.modalOverlay}>
          <GlassPanel style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Trash2
                color={theme.dangerForeground}
                size={22}
                strokeWidth={2.3}
              />
              <HoystText
                style={[styles.modalTitle, {color: theme.dangerForeground}]}>
                Delete circle
              </HoystText>
            </View>
            <View style={styles.modalCopy}>
              <HoystText tone="muted">
                This permanently deletes the circle, members, requests, and Tap
                In history.
              </HoystText>
              <HoystText variant="bodyStrong">{circleTitle}</HoystText>
              <HoystText tone="muted" variant="caption">
                Type the circle name to confirm.
              </HoystText>
            </View>
            <HoystInput
              accessibilityLabel="Confirm circle name"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isDeleting}
              onChangeText={onConfirmTextChange}
              placeholder={circleTitle}
              value={confirmText}
            />
            <View style={styles.modalActions}>
              <HoystButton
                disabled={isDeleting}
                label="Cancel"
                onPress={onCancel}
                variant="outline"
              />
              <HoystButton
                backgroundColor={`${theme.danger}24`}
                borderColor={`${theme.dangerForeground}66`}
                disabled={!canConfirm || isDeleting}
                icon={
                  <Trash2
                    color={theme.dangerForeground}
                    size={18}
                    strokeWidth={2.3}
                  />
                }
                label={isDeleting ? 'Deleting...' : 'Delete Circle'}
                onPress={onConfirm}
                textColor={theme.dangerForeground}
                variant="outline"
              />
            </View>
          </GlassPanel>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CircleDetailScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
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
  const [joinRequested, setJoinRequested] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingCircle, setIsDeletingCircle] = useState(false);
  const [isOwnerToolsExpanded, setIsOwnerToolsExpanded] = useState(false);
  const [isMemberToolsExpanded, setIsMemberToolsExpanded] = useState(false);
  const [isLeavingCircle, setIsLeavingCircle] = useState(false);
  const [publicCircle, setPublicCircle] = useState<CircleSummary | undefined>();
  const [memberCircle, setMemberCircle] = useState<
    CircleDetailModel | undefined
  >();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const requireAccount = useProtectedAction(navigation);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadMemberCircle =
    status === 'authenticatedReady' && Boolean(user?.uid);
  const detail = useMemo(
    () =>
      memberCircle ??
      (publicCircle ? buildPublicCircleDetail(publicCircle) : undefined) ??
      getCircleDetail(route.params.circleId),
    [memberCircle, publicCircle, route.params.circleId],
  );
  const nudgeTargetMembers = useMemo(
    () =>
      detail?.members.filter(
        member =>
          member.state === 'pending' &&
          member.membershipStatus !== 'pending' &&
          member.id !== user?.uid,
      ) ?? [],
    [detail?.members, user?.uid],
  );
  useEffect(() => {
    setNudged(false);
    setNudgedMemberIds(new Set());
    setNudgingMemberIds(new Set());
  }, [detail?.id]);

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
  const canInvite =
    Boolean(detail.inviteUrl) &&
    (detail.viewerRole === 'owner' || detail.viewerRole === 'admin');
  const detailStatusPill = getDetailStatusPill(detail);
  const nudgeTargetCount = detail.nudgeTargetCount ?? nudgeTargetMembers.length;
  const canNudgeTargets = nudgeTargetCount > 0;
  const nudgeTargetCopy = formatNudgeTargetCount(nudgeTargetCount);
  const previewCopy =
    detail.matchCopy ?? 'Preview the circle before you jump in.';
  const streakValue =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const privacyLabel = detail.privacy === 'private' ? 'Private' : 'Public';
  const joinActionLabel = joinRequested
    ? detail.joinLabel === 'Open seats'
      ? 'Joined'
      : 'Request sent'
    : detail.joinLabel === 'Open seats'
    ? 'Join Circle'
    : 'Request to join';
  const canRemoveTodayCheckIn =
    isMemberCircle &&
    (detail.viewerTodayStatus === 'done' ||
      detail.viewerTodayStatus === 'skip');
  const tapInPrimaryActionLabel = canRemoveTodayCheckIn
    ? 'View Today'
    : 'Tap In';
  const tapInPulseRingState = getPulseRingStateForCircle(detail);
  const canDeleteCircle = isMemberCircle && detail.viewerRole === 'owner';
  const canReviewJoinRequests = canDeleteCircle;
  const canLeaveCircle =
    Boolean(detail.viewerRole) && detail.viewerRole !== 'owner';
  const leaveActionLabel = isPendingMembership
    ? 'Cancel Request'
    : 'Leave Circle';
  const leaveActionSupportingText = isPendingMembership
    ? 'Pending approval'
    : 'Remove membership';
  const canConfirmDeleteCircle =
    deleteConfirmText.trim().toLowerCase() ===
    detail.title.trim().toLowerCase();
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const removeProgressionCopy =
    detail.commitmentCadence === 'daily'
      ? "This will undo today's Progression for this Circle."
      : detail.commitmentCadence === 'monthly'
      ? "This will undo this month's Progression for this Circle."
      : "This will undo this week's Progression for this Circle.";
  const commitmentPrefix =
    detail.commitmentCadence === 'monthly'
      ? 'Monthly Goal'
      : detail.commitmentCadence === 'weekly'
      ? 'Weekly Task'
      : 'Daily Task';
  const roleOrJoinLabel = isMemberCircle
    ? getRoleLabel(detail)
    : getJoinModeLabel(detail);
  const roleMetaColor =
    detail.viewerRole === 'owner'
      ? theme.warningForeground
      : detail.viewerRole === 'admin'
      ? theme.accentSecondaryForeground
      : theme.textMuted;
  const tapInSupportingText = canRemoveTodayCheckIn
    ? "Review today's Tap In"
    : detail.commitmentCadence === 'monthly'
    ? 'Log your progress this month'
    : detail.commitmentCadence === 'weekly'
    ? 'Log your progress this week'
    : 'Log your progress for today';
  const categoryProgressColor = getCircleCategoryForegroundColor(
    detail.category,
    theme,
  );
  const categoryVisual = getCircleCategoryVisual(detail.category);
  const categoryBackdropAccent = theme.isDark
    ? categoryVisual.accentLight
    : categoryVisual.accentColor;
  const heroMetaColor = theme.isDark ? '#B9BED2' : '#817FA2';
  const heroMetaIconColor = theme.isDark ? '#AEB4C2' : '#9693B8';
  const detailStatusPillPalette = detailStatusPill
    ? getHeroStatusPillPalette(detailStatusPill.tone, theme)
    : undefined;

  const circleProgressionPercent =
    detail.progressPercent ?? detail.completionRate ?? 0;
  const weekStreakDays = Number.isFinite(streakValue)
    ? Math.max(0, streakValue)
    : 0;
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

  const openInbox = () => {
    navigation.navigate('Inbox');
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
    Alert.alert('Remove today?', removeProgressionCopy, [
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

  const openDeleteCircleConfirm = () => {
    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(true);
  };

  const openEditCircle = () => {
    navigation.navigate('EditCircle', {circleId: detail.id});
  };

  const closeDeleteCircleConfirm = () => {
    if (isDeletingCircle) {
      return;
    }

    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(false);
  };

  const handleDeleteCircle = async () => {
    if (!canConfirmDeleteCircle || isDeletingCircle) {
      return;
    }

    setIsDeletingCircle(true);
    try {
      await deleteCircle(detail.id);
      setIsDeleteConfirmVisible(false);
      setDeleteConfirmText('');
      navigateBack();
      Alert.alert('Circle deleted', `${detail.title} has been deleted.`);
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not delete this circle. Try again.';
      Alert.alert('Delete failed', message);
    } finally {
      setIsDeletingCircle(false);
    }
  };

  const handleLeaveCircle = async () => {
    if (!canLeaveCircle || isLeavingCircle) {
      return;
    }

    setIsLeavingCircle(true);
    try {
      const result = await leaveCircle(detail.id);
      setIsMemberToolsExpanded(false);

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs', {screen: 'Home'});
      }

      Alert.alert(
        result.status === 'cancelled' ? 'Request cancelled' : 'Left circle',
        result.status === 'cancelled'
          ? `Your request to join ${detail.title} has been cancelled.`
          : `You left ${detail.title}.`,
      );
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not update your membership. Try again.';
      Alert.alert('Leave failed', message);
    } finally {
      setIsLeavingCircle(false);
    }
  };

  const confirmLeaveCircle = () => {
    Alert.alert(
      isPendingMembership ? 'Cancel request?' : 'Leave circle?',
      isPendingMembership
        ? 'The circle owner will no longer see your request.'
        : 'Your membership, Tap Ins, and check-in media for this Circle will be removed.',
      [
        {style: 'cancel', text: 'Keep'},
        {
          onPress: () => {
            handleLeaveCircle().catch(() => undefined);
          },
          style: 'destructive',
          text: isPendingMembership ? 'Cancel Request' : 'Leave',
        },
      ],
    );
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
    <DashboardUtilityAction
      icon={
        <Trash2 color={theme.dangerForeground} size={17} strokeWidth={2.2} />
      }
      labelColor={theme.dangerForeground}
      label={isRemovingTapIn ? 'Removing...' : removeActionLabel}
      onPress={isRemovingTapIn ? undefined : confirmRemoveTodayCheckIn}
      showChevron={false}
      supportingText="Undo today"
    />
  ) : null;
  const companionFooterAction =
    isMemberCircle && canNudgeTargets ? (
      <NudgePanel
        isNudging={isNudging}
        nudged={nudged}
        onPress={handleSendNudge}
        targetCopy={nudgeTargetCopy}
        targetCount={nudgeTargetCount}
      />
    ) : undefined;

  return (
    <HoystScreen
      background={<FrostedBackdrop topAccentColor={categoryBackdropAccent} />}
      contentContainerStyle={styles.content}
      padded={false}>
      <View style={styles.detailStack}>
        <ScreenHeroHeader
          actions={
            <>
              <HeroIconButton
                accessibilityLabel="Open Inbox"
                onPress={openInbox}>
                <Bell color={theme.textMuted} size={20} strokeWidth={2.2} />
              </HeroIconButton>
              {canInvite ? (
                <HeroIconButton
                  accessibilityLabel="Invite members"
                  onPress={shareInvite}>
                  <UserPlus
                    color={theme.textMuted}
                    size={18}
                    strokeWidth={2.2}
                  />
                </HeroIconButton>
              ) : null}
            </>
          }
          icon={
            <View testID="circle-detail-title-category-icon">
              <CircleCategoryIcon
                category={detail.category}
                shape="roundedSquare"
                size={52}
              />
            </View>
          }
          description={<HeroTaskDescription commitment={detail.commitment} />}
          insetTop={false}
          meta={
            <>
              <CategoryTextPill
                category={detail.category}
                style={styles.heroIdentityPill}
                uppercase
              />
              <HeroTextPill
                backgroundColor={theme.surfaceHigh}
                foregroundColor={theme.textMuted}
                label={commitmentPrefix}
                style={styles.heroIdentityPill}
              />
              {detailStatusPill && detailStatusPillPalette ? (
                <HeroTextPill
                  backgroundColor={detailStatusPillPalette.backgroundColor}
                  foregroundColor={detailStatusPillPalette.foregroundColor}
                  label={detailStatusPill.label}
                  style={styles.heroIdentityPill}
                />
              ) : null}
              <View style={styles.heroInlineMetaRow}>
                <HeroInlineMetaItem
                  color={heroMetaColor}
                  icon={
                    detail.privacy === 'private' ? (
                      <Lock
                        color={heroMetaIconColor}
                        size={15}
                        strokeWidth={2.2}
                      />
                    ) : (
                      <Globe2
                        color={heroMetaIconColor}
                        size={15}
                        strokeWidth={2.2}
                      />
                    )
                  }
                  label={privacyLabel}
                />
                <View style={styles.heroInlineMetaDot} />
                <HeroInlineMetaItem
                  color={heroMetaColor}
                  icon={
                    <UsersRound
                      color={heroMetaIconColor}
                      size={15}
                      strokeWidth={2.2}
                    />
                  }
                  label={`${detail.memberCount}/${detail.maxSize}`}
                />
                <View style={styles.heroInlineMetaDot} />
                <HeroInlineMetaItem
                  color={roleMetaColor}
                  icon={
                    <Crown color={roleMetaColor} size={15} strokeWidth={2.2} />
                  }
                  label={roleOrJoinLabel}
                />
              </View>
            </>
          }
          navTitle="Circle"
          onBack={navigateBack}
          primaryAction={
            isMemberCircle ? (
              <TapInReferenceAction
                label={tapInPrimaryActionLabel}
                onPress={openTapInComposer}
                ringState={tapInPulseRingState}
                supportingText={tapInSupportingText}
                variant="hero"
              />
            ) : undefined
          }
          progress={{
            color: categoryProgressColor,
            label: 'Circle progression',
            percent: circleProgressionPercent,
          }}
          subtitle={detailStatusPill ? undefined : previewCopy}
          title={detail.title}
        />

        <View style={styles.bodyStack} testID="circle-detail-body-stack">
          <CircleCompanionGrid
            canTapInViewer={isMemberCircle && !canRemoveTodayCheckIn}
            footerAction={companionFooterAction}
            inviteAction={
              canInvite
                ? {
                    accessibilityLabel: 'Invite companions',
                    onPress: shareInvite,
                  }
                : undefined
            }
            members={detail.members}
            nudgedMemberIds={nudgedMemberIds}
            nudgingMemberIds={nudgingMemberIds}
            onNudgeMember={isMemberCircle ? handleSendMemberNudge : undefined}
            onReviewPendingMember={
              canReviewJoinRequests ? openReviewJoinRequestSheet : undefined
            }
            onTapInViewer={openTapInComposer}
            reviewingPendingMemberId={reviewingRequestId}
            subtitle={getCompanionProgressSubtitle(detail)}
            tapInRingState={tapInPulseRingState}
            viewerUid={user?.uid}
          />

          {!isMemberCircle ? (
            isPendingMembership && canLeaveCircle ? (
              <View style={styles.publicActionStack}>
                <HoystButton
                  icon={
                    <UserPlus
                      color={theme.actionForeground}
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

          <CircleStatRings
            detail={detail}
            weekCells={weekCells}
            weekStreakDays={weekStreakDays}
          />

          {isMemberCircle && canDeleteCircle ? (
            <View style={styles.circleToolsGroup}>
              <MemberToolsTiles
                isExpanded={isOwnerToolsExpanded}
                isOwner
                onToggleManage={() =>
                  setIsOwnerToolsExpanded(currentValue => !currentValue)
                }
              />
              {removeTapInAction}
              {isOwnerToolsExpanded ? (
                <View style={styles.ownerToolsActions}>
                  <DashboardUtilityAction
                    icon={
                      <Pencil color={theme.text} size={17} strokeWidth={2.2} />
                    }
                    label="Edit Circle"
                    onPress={openEditCircle}
                    supportingText="Owner settings"
                  />
                  <DashboardUtilityAction
                    icon={
                      <Trash2
                        color={theme.dangerForeground}
                        size={17}
                        strokeWidth={2.2}
                      />
                    }
                    label="Delete Circle"
                    labelColor={theme.dangerForeground}
                    onPress={openDeleteCircleConfirm}
                    showChevron={false}
                    supportingText="Permanent"
                  />
                </View>
              ) : null}
            </View>
          ) : isMemberCircle && canLeaveCircle ? (
            <View style={styles.circleToolsGroup}>
              <MemberToolsTiles
                isExpanded={isMemberToolsExpanded}
                isOwner={false}
                onToggleManage={() =>
                  setIsMemberToolsExpanded(currentValue => !currentValue)
                }
              />
              {removeTapInAction}
              {isMemberToolsExpanded ? (
                <View style={styles.ownerToolsActions}>
                  <DashboardUtilityAction
                    icon={
                      <LogOut
                        color={theme.dangerForeground}
                        size={17}
                        strokeWidth={2.2}
                      />
                    }
                    label={isLeavingCircle ? 'Working...' : leaveActionLabel}
                    labelColor={theme.dangerForeground}
                    onPress={isLeavingCircle ? undefined : confirmLeaveCircle}
                    showChevron={false}
                    supportingText={leaveActionSupportingText}
                  />
                </View>
              ) : null}
            </View>
          ) : isPendingMembership && canLeaveCircle ? (
            <View style={styles.circleToolsGroup}>
              <MemberToolsTiles
                isExpanded={isMemberToolsExpanded}
                isOwner={false}
                onToggleManage={() =>
                  setIsMemberToolsExpanded(currentValue => !currentValue)
                }
              />
              {isMemberToolsExpanded ? (
                <View style={styles.ownerToolsActions}>
                  <DashboardUtilityAction
                    icon={
                      <LogOut
                        color={theme.dangerForeground}
                        size={17}
                        strokeWidth={2.2}
                      />
                    }
                    label={isLeavingCircle ? 'Working...' : leaveActionLabel}
                    labelColor={theme.dangerForeground}
                    onPress={isLeavingCircle ? undefined : confirmLeaveCircle}
                    showChevron={false}
                    supportingText={leaveActionSupportingText}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <DeleteCircleConfirmModal
          canConfirm={canConfirmDeleteCircle}
          circleTitle={detail.title}
          confirmText={deleteConfirmText}
          isDeleting={isDeletingCircle}
          onCancel={closeDeleteCircleConfirm}
          onConfirm={() => {
            handleDeleteCircle().catch(() => undefined);
          }}
          onConfirmTextChange={setDeleteConfirmText}
          visible={isDeleteConfirmVisible}
        />
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 148,
  },
  detailStack: {},
  bodyStack: {
    gap: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  heroIdentityPill: {
    flexGrow: 1,
    minWidth: 104,
  },
  heroInlineMetaDot: {
    backgroundColor: 'rgba(142,147,176,0.42)',
    borderRadius: 2,
    height: 4,
    width: 4,
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
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 17,
  },
  heroInlineMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingHorizontal: 2,
    width: '100%',
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
  artworkIconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  artworkIconContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRingsSection: {
    gap: 14,
  },
  statsWeekCard: {
    gap: 0,
  },
  statRingsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBarCardSurface: {
    minHeight: 132,
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
  heroTaskDescription: {
    maxWidth: '100%',
  },
  heroTaskPrimary: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 20,
  },
  nudgePanel: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    elevation: 3,
    overflow: 'hidden',
    shadowOffset: {height: 8, width: 0},
    shadowOpacity: 0.07,
    shadowRadius: 16,
    width: '100%',
  },
  nudgePanelFrame: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 9,
    width: '100%',
  },
  nudgePanelContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 15,
    minHeight: 54,
    width: '100%',
  },
  nudgeActionIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  nudgeCountBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    top: -7,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -7,
  },
  nudgeCountBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  nudgeCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  nudgeMarkWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    position: 'relative',
    width: 54,
  },
  nudgeSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 18,
    opacity: 0.88,
  },
  nudgeTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  memberToolsSection: {
    gap: 12,
  },
  memberToolsGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  memberToolIcon: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  memberToolCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  memberToolSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 16,
  },
  memberToolTile: {
    borderRadius: radius.lg,
    width: '48.8%',
    minWidth: 0,
  },
  memberToolPressable: {
    width: '100%',
  },
  memberToolTileInner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 78,
    width: '100%',
  },
  memberToolTileContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: '100%',
  },
  memberToolTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  circleToolsGroup: {
    gap: 12,
  },
  ownerToolsActions: {
    gap: 8,
    paddingTop: 2,
  },
  dashboardUtilityPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    width: '100%',
  },
  dashboardUtilityFill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '100%',
  },
  dashboardUtilityIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dashboardActionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  dashboardUtilityLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  publicActionStack: {
    gap: 10,
  },
  statsSeeAll: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  statsTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalActions: {
    gap: 10,
  },
  modalCopy: {
    gap: 8,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 24,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.52)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  modalPanel: {
    alignSelf: 'stretch',
  },
});
