import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Pencil,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {actionMotion} from '../../../design/tokens/actions';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import type {CircleDetailModel} from '../../../types/models';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {deleteCircle, leaveCircle} from '../services/circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleTools'>;
type SettingsIconTone =
  | 'blue'
  | 'danger'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple';
type SettingsRowProps = {
  detail?: string;
  disabled?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  iconTone?: SettingsIconTone;
  onPress?: () => void;
  title: string;
  titleColor?: string;
  trailing?: React.ReactNode;
  trailingKind?: 'accessory' | 'value';
};

function IconButton({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
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
        styles.iconButton,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: pressed ? actionMotion.pressedOpacity : 1,
          transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
        },
      ]}>
      <ArrowLeft color={theme.text} size={21} strokeWidth={2.3} />
    </Pressable>
  );
}

function getSettingsIconColor(
  theme: ReturnType<typeof useHoystTheme>,
  tone: SettingsIconTone,
) {
  if (tone === 'green') {
    return theme.successForeground;
  }

  if (tone === 'orange') {
    return theme.accentWarmForeground;
  }

  if (tone === 'danger') {
    return theme.dangerForeground;
  }

  if (tone === 'neutral') {
    return theme.textSubtle;
  }

  if (tone === 'purple') {
    return theme.accentSecondaryForeground;
  }

  return theme.accentTertiaryForeground;
}

function getSettingsIconBackgroundColor(
  theme: ReturnType<typeof useHoystTheme>,
  tone: SettingsIconTone,
  disabled: boolean,
) {
  if (disabled || tone === 'neutral') {
    return theme.surfaceHigh;
  }

  if (tone === 'green') {
    return 'rgba(68,216,92,0.14)';
  }

  if (tone === 'orange') {
    return 'rgba(255,138,61,0.14)';
  }

  if (tone === 'danger') {
    return 'rgba(255,110,132,0.14)';
  }

  if (tone === 'purple') {
    return 'rgba(139,92,246,0.16)';
  }

  return 'rgba(104,184,232,0.14)';
}

function SettingsRow({
  detail,
  disabled = false,
  icon: Icon,
  iconColor,
  iconTone = 'blue',
  onPress,
  title,
  titleColor,
  trailing,
  trailingKind = 'accessory',
}: SettingsRowProps): React.JSX.Element {
  const theme = useHoystTheme();
  const isInteractive = Boolean(onPress) && !disabled;
  const resolvedIconColor =
    iconColor ??
    (disabled ? theme.textSubtle : getSettingsIconColor(theme, iconTone));
  const iconBackgroundColor = getSettingsIconBackgroundColor(
    theme,
    iconTone,
    disabled,
  );
  const rowChildren = (
    <>
      <View style={[styles.rowIcon, {backgroundColor: iconBackgroundColor}]}>
        <Icon color={resolvedIconColor} size={18} strokeWidth={2.1} />
      </View>
      <View style={styles.rowContent}>
        <HoystText
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.rowTitle, titleColor ? {color: titleColor} : null]}>
          {title}
        </HoystText>
        {detail ? (
          <HoystText
            ellipsizeMode="tail"
            numberOfLines={2}
            style={styles.rowDetail}
            tone="muted"
            variant="caption">
            {detail}
          </HoystText>
        ) : null}
      </View>
      {trailing ? (
        <View
          style={[
            styles.rowTrailing,
            trailingKind === 'accessory'
              ? styles.rowTrailingAccessory
              : undefined,
          ]}>
          {trailing}
        </View>
      ) : null}
    </>
  );

  if (!isInteractive) {
    return (
      <GlassPanel padding="none" style={styles.rowCard}>
        <View style={[styles.row, disabled ? styles.rowDisabled : undefined]}>
          {rowChildren}
        </View>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel padding="none" style={styles.rowCard}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        onPress={onPress}
        style={({pressed}) => [
          styles.rowPressable,
          {
            opacity: pressed ? actionMotion.pressedOpacity : 1,
            transform: [{scale: pressed ? actionMotion.pressedScale : 1}],
          },
        ]}>
        <View style={styles.row}>{rowChildren}</View>
      </Pressable>
    </GlassPanel>
  );
}

function DeleteCircleConfirmModal({
  canConfirm,
  circleTitle,
  confirmText,
  isDeleting,
  isPersonal,
  onCancel,
  onConfirm,
  onConfirmTextChange,
  visible,
}: {
  canConfirm: boolean;
  circleTitle: string;
  confirmText: string;
  isDeleting: boolean;
  isPersonal: boolean;
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
                {isPersonal ? 'Delete commitment' : 'Delete circle'}
              </HoystText>
            </View>
            <View style={styles.modalCopy}>
              <HoystText tone="muted">
                {isPersonal
                  ? 'This permanently deletes the personal Commitment and its Tap In history.'
                  : 'This permanently deletes the circle, members, requests, and Tap In history.'}
              </HoystText>
              <HoystText variant="bodyStrong">{circleTitle}</HoystText>
              <HoystText tone="muted" variant="caption">
                Type the {isPersonal ? 'Commitment' : 'circle name'} to confirm.
              </HoystText>
            </View>
            <HoystInput
              accessibilityLabel={
                isPersonal ? 'Confirm Commitment' : 'Confirm circle name'
              }
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
                label={
                  isDeleting
                    ? 'Deleting...'
                    : isPersonal
                    ? 'Delete Commitment'
                    : 'Delete Circle'
                }
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

export function CircleToolsScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const [detail, setDetail] = useState<CircleDetailModel>();
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isDeletingCircle, setIsDeletingCircle] = useState(false);
  const [isLeavingCircle, setIsLeavingCircle] = useState(false);
  const isPendingMembership = detail?.viewerMembershipStatus === 'pending';
  const isPersonal = detail?.circleMode === 'personal';
  const canEditCircle = detail?.viewerRole === 'owner' && !isPendingMembership;
  const canLeaveCircle = Boolean(
    detail?.viewerRole && detail.viewerRole !== 'owner',
  );
  const hasSettings = canEditCircle || canLeaveCircle;
  const leaveActionLabel = isPendingMembership
    ? 'Cancel Request'
    : 'Leave Circle';
  const canConfirmDeleteCircle = detail
    ? deleteConfirmText.trim().toLowerCase() ===
      detail.title.trim().toLowerCase()
    : false;

  const navigateBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  }, [navigation]);

  const exitCircleFlow = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.popToTop();
      return;
    }

    navigation.replace('MainTabs', {screen: 'Home'});
  }, [navigation]);

  useEffect(() => {
    if (status !== 'authenticatedReady' || !user?.uid) {
      setDetail(undefined);
      setHasLoadedSettings(true);
      return undefined;
    }

    setHasLoadedSettings(false);
    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: nextDetail => {
        setDetail(nextDetail);
        setHasLoadedSettings(true);
      },
      onError: () => {
        setDetail(undefined);
        setHasLoadedSettings(true);
      },
      timezone,
      uid: user.uid,
    });
  }, [route.params.circleId, status, timezone, user?.uid]);

  const openDeleteCircleConfirm = () => {
    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(true);
  };

  const isLoadingSettings = !hasLoadedSettings;

  const closeDeleteCircleConfirm = () => {
    if (isDeletingCircle) {
      return;
    }

    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(false);
  };

  const handleDeleteCircle = async () => {
    if (!detail || !canConfirmDeleteCircle || isDeletingCircle) {
      return;
    }

    setIsDeletingCircle(true);
    try {
      await deleteCircle(detail.id);
      setIsDeleteConfirmVisible(false);
      setDeleteConfirmText('');
      exitCircleFlow();
      Alert.alert(
        isPersonal ? 'Commitment deleted' : 'Circle deleted',
        `${detail.title} has been deleted.`,
      );
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
    if (!detail || !canLeaveCircle || isLeavingCircle) {
      return;
    }

    setIsLeavingCircle(true);
    try {
      const result = await leaveCircle(detail.id);
      exitCircleFlow();
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
    if (!detail) {
      return;
    }

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

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.navBar}>
        <View style={styles.navSide}>
          <IconButton accessibilityLabel="Go back" onPress={navigateBack} />
        </View>
        <HoystText numberOfLines={1} style={styles.navTitle}>
          {isPersonal ? 'Commitment Settings' : 'Circle Settings'}
        </HoystText>
        <View style={styles.navSide} />
      </View>

      {isLoadingSettings ? (
        <GlassPanel padding="compact" style={styles.statusPanel}>
          <View style={styles.statusContent}>
            <HoystText variant="bodyStrong">
              Loading circle settings...
            </HoystText>
          </View>
        </GlassPanel>
      ) : hasSettings ? (
        <View style={styles.settingsStack}>
          {canEditCircle && detail ? (
            <>
              <SettingsRow
                detail={
                  isPersonal
                    ? 'Change the Commitment, rules, rhythm, timing, and skips.'
                    : 'Change the name, rules, access, timing, and capacity.'
                }
                icon={Pencil}
                iconTone="blue"
                onPress={() =>
                  navigation.navigate('EditCircle', {circleId: detail.id})
                }
                title={isPersonal ? 'Edit Commitment' : 'Edit Circle'}
                trailing={
                  <ChevronRight
                    color={theme.textSubtle}
                    size={18}
                    strokeWidth={2.2}
                  />
                }
              />
              {isPersonal ? (
                <SettingsRow
                  detail="Convert this into a Circle, then invite someone."
                  icon={UserPlus}
                  iconTone="purple"
                  onPress={() =>
                    navigation.navigate('ConvertPersonalCircle', {
                      circleId: detail.id,
                    })
                  }
                  title="Invite someone"
                  trailing={
                    <ChevronRight
                      color={theme.textSubtle}
                      size={18}
                      strokeWidth={2.2}
                    />
                  }
                />
              ) : null}
              <SettingsRow
                detail={`Permanently remove this ${
                  isPersonal ? 'Commitment' : 'circle'
                } and its history.`}
                icon={Trash2}
                iconColor={theme.dangerForeground}
                iconTone="danger"
                onPress={openDeleteCircleConfirm}
                title={isPersonal ? 'Delete Commitment' : 'Delete Circle'}
                titleColor={theme.dangerForeground}
              />
            </>
          ) : null}

          {canLeaveCircle ? (
            <SettingsRow
              detail={
                isPendingMembership
                  ? 'Cancel your pending join request.'
                  : 'Remove your membership and Tap In history.'
              }
              icon={LogOut}
              iconColor={theme.dangerForeground}
              iconTone="danger"
              onPress={isLeavingCircle ? undefined : confirmLeaveCircle}
              title={isLeavingCircle ? 'Working...' : leaveActionLabel}
              titleColor={theme.dangerForeground}
            />
          ) : null}
        </View>
      ) : (
        <GlassPanel padding="compact" style={styles.statusPanel}>
          <View style={styles.statusContent}>
            <HoystText variant="bodyStrong">No settings yet</HoystText>
            <HoystText tone="muted">
              No circle settings are available yet.
            </HoystText>
          </View>
        </GlassPanel>
      )}

      <DeleteCircleConfirmModal
        canConfirm={canConfirmDeleteCircle}
        circleTitle={detail?.title ?? ''}
        confirmText={deleteConfirmText}
        isDeleting={isDeletingCircle}
        isPersonal={isPersonal}
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
    paddingBottom: 60,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  navBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    width: '100%',
  },
  navSide: {
    flexShrink: 0,
    width: 48,
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
    textAlign: 'center',
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
    alignItems: 'center',
    backgroundColor: 'rgba(15,18,28,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalPanel: {
    gap: 16,
    maxWidth: 420,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 25,
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  rowPressable: {
    alignSelf: 'stretch',
    width: '100%',
  },
  rowCard: {
    alignSelf: 'stretch',
    width: '100%',
  },
  rowContent: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowDetail: {
    flexShrink: 1,
  },
  rowDisabled: {
    opacity: 0.62,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowTitle: {
    flexShrink: 1,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
    width: 24,
  },
  rowTrailingAccessory: {
    width: 24,
  },
  settingsStack: {
    alignSelf: 'stretch',
    gap: 12,
    width: '100%',
  },
  statusContent: {
    gap: 6,
  },
  statusPanel: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
