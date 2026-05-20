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
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Globe2,
  Lock,
  Pencil,
  Send,
  Settings2,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {StatusAvatarRow} from '../../../design/components/StatusAvatarRow';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {actionMotion, actionShadow} from '../../../design/tokens/actions';
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
  pokeCircleMembers,
  reviewJoinRequest,
} from '../services/circle-service';
import {subscribeToPublicCircle} from '../services/public-circle-service';
import {
  buildPublicCircleDetail,
  subscribeToMemberCircleDetail,
} from '../../home/services/home-data-service';
import type {CircleDetailModel, CircleSummary} from '../../../types/models';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleDetail'>;
type HoystChipTone = React.ComponentProps<typeof HoystChip>['tone'];
type DetailStatusPill = {
  label: string;
  tone: HoystChipTone;
};

function getCategoryTone(category: string): HoystChipTone {
  if (category === 'Fitness') {
    return 'green';
  }

  if (category === 'Deep Work') {
    return 'orange';
  }

  if (category === 'Sobriety') {
    return 'purple';
  }

  return 'neutral';
}

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

  if (!detail.viewerHasCheckedIn) {
    return {label: 'Needs You', tone: 'orange'};
  }

  if (detail.remainingCheckIns && detail.remainingCheckIns > 0) {
    return {label: 'Pending', tone: 'purple'};
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

function formatNeedsTapInCount(count: number) {
  return count === 1 ? '1 needs Tap In' : `${count} need Tap In`;
}

function TopBarButton({
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

function DashboardQuickAction({
  emphasized,
  icon,
  label,
  onPress,
  supportingText,
}: {
  emphasized?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  supportingText: string;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.dashboardQuickPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <View
        style={[
          styles.dashboardQuickFill,
          {
            backgroundColor: emphasized
              ? `${theme.accent}22`
              : theme.surfaceHigh,
            borderColor: emphasized
              ? `${theme.accentForeground}77`
              : theme.borderStrong,
          },
        ]}>
        <View style={styles.dashboardQuickIcon}>{icon}</View>
        <View style={styles.dashboardActionCopy}>
          <HoystText
            numberOfLines={1}
            style={styles.dashboardActionLabel}
            variant="button">
            {label}
          </HoystText>
          <HoystText numberOfLines={1} tone="muted" variant="caption">
            {supportingText}
          </HoystText>
        </View>
      </View>
    </Pressable>
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

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.dashboardUtilityPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
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
    </Pressable>
  );
}

function TapInPrimaryAction({onPress}: {onPress: () => void}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.tapInPressable,
        {
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <View
        style={[
          styles.tapInFill,
          {
            backgroundColor: theme.actionSurface,
            borderColor: theme.actionBorder,
            shadowColor: theme.actionShadowColor,
            shadowOpacity: theme.actionShadowOpacity,
          },
        ]}>
        <View style={styles.tapInIconWrap}>
          <TapInRingMark innerSize={22} outerSize={40} />
        </View>
        <HoystText
          style={[styles.tapInLabel, {color: theme.actionForeground}]}
          variant="button">
          Tap In
        </HoystText>
      </View>
    </Pressable>
  );
}

function DetailProgressPanel({
  completionLabel,
  days,
}: {
  completionLabel: string;
  days: CircleDetailModel['monthProgress'];
}) {
  const theme = useHoystTheme();

  return (
    <GlassPanel style={styles.progressPanel}>
      <View style={styles.progressHeader}>
        <HoystText style={styles.progressTitle} tone="muted" variant="label">
          Last 7 Days
        </HoystText>
        <HoystText style={styles.progressPercent} variant="bodyStrong">
          {completionLabel}
        </HoystText>
      </View>
      <View style={styles.progressGrid}>
        {days.slice(0, 7).map(day => {
          const isDone = day.state === 'done';
          const isMissed = day.state === 'missed';
          const isToday = day.state === 'today';
          const progressCellStateStyle = isDone
            ? {
                backgroundColor: `${theme.success}14`,
                borderColor: `${theme.successForeground}55`,
              }
            : isMissed
            ? {
                backgroundColor: `${theme.danger}14`,
                borderColor: `${theme.dangerForeground}55`,
              }
            : isToday
            ? {
                backgroundColor: `${theme.accentSecondary}16`,
                borderColor: `${theme.accentSecondaryForeground}80`,
                borderStyle: 'dashed' as const,
              }
            : undefined;
          const progressCellThemeStyle = progressCellStateStyle
            ? undefined
            : {backgroundColor: theme.surfaceStrong, borderColor: theme.border};

          return (
            <View
              key={day.day}
              style={[
                styles.progressCell,
                progressCellStateStyle,
                progressCellThemeStyle,
              ]}>
              <HoystText
                style={{
                  color: isDone
                    ? theme.successForeground
                    : isMissed
                    ? theme.dangerForeground
                    : isToday
                    ? theme.accentSecondaryForeground
                    : theme.textMuted,
                }}
                variant="bodyStrong">
                {String(day.day).padStart(2, '0')}
              </HoystText>
            </View>
          );
        })}
      </View>
    </GlassPanel>
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
                style={{color: theme.dangerForeground}}
                variant="title">
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
  const returnTab = route.params.source === 'notification' ? 'Inbox' : 'Home';
  const navigateBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: returnTab});
  }, [navigation, returnTab]);
  const [poked, setPoked] = useState(false);
  const [isPoking, setIsPoking] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string>();
  const [joinRequested, setJoinRequested] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isRemovingTapIn, setIsRemovingTapIn] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingCircle, setIsDeletingCircle] = useState(false);
  const [isOwnerToolsExpanded, setIsOwnerToolsExpanded] = useState(false);
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
  const needsTapInMembers = useMemo(
    () =>
      detail?.members.filter(
        member =>
          member.state === 'pending' && member.membershipStatus !== 'pending',
      ) ?? [],
    [detail?.members],
  );
  const pendingJoinRequests = useMemo(
    () =>
      detail?.members.filter(member => member.membershipStatus === 'pending') ??
      [],
    [detail?.members],
  );
  const missedMembers =
    detail?.members.filter(member => member.state === 'missed') ?? [];

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
          <View style={styles.brandRow}>
            <TopBarButton onPress={navigateBack}>
              <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
            </TopBarButton>
            <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
          </View>
        </View>
        <GlassPanel>
          <View style={styles.heroCopy}>
            <HoystText variant="title">Circle unavailable</HoystText>
            <HoystText tone="muted">
              This circle was not found, or your account does not have access to
              it yet.
            </HoystText>
          </View>
        </GlassPanel>
      </HoystScreen>
    );
  }

  const isPendingMembership = detail.viewerMembershipStatus === 'pending';
  const isMemberCircle = Boolean(detail.viewerRole) && !isPendingMembership;
  const canInvite =
    Boolean(detail.inviteUrl) &&
    (detail.viewerRole === 'owner' || detail.viewerRole === 'admin');
  const progressTone =
    detail.completionRate >= 85
      ? theme.successForeground
      : detail.completionRate >= 70
      ? theme.accentSecondaryForeground
      : detail.completionRate >= 50
      ? theme.warningForeground
      : theme.dangerForeground;
  const statusLabel =
    detail.state === 'done' ? 'Done' : `${detail.completionRate}%`;
  const detailStatusPill = getDetailStatusPill(detail);
  const needsTapInCopy = formatNeedsTapInCount(needsTapInMembers.length);
  const previewCopy =
    detail.matchCopy ?? 'Preview the circle before you jump in.';
  const streakValue =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const showFlameIcon = Number.isFinite(streakValue) && streakValue > 7;
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
  const canDeleteCircle = isMemberCircle && detail.viewerRole === 'owner';
  const canConfirmDeleteCircle =
    deleteConfirmText.trim().toLowerCase() ===
    detail.title.trim().toLowerCase();
  const removeActionLabel =
    detail.viewerTodayStatus === 'skip' ? 'Remove Skip' : 'Remove Tap In';

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
    Alert.alert(
      'Remove today?',
      "This will undo today's progress for this circle.",
      [
        {style: 'cancel', text: 'Keep'},
        {
          onPress: () => {
            handleRemoveTodayCheckIn().catch(() => undefined);
          },
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
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
          ? 'They can Tap In with the circle now.'
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
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <TopBarButton onPress={navigateBack}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
          </TopBarButton>
          <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        </View>
        <View style={styles.topActions}>
          <TopBarButton>
            <Bell color={theme.textMuted} size={20} strokeWidth={2.2} />
          </TopBarButton>
          {isMemberCircle ? (
            <TopBarButton onPress={canInvite ? shareInvite : undefined}>
              <UserPlus color={theme.textMuted} size={17} strokeWidth={2.2} />
            </TopBarButton>
          ) : null}
        </View>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroHeader}>
          <View style={styles.headerTags}>
            <HoystChip
              label={detail.category.toUpperCase()}
              tone={getCategoryTone(detail.category)}
            />
            <View style={styles.streakRow}>
              {showFlameIcon ? (
                <Flame
                  color={theme.warningForeground}
                  size={15}
                  strokeWidth={2.4}
                />
              ) : null}
              <HoystText
                style={{
                  color: showFlameIcon
                    ? theme.warningForeground
                    : theme.successForeground,
                }}
                variant="bodyStrong">
                {detail.streakLabel}
              </HoystText>
            </View>
          </View>
          <View
            style={[
              styles.progressBadge,
              {
                backgroundColor: `${progressTone}12`,
                borderColor: `${progressTone}66`,
              },
            ]}>
            {detail.state === 'done' ? (
              <Check color={progressTone} size={12} strokeWidth={2.6} />
            ) : detail.state === 'risk' ? (
              <Clock3 color={progressTone} size={12} strokeWidth={2.4} />
            ) : null}
            <HoystText style={{color: progressTone}} variant="caption">
              {statusLabel}
            </HoystText>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <HoystText style={styles.heroTitle}>{detail.title}</HoystText>
          <HoystText tone="muted">{detail.dailyGoal}</HoystText>
          {detailStatusPill ? (
            <HoystChip
              label={detailStatusPill.label}
              tone={detailStatusPill.tone}
            />
          ) : (
            <HoystText tone="muted" variant="caption">
              {previewCopy}
            </HoystText>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <UsersRound color={theme.textSubtle} size={15} strokeWidth={2.1} />
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
            {isMemberCircle ? getRoleLabel(detail) : getJoinModeLabel(detail)}
          </HoystText>
        </View>

        <View style={styles.memberStatusBlock}>
          <View style={styles.sectionHeader}>
            <HoystText tone="muted" variant="label">
              Member Status
            </HoystText>
            <HoystText tone="muted" variant="caption">
              {detail.members.length} total
            </HoystText>
          </View>
          <StatusAvatarRow members={detail.members} />
        </View>
      </View>

      <GlassPanel style={styles.actionPanel}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Action Dashboard
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {isMemberCircle
              ? `${needsTapInCopy}, ${missedMembers.length} missed`
              : isPendingMembership
              ? 'Pending approval'
              : getJoinModeLabel(detail)}
          </HoystText>
        </View>

        {isMemberCircle ? (
          <View style={styles.dashboardGrid}>
            <View style={styles.primaryActionWrap}>
              <TapInPrimaryAction
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
              />
            </View>
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
            <View style={styles.quickActionRow}>
              <DashboardQuickAction
                emphasized={needsTapInMembers.length > 0 && !poked}
                icon={
                  <BellRing
                    color={
                      poked
                        ? theme.successForeground
                        : needsTapInMembers.length > 0
                        ? theme.accentSecondaryForeground
                        : theme.text
                    }
                    size={18}
                    strokeWidth={2.2}
                  />
                }
                label={
                  isPoking
                    ? 'Poking...'
                    : poked
                    ? 'Poked'
                    : `Poke ${needsTapInMembers.length || 'All'}`
                }
                onPress={() => {
                  if (isPoking) {
                    return;
                  }

                  setIsPoking(true);
                  pokeCircleMembers(detail.id)
                    .then(result => {
                      setPoked(true);
                      Alert.alert(
                        'Poke sent',
                        result.poked > 0
                          ? `${result.poked} member${
                              result.poked === 1 ? '' : 's'
                            } nudged.`
                          : 'Everyone is already covered today.',
                      );
                    })
                    .catch(error => {
                      Alert.alert(
                        'Poke failed',
                        (error as {message?: string}).message ??
                          'Could not send a poke.',
                      );
                    })
                    .finally(() => setIsPoking(false));
                }}
                supportingText={
                  needsTapInMembers.length > 0 ? needsTapInCopy : 'Warm nudge'
                }
              />
              {canInvite ? (
                <DashboardQuickAction
                  icon={<Send color={theme.text} size={17} strokeWidth={2.2} />}
                  label="Invite"
                  onPress={shareInvite}
                  supportingText="Share link"
                />
              ) : (
                <DashboardQuickAction
                  icon={
                    <UserPlus color={theme.text} size={17} strokeWidth={2.2} />
                  }
                  label="Members"
                  supportingText="See who is in"
                />
              )}
            </View>
            {canDeleteCircle ? (
              <View style={styles.circleToolsGroup}>
                <HoystText
                  style={styles.circleToolsHeader}
                  tone="muted"
                  variant="label">
                  Circle tools
                </HoystText>
                <DashboardUtilityAction
                  icon={
                    <Settings2
                      color={
                        isOwnerToolsExpanded
                          ? theme.accentSecondaryForeground
                          : theme.text
                      }
                      size={16}
                      strokeWidth={2.2}
                    />
                  }
                  label={isOwnerToolsExpanded ? 'Hide tools' : 'Manage'}
                  onPress={() =>
                    setIsOwnerToolsExpanded(currentValue => !currentValue)
                  }
                  supportingText="Owner settings"
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
            ) : (
              <DashboardUtilityAction
                icon={
                  <Settings2 color={theme.text} size={16} strokeWidth={2.2} />
                }
                label="Manage"
                supportingText={
                  detail.viewerRole === 'member'
                    ? 'Member settings'
                    : 'Circle tools'
                }
              />
            )}
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
        )}
      </GlassPanel>

      <DetailProgressPanel
        completionLabel={`${detail.completionRate}%`}
        days={detail.monthProgress}
      />

      <View style={styles.activitySection}>
        <View style={styles.sectionHeader}>
          <HoystText tone="muted" variant="label">
            Recent Activity
          </HoystText>
          <HoystText tone="muted" variant="caption">
            {detail.activity.length} updates
          </HoystText>
        </View>
        {detail.activity.map(item => (
          <ActivityFeedCard item={item} key={item.id} />
        ))}
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
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topBarButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 8,
  },
  logo: {
    height: 20,
    width: 48,
  },
  heroSection: {
    gap: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTags: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingRight: 10,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  progressBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: 10,
  },
  heroCopy: {
    gap: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  memberStatusBlock: {
    gap: 12,
  },
  actionPanel: {
    minHeight: 170,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dashboardGrid: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  circleToolsGroup: {
    gap: 8,
  },
  circleToolsHeader: {
    paddingHorizontal: 2,
  },
  ownerToolsActions: {
    gap: 8,
    paddingLeft: 12,
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
  primaryActionWrap: {
    marginBottom: 2,
  },
  quickActionRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    minWidth: '100%',
    width: '100%',
  },
  tapInPressable: {
    borderRadius: radius.md,
    width: '100%',
  },
  tapInFill: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    elevation: actionShadow.elevation,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 24,
    shadowOffset: actionShadow.offset,
    shadowRadius: actionShadow.compactRadius,
    width: '100%',
  },
  tapInIconWrap: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  tapInLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  dashboardQuickPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  dashboardQuickFill: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 86,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  dashboardQuickIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  dashboardUtilityPressable: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    width: '100%',
  },
  dashboardUtilityFill: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  activitySection: {
    gap: 12,
  },
});
