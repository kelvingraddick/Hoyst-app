import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
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
  ChevronRight,
  Crown,
  Globe2,
  Lock,
  Settings2,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {CircleMemberGrid} from '../../../design/components/CircleMemberGrid';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
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
import {
  ScreenHeroHeader,
  HeroIconButton,
} from '../../../design/components/ScreenHeroHeader';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {SectionHeader} from '../../../design/components/SectionHeader';
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
import {CircleThreadSection} from '../components/CircleThreadSection';
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
import type {
  CircleDetailModel,
  CircleMemberStatus,
  CircleSummary,
  CircleThreadItem,
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
    return {label: 'Pending', tone: 'purple'};
  }

  if (!detail.viewerRole) {
    return undefined;
  }

  if (detail.viewerTodayStatus === 'skip') {
    return {label: 'Skipped', tone: 'orange'};
  }

  if (detail.viewerTodayStatus === 'failed') {
    return {label: 'Goal not met', tone: 'orange'};
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
  return count === 1 ? '1 Member to nudge' : `${count} Members to nudge`;
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

function getMemberCycleLabel() {
  return 'this Cycle';
}

function getMemberProgressSubtitle(detail: CircleDetailModel) {
  const activeMembers = detail.members.filter(
    member => member.membershipStatus !== 'pending',
  );
  const doneCount = activeMembers.filter(
    member => member.state === 'done',
  ).length;

  return `${doneCount} of ${activeMembers.length} ${getMemberCycleLabel()}`;
}

function clampProgressPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function CircleStatsSection({
  detail,
  progressColor,
  progressPercent,
  weekCells,
}: {
  detail: CircleDetailModel;
  progressColor: string;
  progressPercent: number;
  weekCells: React.ComponentProps<typeof WeekProgressStrip>['days'];
}) {
  const theme = useHoystTheme();
  const normalizedProgressPercent = clampProgressPercent(progressPercent);
  const streakSource =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const streakValue = Number.isFinite(streakSource)
    ? Math.max(0, Math.round(streakSource))
    : 0;
  const streakDayLabel = streakValue === 1 ? 'day' : 'days';
  const isPersonal = detail.circleMode === 'personal';

  return (
    <View style={styles.statRingsSection}>
      <View style={styles.statsTitleRow}>
        <SectionEyebrow>Stats</SectionEyebrow>
        <View
          accessibilityLabel={`Streak ${streakValue} ${streakDayLabel}`}
          style={[
            styles.statsStreakPill,
            {
              backgroundColor: theme.glassSurfaceStrong,
              borderColor: theme.glassChipBorder,
            },
          ]}
          testID="circle-stats-streak-pill">
          <MomentumFlameIllustration
            size={16}
            testID="circle-stats-streak-icon"
          />
          <HoystText
            allowFontScaling={false}
            style={[
              styles.statsStreakPillLabel,
              {color: theme.warningForeground},
            ]}
            testID="circle-stats-streak-label">
            {`${streakValue} ${streakDayLabel}`}
          </HoystText>
        </View>
      </View>
      <View style={styles.statsProgressBlock} testID="circle-stats-progress">
        <View style={styles.statsProgressLabelRow}>
          <HoystText tone="muted" variant="caption">
            {isPersonal ? 'Personal Progress' : 'Circle Progress'}
          </HoystText>
          <HoystText
            style={{color: progressColor}}
            testID="circle-stats-progress-value"
            variant="bodyStrong">
            {normalizedProgressPercent}%
          </HoystText>
        </View>
        <View
          style={[
            styles.statsProgressTrack,
            {backgroundColor: theme.surfaceMuted},
          ]}>
          <View
            style={[
              styles.statsProgressFill,
              {
                backgroundColor: progressColor,
                width: `${Math.max(normalizedProgressPercent, 2)}%`,
              },
            ]}
            testID="circle-stats-progress-fill"
          />
        </View>
      </View>
      <GlassPanel padding="compact" style={styles.statsWeekCard}>
        <WeekProgressStrip
          days={weekCells}
          showStreak={false}
          title="LAST 7 DAYS"
        />
      </GlassPanel>
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
  const [isThreadVisible, setIsThreadVisible] = useState(false);
  const [threadLoadMoreRequestToken, setThreadLoadMoreRequestToken] =
    useState(0);
  const bodyOffsetYRef = useRef<number | undefined>(undefined);
  const threadOffsetYRef = useRef<number | undefined>(undefined);
  const wasNearThreadEndRef = useRef(false);
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
  const detail = useMemo(
    () =>
      memberCircle ??
      (publicCircle ? buildPublicCircleDetail(publicCircle) : undefined) ??
      getCircleDetail(route.params.circleId),
    [memberCircle, publicCircle, route.params.circleId],
  );
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
      scrollMetricsRef.current = {
        contentHeight: contentSize.height,
        offsetY: contentOffset.y,
        viewportHeight: layoutMeasurement.height,
      };
      updateThreadScrollState();
    },
    [updateThreadScrollState],
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
    setIsThreadVisible(false);
    setThreadLoadMoreRequestToken(0);
    bodyOffsetYRef.current = undefined;
    threadOffsetYRef.current = undefined;
    wasNearThreadEndRef.current = false;
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
  const isPersonal = detail.circleMode === 'personal';
  const isArchived = detail.lifecycleStatus === 'archived';
  const canInvite =
    !isArchived &&
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
    ? 'View Today'
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
  const commitmentPrefix =
    detail.commitmentCadence === 'monthly'
      ? 'Monthly Pace'
      : detail.commitmentCadence === 'weekly'
      ? 'Weekly Pace'
      : 'Daily Pace';
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
    : 'Log Progress for this Cycle';
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

  const circleProgressPercent =
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

  const shareFeedTapIn = (item: CircleThreadItem) => {
    navigation.navigate('TapInStoryShare', {
      circleId: detail.id,
      circleTitle: detail.title,
      commitment: detail.commitment,
      inviteUrl: detail.inviteUrl,
      memberCount: detail.memberCount,
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
  const memberFooterAction =
    isMemberCircle && !isPersonal && !isArchived && canNudgeTargets ? (
      <View
        style={styles.memberActionStack}
        testID="circle-detail-member-actions">
        <NudgePanel
          isNudging={isNudging}
          nudged={nudged}
          onPress={handleSendNudge}
          targetCopy={nudgeTargetCopy}
          targetCount={nudgeTargetCount}
        />
      </View>
    ) : undefined;

  return (
    <HoystScreen
      background={<FrostedBackdrop topAccentColor={categoryBackdropAccent} />}
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
            isMemberCircle && !isArchived ? (
              <TapInReferenceAction
                label={tapInPrimaryActionLabel}
                onPress={openTapInComposer}
                ringState={tapInPulseRingState}
                supportingText={tapInSupportingText}
                variant="hero"
              />
            ) : undefined
          }
          subtitle={detailStatusPill ? undefined : previewCopy}
          title={detail.title}
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
            progressPercent={circleProgressPercent}
            weekCells={weekCells}
          />

          {!isPersonal ? (
            <CircleMemberGrid
              canTapInViewer={
                !isArchived && isMemberCircle && !canRemoveTodayCheckIn
              }
              footerAction={memberFooterAction}
              inviteAction={
                !isArchived && canInvite
                  ? {
                      accessibilityLabel: 'Invite Members',
                      onPress: shareInvite,
                    }
                  : undefined
              }
              members={detail.members}
              nudgedMemberIds={nudgedMemberIds}
              nudgingMemberIds={nudgingMemberIds}
              onNudgeMember={
                isMemberCircle && !isArchived
                  ? handleSendMemberNudge
                  : undefined
              }
              onReviewPendingMember={
                canReviewJoinRequests ? openReviewJoinRequestSheet : undefined
              }
              onTapInViewer={isArchived ? undefined : openTapInComposer}
              reviewingPendingMemberId={reviewingRequestId}
              subtitle={getMemberProgressSubtitle(detail)}
              tapInRingState={tapInPulseRingState}
              viewerUid={user?.uid}
            />
          ) : null}

          {!isArchived && !isMemberCircle ? (
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
              viewerUid={user.uid}
            />
          ) : null}
        </View>
      </View>
    </HoystScreen>
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
  detailStack: {},
  bodyStack: {
    gap: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  memberActionStack: {
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
  statRingsSection: {
    gap: 14,
  },
  statsWeekCard: {
    gap: 0,
  },
  statsProgressBlock: {
    gap: 8,
  },
  statsProgressFill: {
    borderRadius: radius.pill,
    height: 10,
  },
  statsProgressLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsProgressTrack: {
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  statsStreakPill: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 11,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  statsStreakPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
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
