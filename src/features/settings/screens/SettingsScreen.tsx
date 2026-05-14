import React, {useEffect, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  BellRing,
  ChevronRight,
  Clock3,
  FileText,
  LifeBuoy,
  LogOut,
  Megaphone,
  MoonStar,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import type {LucideIcon} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getSettingsFallbackRoute} from '../../../navigation/settings-fallback-route';
import type {RootStackParamList} from '../../../navigation/types';
import {deleteAccount} from '../../auth/services/account-service';
import {signOutOfHoyst} from '../../auth/services/auth-service';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {
  getProfileAvatarSource,
  getProfileInitials,
} from '../../profile/services/profile-display';
import {
  subscribeToNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '../services/notification-settings-service';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type SectionProps = {
  children: React.ReactNode;
  title: string;
};

type SettingsRowProps = {
  detail?: string;
  disabled?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  iconTone?: SettingsIconTone;
  onPress?: () => void;
  title: string;
  trailing?: React.ReactNode;
  trailingKind?: 'accessory' | 'switch' | 'value';
};

type SettingsIconTone =
  | 'blue'
  | 'danger'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple';

function getSettingsIconColor(
  theme: ReturnType<typeof useHoystTheme>,
  tone: SettingsIconTone,
) {
  if (tone === 'green') {
    return theme.success;
  }

  if (tone === 'orange') {
    return theme.accentWarm;
  }

  if (tone === 'danger') {
    return theme.danger;
  }

  if (tone === 'neutral') {
    return theme.textSubtle;
  }

  if (tone === 'purple') {
    return theme.accentSecondary;
  }

  return theme.accentTertiary;
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

function HeaderButton({
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
      style={[
        styles.headerButton,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
        },
      ]}>
      {children}
    </Pressable>
  );
}

function SettingsSection({children, title}: SectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <HoystText tone="muted" variant="label">
        {title}
      </HoystText>
      <View style={styles.sectionGroup}>{children}</View>
    </View>
  );
}

function SettingsRow({
  detail,
  disabled = false,
  icon: Icon,
  iconColor,
  iconTone = 'blue',
  onPress,
  title,
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
  const rowStyle = [styles.row, disabled ? styles.rowDisabled : undefined];
  const rowChildren = (
    <>
      <View style={[styles.rowIcon, {backgroundColor: iconBackgroundColor}]}>
        <Icon color={resolvedIconColor} size={18} strokeWidth={2.1} />
      </View>
      <View style={styles.rowContent}>
        <HoystText
          ellipsizeMode="tail"
          numberOfLines={1}
          style={styles.rowTitle}>
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
      <GlassPanel style={styles.rowCard}>
        <View style={rowStyle}>{rowChildren}</View>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel style={styles.rowCard}>
      <Pressable onPress={onPress} style={rowStyle}>
        {rowChildren}
      </Pressable>
    </GlassPanel>
  );
}

function SettingsValue({children}: {children: string}): React.JSX.Element {
  return (
    <HoystText
      ellipsizeMode="tail"
      numberOfLines={1}
      style={styles.rowTrailingText}
      tone="muted"
      variant="caption">
      {children}
    </HoystText>
  );
}

function SettingsSwitch({
  onValueChange,
  value,
}: {
  onValueChange: (value: boolean) => void;
  value: boolean;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Switch
      ios_backgroundColor={theme.borderStrong}
      onValueChange={onValueChange}
      trackColor={{
        false: theme.borderStrong,
        true: theme.success,
      }}
      thumbColor={theme.backgroundElevated}
      value={value}
    />
  );
}

function AccountSummaryRow({
  bio,
  handle,
  imageSource,
  initials,
  name,
}: {
  bio?: string;
  handle: string;
  imageSource: React.ComponentProps<typeof LayeredAvatar>['imageSource'];
  initials: string;
  name: string;
}): React.JSX.Element {
  return (
    <GlassPanel style={styles.rowCard}>
      <View style={styles.summaryRow}>
        <LayeredAvatar
          imageSource={imageSource}
          initials={initials}
          size={54}
          state="done"
        />
        <View style={styles.summaryCopy}>
          <HoystText>{name}</HoystText>
          <HoystText tone="muted">@{handle}</HoystText>
          {bio ? (
            <HoystText numberOfLines={2} tone="muted" variant="caption">
              {bio}
            </HoystText>
          ) : null}
        </View>
      </View>
    </GlassPanel>
  );
}

function DeleteAccountConfirmModal({
  canConfirm,
  confirmText,
  handle,
  isDeleting,
  onCancel,
  onConfirm,
  onConfirmTextChange,
  visible,
}: {
  canConfirm: boolean;
  confirmText: string;
  handle: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmTextChange: (value: string) => void;
  visible: boolean;
}): React.JSX.Element {
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
              <Trash2 color={theme.danger} size={22} strokeWidth={2.3} />
              <HoystText style={{color: theme.danger}} variant="title">
                Delete account
              </HoystText>
            </View>
            <View style={styles.modalCopy}>
              <HoystText tone="muted">
                This permanently deletes your account, owned circles, circle
                memberships, Tap In history, photos, and profile data.
              </HoystText>
              <HoystText variant="bodyStrong">@{handle}</HoystText>
              <HoystText tone="muted" variant="caption">
                Type your handle to confirm.
              </HoystText>
            </View>
            <HoystInput
              accessibilityLabel="Confirm account handle"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isDeleting}
              onChangeText={onConfirmTextChange}
              placeholder={handle}
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
                borderColor={`${theme.danger}66`}
                disabled={!canConfirm || isDeleting}
                icon={
                  <Trash2 color={theme.danger} size={18} strokeWidth={2.3} />
                }
                label={isDeleting ? 'Deleting...' : 'Delete account'}
                onPress={onConfirm}
                textColor={theme.danger}
                variant="outline"
              />
            </View>
          </GlassPanel>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SettingsScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const setProfile = useUserProfileStore(state => state.setProfile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const notifications = useSettingsStore(state => state.notifications);
  const setNotificationSettings = useSettingsStore(
    state => state.setNotificationSettings,
  );
  const setNotificationPreference = useSettingsStore(
    state => state.setNotificationPreference,
  );
  const resetSettings = useSettingsStore(state => state.reset);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const resetOnboarding = useOnboardingStore(state => state.reset);
  const setGuest = useSessionStore(state => state.setGuest);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const isReady = status === 'authenticatedReady' && Boolean(profile);
  const leaveSettings = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    const fallbackRoute = getSettingsFallbackRoute(
      navigation.getState().routeNames,
    );

    if (fallbackRoute === 'MainTabs') {
      navigation.navigate('MainTabs', {screen: 'Home'});
      return;
    }

    if (fallbackRoute === 'Auth') {
      navigation.navigate('Auth', {screen: 'Welcome'});
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    return subscribeToNotificationSettings({
      onSettings: setNotificationSettings,
      uid: user.uid,
    });
  }, [setNotificationSettings, user?.uid]);

  const setServerNotificationPreference = (
    key: keyof NotificationSettings,
    value: boolean,
  ) => {
    const previousValue = notifications[key];

    setNotificationPreference(key, value);
    updateNotificationSettings({[key]: value}).catch(() => {
      setNotificationPreference(key, previousValue);
      Alert.alert('Could not update notifications', 'Try again in a moment.');
    });
  };

  if (!isReady || !profile) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <HeaderButton onPress={leaveSettings}>
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
          </HeaderButton>
          <HoystText variant="headline">Settings</HoystText>
        </View>
        <GlassPanel>
          <HoystText variant="title">Account required</HoystText>
          <HoystText tone="muted">
            Sign in and choose a handle before managing profile and account
            settings.
          </HoystText>
          <HoystButton
            label="Get started"
            onPress={() => {
              clearPendingAction();
              beginAuthFlow();
              resetOnboarding();
              navigation.navigate('Auth', {screen: 'Welcome'});
            }}
          />
        </GlassPanel>
      </HoystScreen>
    );
  }

  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);
  const canConfirmDeleteAccount =
    deleteConfirmText.trim().toLowerCase() ===
    profile.handle.trim().toLowerCase();

  const openDeleteAccountConfirm = () => {
    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(true);
  };

  const closeDeleteAccountConfirm = () => {
    if (isDeletingAccount) {
      return;
    }

    setDeleteConfirmText('');
    setIsDeleteConfirmVisible(false);
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDeleteAccount || isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setIsDeleteConfirmVisible(false);
      setDeleteConfirmText('');
      clearPendingAction();
      resetOnboarding();
      resetSettings();
      setProfile(undefined);
      await signOutOfHoyst().catch(() => undefined);
      setGuest();
      Alert.alert('Account deleted', 'Your Hoyst account has been deleted.');
    } catch (error) {
      const message =
        (error as {message?: string}).message ??
        'Could not delete your account. Try again.';
      Alert.alert('Delete failed', message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <HeaderButton onPress={leaveSettings}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </HeaderButton>
        <HoystText variant="headline">Settings</HoystText>
      </View>

      <SettingsSection title="Account">
        <AccountSummaryRow
          bio={profile.bio}
          handle={profile.handle}
          imageSource={avatarSource}
          initials={initials}
          name={profile.name}
        />
        <SettingsRow
          detail="Update your name, handle, and bio."
          icon={UserRound}
          iconTone="blue"
          onPress={() => navigation.navigate('EditProfile')}
          title="Edit profile"
          trailing={
            <ChevronRight
              color={theme.textSubtle}
              size={18}
              strokeWidth={2.2}
            />
          }
        />
        <SettingsRow
          detail={profile.timezone}
          icon={Clock3}
          iconTone="orange"
          title="Timezone"
          trailing={<SettingsValue>Local</SettingsValue>}
          trailingKind="value"
        />
        <SettingsRow
          detail="Exit the Hoyst shell and return to auth."
          icon={LogOut}
          iconColor={theme.danger}
          iconTone="danger"
          onPress={() => {
            signOutOfHoyst()
              .finally(setGuest)
              .catch(() => undefined);
          }}
          title="Sign out"
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          detail="Daily nudge to keep your streak moving."
          icon={Bell}
          iconTone="orange"
          title="Tap In reminders"
          trailing={
            <SettingsSwitch
              onValueChange={value =>
                setServerNotificationPreference('tapInReminders', value)
              }
              value={notifications.tapInReminders}
            />
          }
          trailingKind="switch"
        />
        <SettingsRow
          detail="Circle activity, nudges, and group updates."
          icon={UsersRound}
          iconTone="green"
          title="Circle activity"
          trailing={
            <SettingsSwitch
              onValueChange={value =>
                setServerNotificationPreference('circleActivity', value)
              }
              value={notifications.circleActivity}
            />
          }
          trailingKind="switch"
        />
        <SettingsRow
          detail="Product news and major app announcements."
          icon={Megaphone}
          iconTone="blue"
          title="Product updates"
          trailing={
            <SettingsSwitch
              onValueChange={value =>
                setServerNotificationPreference('productUpdates', value)
              }
              value={notifications.productUpdates}
            />
          }
          trailingKind="switch"
        />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={BellRing}
          iconTone="orange"
          title="Reminder time"
          trailing={<SettingsValue>8:00 AM</SettingsValue>}
          trailingKind="value"
        />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={Shield}
          iconTone="green"
          title="Push permissions"
          trailing={<SettingsValue>System</SettingsValue>}
          trailingKind="value"
        />
      </SettingsSection>

      <SettingsSection title="App">
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={MoonStar}
          iconTone="neutral"
          title="Appearance"
          trailing={<SettingsValue>System</SettingsValue>}
          trailingKind="value"
        />
        <SettingsRow
          detail="Build information"
          icon={Smartphone}
          iconTone="blue"
          title="App version"
          trailing={<SettingsValue>0.0.1</SettingsValue>}
          trailingKind="value"
        />
      </SettingsSection>

      <SettingsSection title="Support & Legal">
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={LifeBuoy}
          iconTone="blue"
          title="Help"
          trailing={
            <ChevronRight
              color={theme.textSubtle}
              size={18}
              strokeWidth={2.2}
            />
          }
        />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={ShieldCheck}
          iconTone="green"
          title="Privacy Policy"
          trailing={
            <ChevronRight
              color={theme.textSubtle}
              size={18}
              strokeWidth={2.2}
            />
          }
        />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={FileText}
          iconTone="neutral"
          title="Terms"
          trailing={
            <ChevronRight
              color={theme.textSubtle}
              size={18}
              strokeWidth={2.2}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsRow
          detail="Permanently delete your account, circles, history, and uploads."
          icon={Trash2}
          iconColor={theme.danger}
          iconTone="danger"
          onPress={openDeleteAccountConfirm}
          title="Delete account"
        />
      </SettingsSection>

      <DeleteAccountConfirmModal
        canConfirm={canConfirmDeleteAccount}
        confirmText={deleteConfirmText}
        handle={profile.handle}
        isDeleting={isDeletingAccount}
        onCancel={closeDeleteAccountConfirm}
        onConfirm={() => {
          handleDeleteAccount().catch(() => undefined);
        }}
        onConfirmTextChange={setDeleteConfirmText}
        visible={isDeleteConfirmVisible}
      />
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
    paddingBottom: 180,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  section: {
    alignSelf: 'stretch',
    gap: 10,
    width: '100%',
  },
  sectionGroup: {
    alignSelf: 'stretch',
    gap: 12,
    width: '100%',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  summaryCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowCard: {
    alignSelf: 'stretch',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: 46,
    width: '100%',
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
  rowContent: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowTitle: {
    flexShrink: 1,
  },
  rowDetail: {
    flexShrink: 1,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
    width: 86,
  },
  rowTrailingAccessory: {
    width: 24,
  },
  rowTrailingText: {
    maxWidth: '100%',
    textAlign: 'right',
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
});
