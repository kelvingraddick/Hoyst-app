import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Globe2,
  Lock,
  MessageCircle,
  Settings2,
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
  joinCircle,
  nudgeCircleMembers,
  reviewJoinRequest,
} from '../services/circle-service';
import {subscribeToCircleThreadPreview} from '../services/circle-thread-service';
import {subscribeToPublicCircle} from '../services/public-circle-service';
import {circleProgressToWeekCells} from '../services/week-progress-adapter';
import {
  buildPublicCircleDetail,
  subscribeToMemberCircleDetail,
} from '../../home/services/home-data-service';
import type {
  CircleDetailModel,
  CircleMemberStatus,
  CircleThreadPreview,
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
type CircleDetailArtworkKind = 'completion' | 'flame' | 'members';
type CircleDetailArtworkAdjustment = {
  scale: number;
  translateX?: number;
  translateY?: number;
};

const STAT_ARTWORK_SIZE = 26;
const ARTWORK_ICON_ADJUSTMENTS: Record<
  CircleDetailArtworkKind,
  CircleDetailArtworkAdjustment
> = {
  completion: {scale: 1},
  flame: {scale: 1},
  members: {scale: 1, translateY: 1},
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

  if (detail.viewerTodayStatus === 'failed') {
    return {label: 'Outside range', tone: 'orange'};
  }

  if (detail.viewerTodayStatus === 'partial') {
    return {label: 'Progress saved', tone: 'yellow'};
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
}: {
  detail: CircleDetailModel;
  weekCells: React.ComponentProps<typeof WeekProgressStrip>['days'];
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
  const isPersonal = detail.circleMode === 'personal';
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
        {!isPersonal ? (
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
        ) : null}
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
        {!isPersonal ? (
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
        ) : null}
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
      testID="circle-detail-nudge-panel"
      style={({pressed}) => [
        styles.nudgePanel,
        {
          opacity: disabled ? (nudged ? 0.84 : 0.58) : pressed ? 0.94 : 1,
          shadowColor: theme.shadow,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <View
        testID="circle-detail-nudge-panel-frame"
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
            testID="circle-detail-nudge-icon"
            style={[
              styles.nudgeMarkWrap,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.22)'
                  : 'rgba(122,85,255,0.12)',
              },
            ]}>
            <UserCheck color={foregroundColor} size={18} strokeWidth={2.4} />
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
            testID="circle-detail-nudge-action"
            style={[
              styles.nudgeActionIcon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.20)'
                  : 'rgba(122,85,255,0.12)',
              },
            ]}>
            <ChevronRight color={foregroundColor} size={15} strokeWidth={2.4} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CircleThreadPreviewCard({
  onPress,
  preview,
}: {
  onPress: () => void;
  preview?: CircleThreadPreview;
}) {
  const theme = useHoystTheme();
  const unreadCount = preview?.unreadCount ?? 0;
  const hasLatest = Boolean(preview?.latestItem);
  const title = hasLatest ? 'Circle chat' : 'Start the chat';
  const subtitle = preview?.latestLabel ?? 'Message your companions.';

  return (
    <Pressable
      accessibilityLabel="Open circle chat"
      accessibilityRole="button"
      onPress={onPress}
      testID="circle-detail-thread-preview-button"
      style={({pressed}) => [
        styles.threadPreviewPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <GlassPanel padding="none" style={styles.threadPreviewCard}>
        <View
          style={styles.threadPreviewFill}
          testID="circle-detail-thread-preview-fill">
          <View
            testID="circle-detail-thread-preview-icon"
            style={[
              styles.threadPreviewIcon,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(47,111,237,0.22)'
                  : 'rgba(47,111,237,0.12)',
              },
            ]}>
            <MessageCircle
              color={theme.accentTertiaryForeground}
              size={18}
              strokeWidth={2.3}
            />
          </View>
          <View style={styles.threadPreviewCopy}>
            <View style={styles.threadPreviewTitleRow}>
              <HoystText style={styles.threadPreviewTitle}>{title}</HoystText>
              {unreadCount > 0 ? (
                <View
                  style={[
                    styles.threadPreviewBadge,
                    {backgroundColor: theme.dangerForeground},
                  ]}>
                  <HoystText style={styles.threadPreviewBadgeText}>
                    {Math.min(unreadCount, 9)}
                  </HoystText>
                </View>
              ) : null}
            </View>
            <HoystText
              numberOfLines={1}
              style={styles.threadPreviewSubtitle}
              tone="muted"
              variant="caption">
              {subtitle}
            </HoystText>
          </View>
          <View style={styles.threadPreviewTrailing}>
            {preview?.latestTimestamp ? (
              <HoystText tone="muted" variant="tiny">
                {preview.latestTimestamp}
              </HoystText>
            ) : null}
            <ChevronRight
              color={theme.textSubtle}
              size={16}
              strokeWidth={2.4}
            />
          </View>
        </View>
      </GlassPanel>
    </Pressable>
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
  const [publicCircle, setPublicCircle] = useState<CircleSummary | undefined>();
  const [memberCircle, setMemberCircle] = useState<
    CircleDetailModel | undefined
  >();
  const [threadPreview, setThreadPreview] = useState<CircleThreadPreview>();
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

  useEffect(() => {
    if (
      !canLoadMemberCircle ||
      !user?.uid ||
      !detail?.viewerRole ||
      detail.viewerMembershipStatus === 'pending' ||
      detail.circleMode === 'personal'
    ) {
      setThreadPreview(undefined);
      return undefined;
    }

    return subscribeToCircleThreadPreview({
      circleId: route.params.circleId,
      onError: () => setThreadPreview(undefined),
      onPreview: setThreadPreview,
      uid: user.uid,
    });
  }, [
    canLoadMemberCircle,
    detail?.viewerMembershipStatus,
    detail?.viewerRole,
    detail?.circleMode,
    route.params.circleId,
    user?.uid,
  ]);

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
  const canInvite =
    Boolean(detail.inviteUrl) &&
    (detail.viewerRole === 'owner' || detail.viewerRole === 'admin');
  const detailStatusPill = getDetailStatusPill(detail);
  const nudgeTargetCount = detail.nudgeTargetCount ?? nudgeTargetMembers.length;
  const canNudgeTargets = nudgeTargetCount > 0;
  const nudgeTargetCopy = formatNudgeTargetCount(nudgeTargetCount);
  const previewCopy =
    detail.matchCopy ?? 'Preview the circle before you jump in.';
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
    ? 'View Today'
    : 'Tap In';
  const tapInPulseRingState = getPulseRingStateForCircle(detail);
  const canReviewJoinRequests =
    !isPersonal && isMemberCircle && detail.viewerRole === 'owner';
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';
  const removeProgressionCopy = canUpdateTodayQuantity
    ? quantityTapInRemoveCopy
    : detail.commitmentCadence === 'daily'
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
  const tapInSupportingText = canReviewTodayCheckIn
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

  const openCircleThread = () => {
    navigation.navigate('CircleThread', {circleId: detail.id});
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
    isMemberCircle && !isPersonal ? (
      <View
        style={styles.companionActionStack}
        testID="circle-detail-companion-actions">
        {canNudgeTargets ? (
          <NudgePanel
            isNudging={isNudging}
            nudged={nudged}
            onPress={handleSendNudge}
            targetCopy={nudgeTargetCopy}
            targetCount={nudgeTargetCount}
          />
        ) : null}
        <CircleThreadPreviewCard
          onPress={openCircleThread}
          preview={threadPreview}
        />
      </View>
    ) : undefined;

  return (
    <HoystScreen
      background={<FrostedBackdrop topAccentColor={categoryBackdropAccent} />}
      contentContainerStyle={styles.content}
      padded={false}>
      <View style={styles.detailStack}>
        <ScreenHeroHeader
          actions={
            <HeroIconButton
              accessibilityLabel="Open circle settings"
              onPress={openCircleSettings}>
              <Settings2 color={theme.textMuted} size={20} strokeWidth={2.2} />
            </HeroIconButton>
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
                {isPersonal ? (
                  <HeroInlineMetaItem
                    color={theme.successForeground}
                    icon={
                      <Lock
                        color={theme.successForeground}
                        size={15}
                        strokeWidth={2.2}
                      />
                    }
                    label="Personal commitment"
                  />
                ) : (
                  <>
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
                        <Crown
                          color={roleMetaColor}
                          size={15}
                          strokeWidth={2.2}
                        />
                      }
                      label={roleOrJoinLabel}
                    />
                  </>
                )}
              </View>
            </>
          }
          navTitle={isPersonal ? 'Personal Commitment' : 'Circle'}
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
            label: isPersonal ? 'Personal progress' : 'Circle progression',
            percent: circleProgressionPercent,
          }}
          subtitle={detailStatusPill ? undefined : previewCopy}
          title={detail.title}
        />

        <View style={styles.bodyStack} testID="circle-detail-body-stack">
          {!isPersonal ? (
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
          ) : null}

          {!isMemberCircle ? (
            isPendingMembership ? (
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

          <CircleStatRings detail={detail} weekCells={weekCells} />

          {removeTapInAction}
        </View>
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
  companionActionStack: {
    gap: 10,
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
    shadowOffset: {height: 6, width: 0},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    width: '100%',
  },
  nudgePanelFrame: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: '100%',
  },
  nudgePanelContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    width: '100%',
  },
  nudgeActionIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  nudgeCountBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    top: -5,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -5,
  },
  nudgeCountBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 11,
  },
  nudgeCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  nudgeMarkWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  nudgeSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
    opacity: 0.88,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
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
  threadPreviewBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  threadPreviewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  threadPreviewCard: {
    borderRadius: radius.md,
  },
  threadPreviewCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  threadPreviewFill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  threadPreviewIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  threadPreviewPressable: {
    borderRadius: radius.md,
  },
  threadPreviewSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
  },
  threadPreviewTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  threadPreviewTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  threadPreviewTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
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
});
