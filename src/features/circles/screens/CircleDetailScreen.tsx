import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Globe2,
  LogOut,
  Lock,
  Pencil,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Circle as SvgCircle, G, Path, Rect} from 'react-native-svg';

import {GradientRing} from '../../../design/components/GradientRing';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {NudgeMark} from '../../../design/components/NudgeMark';
import {
  CircleCategoryIcon,
  getCircleCategoryForegroundColor,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {SectionHeader} from '../../../design/components/SectionHeader';
import {TapInPulseButton} from '../../../design/components/TapInPulseButton';
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
type HoystChipTone = React.ComponentProps<typeof HoystChip>['tone'];
type DetailStatusPill = {
  label: string;
  tone: HoystChipTone;
};
type ToolTileTone = 'green' | 'purple' | 'blue' | 'orange';

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
  return count === 1 ? '1 Member to nudge' : `${count} Members to nudge`;
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

function CategoryTextPill({
  category,
  uppercase = false,
}: {
  category: string;
  uppercase?: boolean;
}) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category);
  const foregroundColor = getCircleCategoryForegroundColor(category, theme);
  const label = uppercase ? visual.label.toUpperCase() : visual.label;

  return (
    <View
      style={[
        styles.categoryTextPill,
        styles.identityPill,
        {
          backgroundColor:
            visual.tone === 'neutral'
              ? theme.surfaceHigh
              : `${visual.accentColor}22`,
        },
      ]}>
      <HoystText style={{color: foregroundColor}} variant="tiny">
        {label}
      </HoystText>
    </View>
  );
}

function CircleDetailArtworkIcon({
  color,
  kind,
  size = 30,
}: {
  color: string;
  kind:
    | 'completion'
    | 'flame'
    | 'goals'
    | 'leaderboard'
    | 'members'
    | 'settings';
  size?: number;
}) {
  if (kind === 'members') {
    return (
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        <G>
          <SvgCircle cx="25" cy="23" fill={`${color}55`} r="8" />
          <SvgCircle cx="25" cy="23" fill={color} r="6.5" />
          <SvgCircle cx="42" cy="25" fill={`${color}44`} r="7" />
          <SvgCircle cx="42" cy="25" fill={color} r="5.7" />
          <SvgCircle cx="14" cy="28" fill={`${color}40`} r="6" />
          <SvgCircle cx="14" cy="28" fill={color} r="4.8" />
          <Path
            d="M10 49 C11.6 39.4 17.5 34.5 25 34.5 C32.5 34.5 38.4 39.4 40 49 Z"
            fill={color}
          />
          <Path
            d="M34 49 C35.1 41.2 39.6 37.1 45 37.1 C50.7 37.1 55.2 41.4 56.5 49 Z"
            fill={`${color}C8`}
          />
          <Path
            d="M4.5 49 C5.7 42.3 9.5 38.7 14.2 38.7 C18.7 38.7 22.5 42.4 23.4 49 Z"
            fill={`${color}B8`}
          />
        </G>
      </Svg>
    );
  }

  if (kind === 'leaderboard') {
    return (
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        <G>
          <Rect
            fill={`${color}80`}
            height="20"
            rx="3"
            width="11"
            x="10"
            y="34"
          />
          <Rect fill={color} height="31" rx="3" width="11" x="27" y="23" />
          <Rect
            fill={`${color}C8`}
            height="42"
            rx="3"
            width="11"
            x="44"
            y="12"
          />
          <Path
            d="M10 54 H55"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="4"
          />
          <Path
            d="M31 28 H35 M48 17 H52 M14 39 H18"
            stroke="rgba(255,255,255,0.72)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </G>
      </Svg>
    );
  }

  if (kind === 'goals') {
    return (
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        <G fill="none" stroke={color} strokeLinecap="round">
          <SvgCircle cx="30" cy="34" r="20" strokeWidth="5" />
          <SvgCircle cx="30" cy="34" r="12" strokeWidth="4" />
          <SvgCircle cx="30" cy="34" fill={color} r="4" strokeWidth="0" />
          <Path d="M42 22 L52 12" strokeWidth="5" />
          <Path
            d="M51 12 L54 22 L44 19"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <Path d="M42 22 L30 34" strokeWidth="4" />
        </G>
      </Svg>
    );
  }

  if (kind === 'settings') {
    return (
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        <G fill={color}>
          <Path d="M36 8 L39 15.4 C41.1 16 43 16.8 44.7 18 L52 15 L57 24 L50.8 28.7 C51 29.8 51.1 30.9 51.1 32 C51.1 33.1 51 34.2 50.8 35.3 L57 40 L52 49 L44.7 46 C43 47.2 41.1 48 39 48.6 L36 56 H26 L23 48.6 C20.9 48 19 47.2 17.3 46 L10 49 L5 40 L11.2 35.3 C11 34.2 10.9 33.1 10.9 32 C10.9 30.9 11 29.8 11.2 28.7 L5 24 L10 15 L17.3 18 C19 16.8 20.9 16 23 15.4 L26 8 Z" />
          <SvgCircle cx="31" cy="32" fill="rgba(255,255,255,0.86)" r="11" />
          <SvgCircle cx="31" cy="32" fill={color} r="6" />
        </G>
      </Svg>
    );
  }

  if (kind === 'flame') {
    return (
      <Svg height={size} viewBox="0 0 64 64" width={size}>
        <Path
          d="M31 56 C19 54 12 45.5 13.5 34.5 C14.5 26.5 19.5 20 25 15 C25 22 29 25 32 28 C36 22 36.5 15 34.5 8 C46 15 53 25.5 53 38 C53 48.5 44.5 56 31 56 Z"
          fill={`${color}D8`}
        />
        <Path
          d="M32 55 C25 53.5 21.5 48.5 22 42 C22.4 36.5 26 32.5 30 29 C30 34 33.2 36 35.5 39 C37.7 35.8 38.2 31.5 37.2 27.5 C43.5 32.5 47 38.2 46.5 44.5 C46 51.2 40.5 55 32 55 Z"
          fill="rgba(255,255,255,0.78)"
        />
        <Path
          d="M32 55 C27.8 53.6 26 50 27 46 C27.8 42.9 30.1 40.5 32.5 38.5 C32.4 42 35.5 44 37 47 C39.5 44 39.8 41 39.2 38 C43 41.3 44.6 45.3 43.4 49.3 C41.9 53.6 37.8 55.6 32 55 Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg height={size} viewBox="0 0 64 64" width={size}>
      <G fill="none" stroke={color} strokeLinecap="round" strokeWidth="6">
        <Path d="M18 34 A16 16 0 1 0 26 18" />
        <Path d="M17 19 L25.5 18 L24.5 26.5" strokeLinejoin="round" />
      </G>
      <SvgCircle cx="32" cy="34" fill={`${color}18`} r="13" />
    </Svg>
  );
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

function DailyTaskCard({
  category,
  commitment,
  title,
}: {
  category: string;
  commitment: string;
  title: string;
}) {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category);
  const foregroundColor = getCircleCategoryForegroundColor(category, theme);
  const accentBackgroundColor =
    visual.tone === 'neutral' ? theme.surfaceHigh : `${visual.accentColor}18`;

  return (
    <GlassPanel padding="none" style={styles.dailyTaskCard}>
      <View style={styles.dailyTaskCardContent}>
        <View
          style={[
            styles.dailyTaskIcon,
            {backgroundColor: accentBackgroundColor},
          ]}>
          <ClipboardCheck color={foregroundColor} size={25} strokeWidth={2.2} />
        </View>
        <View style={styles.dailyTaskCopy}>
          <HoystText numberOfLines={2} style={styles.dailyTaskPrimary}>
            {commitment}
          </HoystText>
          <HoystText numberOfLines={1} tone="muted" variant="caption">
            {title}
          </HoystText>
        </View>
      </View>
    </GlassPanel>
  );
}

function TapInReferenceAction({
  label,
  onPress,
  ringState,
  supportingText,
}: {
  label: string;
  onPress: () => void;
  ringState: React.ComponentProps<typeof TapInPulseButton>['ringState'];
  supportingText: string;
}) {
  return (
    <TapInPulseButton
      label={label}
      onPress={() => onPress()}
      ringState={ringState}
      supportingText={supportingText}
      variant="reference"
    />
  );
}

function getProgressSectionSubtitle(detail: CircleDetailModel) {
  if (detail.commitmentCadence === 'monthly') {
    return 'Progress this month';
  }

  if (detail.commitmentCadence === 'weekly') {
    return 'Progress this week';
  }

  return 'Progress today';
}

function getMemberStatusLabel(member: CircleMemberStatus) {
  if (member.membershipStatus === 'pending') {
    return 'Pending';
  }

  if (member.state === 'done') {
    return 'Done';
  }

  if (member.state === 'skipped') {
    return 'Skipped';
  }

  if (member.state === 'pending') {
    return 'Needed';
  }

  return 'Missed';
}

function getMemberProgressConfig(
  member: CircleMemberStatus,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (member.membershipStatus === 'pending') {
    return {
      progress: 0.34,
      ringColor: theme.accentSecondaryForeground,
      trackColor: `${theme.accentSecondary}12`,
    };
  }

  if (member.state === 'done') {
    return {
      progress: 1,
      ringColor: theme.successForeground,
      trackColor: `${theme.success}14`,
    };
  }

  if (member.state === 'skipped') {
    return {
      progress: 1,
      ringColor: theme.warningForeground,
      trackColor: `${theme.warning}14`,
    };
  }

  if (member.state === 'pending') {
    return {
      progress: 0.34,
      ringColor: theme.warningForeground,
      trackColor: `${theme.warning}12`,
    };
  }

  return {
    progress: 0.08,
    ringColor: theme.dangerForeground,
    trackColor: theme.ring,
  };
}

function ProgressStatusBadge({member}: {member: CircleMemberStatus}) {
  const theme = useHoystTheme();

  if (member.state === 'done' && member.membershipStatus !== 'pending') {
    return (
      <View
        style={[
          styles.companionStatusBadge,
          {
            backgroundColor: theme.successForeground,
            borderColor: theme.surfaceStrong,
          },
        ]}>
        <Check color={theme.surfaceStrong} size={12} strokeWidth={3} />
      </View>
    );
  }

  const color =
    member.membershipStatus === 'pending'
      ? theme.accentSecondaryForeground
      : member.state === 'skipped'
      ? theme.warningForeground
      : member.state === 'missed'
      ? theme.dangerForeground
      : theme.warningForeground;

  return (
    <View
      style={[
        styles.companionStatusBadge,
        styles.companionStatusBadgeOpen,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: color,
        },
      ]}
    />
  );
}

function CompanionProgressScroller({
  members,
  subtitle,
}: {
  members: CircleMemberStatus[];
  subtitle: string;
}) {
  const theme = useHoystTheme();

  return (
    <View style={styles.companionSection}>
      <View style={styles.progressSectionHeader}>
        <HoystText variant="subtitle">Companions</HoystText>
        <HoystText
          numberOfLines={1}
          style={styles.progressSectionSubtitle}
          tone="muted"
          variant="caption">
          {subtitle}
        </HoystText>
      </View>
      {members.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.companionScrollContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.companionScroll}>
          {members.map(member => {
            const label = getMemberStatusLabel(member);
            const progress = getMemberProgressConfig(member, theme);
            return (
              <View key={member.id} style={styles.companionItem}>
                <View style={styles.companionRingWrap}>
                  <GradientRing
                    flatColor={progress.ringColor}
                    progress={progress.progress}
                    size={80}
                    strokeWidth={6}
                    trackColor={progress.trackColor}
                  />
                  <View style={styles.companionAvatarWrap}>
                    <LayeredAvatar
                      imageSource={member.avatarImage}
                      imageUrl={member.avatarUrl}
                      initials={member.initials}
                      size={64}
                      state={member.state}
                    />
                  </View>
                  <ProgressStatusBadge member={member} />
                </View>
                <HoystText
                  numberOfLines={1}
                  style={styles.companionName}
                  variant="caption">
                  {member.name}
                </HoystText>
                <HoystText style={{color: progress.ringColor}} variant="tiny">
                  {label}
                </HoystText>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <HoystText tone="muted">
          Companions will appear here once people join this Circle.
        </HoystText>
      )}
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
            backgroundColor: theme.backgroundElevated,
            borderColor: theme.isDark
              ? theme.borderStrong
              : 'rgba(16,24,40,0.18)',
          },
        ]}>
        <View style={styles.nudgePanelContent}>
          <View
            style={[
              styles.nudgeMarkWrap,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(122,85,255,0.18)'
                  : 'rgba(90,28,255,0.10)',
              },
            ]}>
            <NudgeMark color={foregroundColor} size={23} strokeWidth={5} />
            <View
              style={[
                styles.nudgeCountBadge,
                {
                  backgroundColor: foregroundColor,
                  borderColor: theme.backgroundElevated,
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
                  ? 'rgba(122,85,255,0.18)'
                  : 'rgba(90,28,255,0.10)',
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
  const content = (
    <View
      style={[
        styles.memberToolTileInner,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}>
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
          style={[styles.memberToolSubtitle, {color: theme.textMuted}]}>
          {subtitle}
        </HoystText>
      </View>
    </View>
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
      <HoystText variant="subtitle">
        {isOwner ? 'Circle Tools' : 'Member Tools'}
      </HoystText>
      <View style={styles.memberToolsGrid}>
        <MemberToolTile
          icon={
            <CircleDetailArtworkIcon
              color={theme.successForeground}
              kind="members"
              size={25}
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
              size={25}
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
              size={25}
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
              size={25}
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

function StatsMetric({
  accentColor,
  caption,
  icon,
  label,
  value,
}: {
  accentColor: string;
  caption: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statsMetric}>
      <View
        style={[styles.statsMetricIcon, {backgroundColor: `${accentColor}16`}]}>
        {icon}
      </View>
      <View style={styles.statsMetricCopy}>
        <HoystText numberOfLines={1} style={styles.statsMetricValue}>
          {value}
        </HoystText>
        <HoystText numberOfLines={1} style={styles.statsMetricLabel}>
          {label}
        </HoystText>
        <HoystText
          numberOfLines={1}
          style={styles.statsMetricCaption}
          tone="muted">
          {caption}
        </HoystText>
      </View>
    </View>
  );
}

function getStatsPeriodLabel(detail: CircleDetailModel) {
  if (detail.commitmentCadence === 'monthly') {
    return 'This month';
  }

  if (detail.commitmentCadence === 'weekly') {
    return 'This week';
  }

  return 'Today';
}

function CircleStatsCard({detail}: {detail: CircleDetailModel}) {
  const theme = useHoystTheme();
  const progress = Math.max(0, Math.min(100, detail.completionRate));
  const streakValue =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const activeStreakCount = Number.isFinite(streakValue) ? streakValue : 0;
  const periodLabel = getStatsPeriodLabel(detail);

  return (
    <View style={styles.statsSection}>
      <View style={styles.statsTitleRow}>
        <HoystText variant="subtitle">Stats</HoystText>
        <HoystText
          style={[styles.statsSeeAll, {color: theme.successForeground}]}>
          See all
        </HoystText>
      </View>
      <GlassPanel padding="none">
        <View style={styles.statsCard}>
          <StatsMetric
            accentColor={theme.success}
            caption={periodLabel}
            icon={
              <CircleDetailArtworkIcon
                color={theme.successForeground}
                kind="completion"
                size={27}
              />
            }
            label="Completion Rate"
            value={`${progress}%`}
          />
          <View
            style={[styles.statsDivider, {backgroundColor: theme.borderStrong}]}
          />
          <StatsMetric
            accentColor={theme.warning}
            caption="Active"
            icon={
              <CircleDetailArtworkIcon
                color={theme.warningForeground}
                kind="flame"
                size={27}
              />
            }
            label="Streaks"
            value={String(activeStreakCount)}
          />
          <View
            style={[styles.statsDivider, {backgroundColor: theme.borderStrong}]}
          />
          <StatsMetric
            accentColor={theme.accentSecondary}
            caption="Active"
            icon={
              <CircleDetailArtworkIcon
                color={theme.accentSecondaryForeground}
                kind="members"
                size={27}
              />
            }
            label="Members"
            value={`${detail.memberCount}/${detail.maxSize}`}
          />
        </View>
      </GlassPanel>
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
  const pendingJoinRequests = useMemo(
    () =>
      detail?.members.filter(member => member.membershipStatus === 'pending') ??
      [],
    [detail?.members],
  );
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
  const showFlameIcon = Number.isFinite(streakValue) && streakValue > 7;
  const isAlreadyTappedInLabel = detail.streakLabel === 'Already tapped in';
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
  const tapInSupportingText = canRemoveTodayCheckIn
    ? "Review today's Tap In"
    : detail.commitmentCadence === 'monthly'
    ? 'Log your progress this month'
    : detail.commitmentCadence === 'weekly'
    ? 'Log your progress this week'
    : 'Log your progress for today';

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

  const handleSendNudge = () => {
    if (isNudging) {
      return;
    }

    setIsNudging(true);
    nudgeCircleMembers(detail.id)
      .then(result => {
        setNudged(true);
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

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.screenStack}>
        <View style={styles.topBar}>
          <View
            style={[
              styles.topBarSlot,
              canInvite ? styles.topBarSideWide : undefined,
            ]}>
            <TopBarButton accessibilityLabel="Go back" onPress={navigateBack}>
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
            </TopBarButton>
          </View>
          <View style={styles.topTitleCluster}>
            <View
              style={styles.topTitleIcon}
              testID="circle-detail-title-category-icon">
              <CircleCategoryIcon
                category={detail.category}
                size={canInvite ? 30 : 34}
              />
            </View>
            <HoystText
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              numberOfLines={1}
              style={styles.topTitle}>
              {detail.title}
            </HoystText>
          </View>
          <View
            style={[
              styles.topActions,
              canInvite ? styles.topBarSideWide : undefined,
            ]}>
            <TopBarButton accessibilityLabel="Open Inbox" onPress={openInbox}>
              <Bell color={theme.textMuted} size={20} strokeWidth={2.2} />
            </TopBarButton>
            {canInvite ? (
              <TopBarButton
                accessibilityLabel="Invite members"
                onPress={shareInvite}>
                <UserPlus color={theme.textMuted} size={17} strokeWidth={2.2} />
              </TopBarButton>
            ) : null}
          </View>
        </View>

        <View style={styles.identitySection}>
          <View style={styles.identityPillRow}>
            <CategoryTextPill category={detail.category} uppercase />
            {detailStatusPill ? (
              <HoystChip
                label={detailStatusPill.label}
                style={styles.identityPill}
                tone={detailStatusPill.tone}
              />
            ) : null}
            <View
              style={[
                styles.streakChip,
                styles.identityPill,
                {
                  backgroundColor: `${theme.success}18`,
                  borderColor: `${theme.successForeground}22`,
                },
              ]}>
              {isAlreadyTappedInLabel ? (
                <Check
                  color={theme.successForeground}
                  size={14}
                  strokeWidth={2.6}
                />
              ) : (
                <Flame
                  color={
                    showFlameIcon
                      ? theme.warningForeground
                      : theme.successForeground
                  }
                  size={14}
                  strokeWidth={2.4}
                />
              )}
              <HoystText
                style={{
                  color: showFlameIcon
                    ? theme.warningForeground
                    : theme.successForeground,
                }}
                variant="caption">
                {detail.streakLabel}
              </HoystText>
            </View>
          </View>
          {!detailStatusPill ? (
            <HoystText style={styles.previewCopy} tone="muted">
              {previewCopy}
            </HoystText>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <UsersRound
                color={theme.textSubtle}
                size={15}
                strokeWidth={2.1}
              />
              <HoystText tone="muted" variant="caption">
                {detail.memberCount}/{detail.maxSize} members
              </HoystText>
            </View>
            <View
              style={[
                styles.managementDot,
                {backgroundColor: theme.borderStrong},
              ]}
            />
            <View style={styles.metaItem}>
              {detail.privacy === 'private' ? (
                <Lock color={theme.textSubtle} size={14} strokeWidth={2.1} />
              ) : (
                <Globe2 color={theme.textSubtle} size={14} strokeWidth={2.1} />
              )}
              <HoystText tone="muted" variant="caption">
                {privacyLabel}
              </HoystText>
            </View>
            <View
              style={[
                styles.managementDot,
                {backgroundColor: theme.borderStrong},
              ]}
            />
            <HoystText tone="muted" variant="caption">
              {roleOrJoinLabel}
            </HoystText>
          </View>
          <DailyTaskCard
            category={detail.category}
            commitment={detail.commitment}
            title={commitmentPrefix}
          />
        </View>

        <CompanionProgressScroller
          members={detail.members}
          subtitle={getProgressSectionSubtitle(detail)}
        />

        <View style={styles.actionSection}>
          {isMemberCircle ? (
            <>
              <TapInReferenceAction
                label={tapInPrimaryActionLabel}
                onPress={() =>
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
                  )
                }
                ringState={tapInPulseRingState}
                supportingText={tapInSupportingText}
              />
              {canRemoveTodayCheckIn ? (
                <DashboardUtilityAction
                  icon={
                    <Trash2
                      color={theme.dangerForeground}
                      size={17}
                      strokeWidth={2.2}
                    />
                  }
                  labelColor={theme.dangerForeground}
                  label={isRemovingTapIn ? 'Removing...' : removeActionLabel}
                  onPress={
                    isRemovingTapIn ? undefined : confirmRemoveTodayCheckIn
                  }
                  showChevron={false}
                  supportingText="Undo today"
                />
              ) : null}
              {canNudgeTargets ? (
                <NudgePanel
                  isNudging={isNudging}
                  nudged={nudged}
                  onPress={handleSendNudge}
                  targetCopy={nudgeTargetCopy}
                  targetCount={nudgeTargetCount}
                />
              ) : null}
              {canDeleteCircle ? (
                <View style={styles.circleToolsGroup}>
                  <MemberToolsTiles
                    isExpanded={isOwnerToolsExpanded}
                    isOwner
                    onToggleManage={() =>
                      setIsOwnerToolsExpanded(currentValue => !currentValue)
                    }
                  />
                  {isOwnerToolsExpanded ? (
                    <View style={styles.ownerToolsActions}>
                      {pendingJoinRequests.length > 0 ? (
                        <View style={styles.joinRequestStack}>
                          {pendingJoinRequests.map(member => (
                            <View
                              key={member.id}
                              style={[
                                styles.joinRequestRow,
                                {
                                  backgroundColor: theme.surfaceSoft,
                                  borderColor: theme.borderStrong,
                                },
                              ]}>
                              <View style={styles.joinRequestCopy}>
                                <HoystText variant="bodyStrong">
                                  {member.name}
                                </HoystText>
                                <HoystText tone="muted" variant="caption">
                                  Wants to join
                                </HoystText>
                              </View>
                              <View style={styles.joinRequestActions}>
                                <HoystButton
                                  disabled={reviewingRequestId === member.id}
                                  label="Decline"
                                  onPress={() => {
                                    handleReviewJoinRequest(
                                      member.id,
                                      false,
                                    ).catch(() => undefined);
                                  }}
                                  style={styles.joinRequestButton}
                                  variant="outline"
                                />
                                <HoystButton
                                  disabled={reviewingRequestId === member.id}
                                  label="Approve"
                                  onPress={() => {
                                    handleReviewJoinRequest(
                                      member.id,
                                      true,
                                    ).catch(() => undefined);
                                  }}
                                  style={styles.joinRequestButton}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <DashboardUtilityAction
                        icon={
                          <Pencil
                            color={theme.text}
                            size={17}
                            strokeWidth={2.2}
                          />
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
              ) : canLeaveCircle ? (
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
                        label={
                          isLeavingCircle ? 'Working...' : leaveActionLabel
                        }
                        labelColor={theme.dangerForeground}
                        onPress={
                          isLeavingCircle ? undefined : confirmLeaveCircle
                        }
                        showChevron={false}
                        supportingText={leaveActionSupportingText}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : isPendingMembership && canLeaveCircle ? (
            <>
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
            </>
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
          )}
        </View>

        <CircleStatsCard detail={detail} />
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
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 148,
  },
  screenStack: {
    gap: 16,
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
  topActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    width: 52,
  },
  topBarSideWide: {
    width: 96,
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
  topTitleCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: 0,
  },
  topTitleIcon: {
    flexShrink: 0,
  },
  categoryTextPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  identitySection: {
    alignItems: 'center',
    gap: 12,
  },
  identityPill: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    minHeight: 34,
    paddingVertical: 0,
  },
  identityPillRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  previewCopy: {
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  streakChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 13,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  managementDot: {
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  dailyTaskCard: {
    alignSelf: 'stretch',
    minHeight: 82,
  },
  dailyTaskCardContent: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dailyTaskCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  dailyTaskPrimary: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  dailyTaskIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  companionSection: {
    alignItems: 'stretch',
    gap: 14,
  },
  progressSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressSectionSubtitle: {
    flexShrink: 1,
    textAlign: 'right',
  },
  companionScroll: {
    alignSelf: 'stretch',
    marginHorizontal: -4,
  },
  companionScrollContent: {
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  companionStatusBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2.5,
    bottom: 4,
    height: 23,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    width: 23,
  },
  companionStatusBadgeOpen: {
    borderWidth: 2.5,
  },
  companionItem: {
    alignItems: 'center',
    gap: 4,
    width: 92,
  },
  companionRingWrap: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 86,
    justifyContent: 'center',
    position: 'relative',
    width: 86,
  },
  companionAvatarWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  companionName: {
    maxWidth: 94,
    textAlign: 'center',
  },
  actionSection: {
    gap: 14,
  },
  tapInReferenceAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    elevation: 4,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowOffset: {height: 12, width: 0},
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  tapInReferenceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  tapInReferenceContent: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  tapInReferenceRing: {
    flexShrink: 0,
  },
  tapInReferenceTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 24,
  },
  nudgePanel: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    elevation: 3,
    overflow: 'hidden',
    shadowOffset: {height: 8, width: 0},
    shadowOpacity: 0.07,
    shadowRadius: 16,
    width: '100%',
  },
  nudgePanelFrame: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '100%',
  },
  nudgePanelContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 48,
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
    borderWidth: 1.5,
    bottom: 0,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
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
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
  },
  nudgeSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 16,
    opacity: 0.76,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 19,
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
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
    borderRadius: radius.md,
    width: '48.8%',
    minWidth: 0,
  },
  memberToolPressable: {
    width: '100%',
  },
  memberToolTileInner: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: 8,
    minHeight: 78,
    paddingHorizontal: 10,
    paddingVertical: 11,
    shadowOffset: {height: 7, width: 0},
    shadowOpacity: 0.08,
    shadowRadius: 14,
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
  joinRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  joinRequestButton: {
    flex: 1,
  },
  joinRequestCopy: {
    flex: 1,
    gap: 2,
  },
  joinRequestRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  joinRequestStack: {
    gap: 8,
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
  dashboardActionLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dashboardUtilityLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  publicActionStack: {
    gap: 10,
  },
  statsSection: {
    gap: 12,
  },
  statsCard: {
    alignItems: 'stretch',
    gap: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  statsMetric: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    minWidth: 0,
    paddingVertical: 7,
  },
  statsMetricCopy: {
    flex: 1,
    minWidth: 0,
  },
  statsMetricIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  statsMetricLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
  statsMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  statsMetricCaption: {
    fontSize: 12,
    lineHeight: 16,
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
