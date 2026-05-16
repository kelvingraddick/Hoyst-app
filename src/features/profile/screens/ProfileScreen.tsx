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
import {CommonActions} from '@react-navigation/native';
import {
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  LifeBuoy,
  LockKeyhole,
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
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {
  useSettingsStore,
  type AppearancePreference,
} from '../../../store/settings-store';
import {deleteAccount} from '../../auth/services/account-service';
import {signOutOfHoyst} from '../../auth/services/auth-service';
import {
  subscribeToNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '../../settings/services/notification-settings-service';
import {
  formatActiveCircleCountLabel,
  formatPersonalStreakLabel,
  getProfileAvatarSource,
  getProfileInitials,
  loggedOutProfileBenefits,
  loggedOutProfileStatLabels,
} from '../services/profile-display';
import {getProfileSummary} from '../services/profile-summary-service';

type Props = BottomTabScreenProps<AppTabsParamList, 'Profile'>;

const loggedOutBenefitIcons: LucideIcon[] = [
  UsersRound,
  ShieldCheck,
  UserRound,
];

type LoggedOutBenefitTone = 'green' | 'orange' | 'purple';

const loggedOutBenefitTones: LoggedOutBenefitTone[] = [
  'purple',
  'green',
  'orange',
];

const appearanceOptions: {
  detail: string;
  label: string;
  value: AppearancePreference;
}[] = [
  {
    detail: 'Always use Hoyst in dark mode.',
    label: 'Dark',
    value: 'dark',
  },
  {
    detail: 'Match your device appearance.',
    label: 'System',
    value: 'system',
  },
  {
    detail: 'Always use Hoyst in light mode.',
    label: 'Light',
    value: 'light',
  },
];

const appearanceLabels: Record<AppearancePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

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

function LoggedOutBenefitRow({
  Icon,
  detail,
  tone,
  title,
}: {
  Icon: LucideIcon;
  detail: string;
  tone: LoggedOutBenefitTone;
  title: string;
}) {
  const theme = useHoystTheme();
  const palette =
    tone === 'green'
      ? {
          backgroundColor: 'rgba(68,216,92,0.12)',
          borderColor: 'rgba(68,216,92,0.34)',
          color: theme.success,
        }
      : tone === 'orange'
      ? {
          backgroundColor: 'rgba(255,138,61,0.12)',
          borderColor: 'rgba(255,138,61,0.34)',
          color: theme.warning,
        }
      : {
          backgroundColor: 'rgba(139,92,246,0.13)',
          borderColor: 'rgba(139,92,246,0.36)',
          color: theme.accentSecondary,
        };

  return (
    <View style={styles.benefitRow}>
      <View
        style={[
          styles.benefitIcon,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
          },
        ]}>
        <Icon color={palette.color} size={18} strokeWidth={2.1} />
      </View>
      <View style={styles.benefitCopy}>
        <HoystText style={{color: palette.color}} variant="bodyStrong">
          {title}
        </HoystText>
        <HoystText tone="muted" variant="caption">
          {detail}
        </HoystText>
      </View>
    </View>
  );
}

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

function AppearancePreferenceModal({
  activeAppearance,
  onCancel,
  onSelect,
  visible,
}: {
  activeAppearance: AppearancePreference;
  onCancel: () => void;
  onSelect: (appearance: AppearancePreference) => void;
  visible: boolean;
}): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}>
      <View style={styles.modalOverlay}>
        <GlassPanel style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <MoonStar
              color={theme.accentSecondary}
              size={22}
              strokeWidth={2.3}
            />
            <HoystText variant="title">Appearance</HoystText>
          </View>
          <HoystText tone="muted">
            Choose how Hoyst should handle light and dark mode.
          </HoystText>
          <View style={styles.appearanceOptions}>
            {appearanceOptions.map(option => {
              const isSelected = option.value === activeAppearance;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={[
                    styles.appearanceOption,
                    {
                      backgroundColor: isSelected
                        ? `${theme.accentSecondary}1f`
                        : theme.surfaceSoft,
                      borderColor: isSelected
                        ? theme.accentSecondary
                        : theme.borderStrong,
                    },
                  ]}>
                  <View style={styles.appearanceOptionCopy}>
                    <HoystText variant="bodyStrong">{option.label}</HoystText>
                    <HoystText tone="muted" variant="caption">
                      {option.detail}
                    </HoystText>
                  </View>
                  <View
                    style={[
                      styles.appearanceCheck,
                      {
                        backgroundColor: isSelected
                          ? theme.accentSecondary
                          : theme.surfaceHigh,
                        borderColor: isSelected
                          ? theme.accentSecondary
                          : theme.borderStrong,
                      },
                    ]}>
                    {isSelected ? (
                      <Check
                        color={theme.background}
                        size={15}
                        strokeWidth={3}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <HoystButton label="Cancel" onPress={onCancel} variant="outline" />
        </GlassPanel>
      </View>
    </Modal>
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

export function ProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const setProfile = useUserProfileStore(state => state.setProfile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const appearance = useSettingsStore(state => state.appearance);
  const notifications = useSettingsStore(state => state.notifications);
  const setAppearancePreference = useSettingsStore(
    state => state.setAppearancePreference,
  );
  const setNotificationSettings = useSettingsStore(
    state => state.setNotificationSettings,
  );
  const setNotificationPreference = useSettingsStore(
    state => state.setNotificationPreference,
  );
  const resetSettings = useSettingsStore(state => state.reset);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
  const setGuest = useSessionStore(state => state.setGuest);
  const resetOnboarding = useOnboardingStore(state => state.reset);
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isAppearanceModalVisible, setIsAppearanceModalVisible] =
    useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const isReady = status === 'authenticatedReady' && Boolean(profile);
  const profileSummaryQuery = useQuery({
    enabled: isReady,
    queryFn: getProfileSummary,
    queryKey: ['profileSummary', profile?.id],
  });
  const openProfileAuth = () => {
    clearPendingAction();
    beginAuthFlow();
    startOnboardingWizard();
    rootNavigation?.navigate('Auth', {screen: 'Welcome'});
  };
  const openCompleteProfile = () => {
    rootNavigation?.navigate('Auth', {screen: 'CompleteProfile'});
  };
  const selectAppearancePreference = (nextAppearance: AppearancePreference) => {
    setAppearancePreference(nextAppearance);
    setIsAppearanceModalVisible(false);
  };
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

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    return subscribeToNotificationSettings({
      onSettings: setNotificationSettings,
      uid: user.uid,
    });
  }, [setNotificationSettings, user?.uid]);

  if (status === 'authenticatedIncompleteProfile') {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <GlassPanel>
          <View style={styles.sectionCopy}>
            <HoystText variant="title">Complete your profile</HoystText>
            <HoystText tone="muted">
              Choose your handle before your profile, settings, joins, and Tap
              Ins unlock.
            </HoystText>
          </View>
          <HoystButton label="Complete profile" onPress={openCompleteProfile} />
        </GlassPanel>
      </HoystScreen>
    );
  }

  if (!isReady || !profile) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <GlassPanel style={styles.loggedOutPanel}>
          <View style={styles.loggedOutHero}>
            <BrandMark
              isDark={theme.isDark}
              kind="logo"
              style={styles.loggedOutLogo}
            />
            <HoystText variant="title">
              Join circles and keep accountability visible.
            </HoystText>
            <HoystText tone="muted">
              Sign in to unlock joins, create circles, Tap In, and keep your
              circle history attached to your profile.
            </HoystText>
          </View>

          <View style={styles.lockedStats}>
            {loggedOutProfileStatLabels.map(label => (
              <View
                key={label}
                style={[
                  styles.lockedStat,
                  {
                    backgroundColor: theme.surfaceSoft,
                    borderColor: theme.border,
                  },
                ]}>
                <LockKeyhole
                  color={theme.textSubtle}
                  size={15}
                  strokeWidth={2.2}
                />
                <HoystText tone="muted" variant="caption">
                  {label}
                </HoystText>
              </View>
            ))}
          </View>

          <View style={styles.benefitStack}>
            {loggedOutProfileBenefits.map((benefit, index) => {
              const Icon = loggedOutBenefitIcons[index] ?? UsersRound;
              const tone = loggedOutBenefitTones[index] ?? 'purple';

              return (
                <LoggedOutBenefitRow
                  Icon={Icon}
                  detail={benefit.detail}
                  key={benefit.title}
                  tone={tone}
                  title={benefit.title}
                />
              );
            })}
          </View>

          <View style={styles.authActions}>
            <HoystButton label="Get started" onPress={openProfileAuth} />
            <HoystText tone="muted" variant="caption">
              Apple and Google appear first, with email and phone available
              after selection.
            </HoystText>
          </View>
        </GlassPanel>
      </HoystScreen>
    );
  }

  const initials = getProfileInitials(profile);
  const avatarSource = getProfileAvatarSource(profile, user?.photoURL);
  const profileSummary = profileSummaryQuery.data;
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
      rootNavigation?.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'MainTabs', params: {screen: 'Home'}}],
        }),
      );
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
    <HoystScreen
      contentContainerStyle={[styles.content, styles.loggedInContent]}>
      <GlassPanel style={styles.loggedInPanel}>
        <View style={styles.loggedInPanelGroup}>
          <View style={styles.profileHeader}>
            <LayeredAvatar
              initials={initials}
              imageSource={avatarSource}
              size={54}
              state="done"
            />
            <View style={styles.copy}>
              <HoystText>{profile.name}</HoystText>
              <HoystText tone="muted">@{profile.handle}</HoystText>
              {profile.bio ? (
                <HoystText numberOfLines={2} tone="muted" variant="caption">
                  {profile.bio}
                </HoystText>
              ) : null}
            </View>
          </View>
          {profileSummary ? (
            <View style={styles.chips}>
              <HoystChip
                label={formatPersonalStreakLabel(profileSummary)}
                tone="green"
              />
              <HoystChip
                label={formatActiveCircleCountLabel(
                  profileSummary.activeCircleCount,
                )}
                tone="purple"
              />
            </View>
          ) : null}
        </View>
      </GlassPanel>
      <View style={styles.settingsStack}>
        <SettingsSection title="Account">
          <SettingsRow
            detail="Update your name, handle, and bio."
            icon={UserRound}
            iconTone="blue"
            onPress={() => rootNavigation?.navigate('EditProfile')}
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
            detail="Choose dark, system, or light mode."
            icon={MoonStar}
            iconTone="neutral"
            onPress={() => setIsAppearanceModalVisible(true)}
            title="Appearance"
            trailing={
              <SettingsValue>{appearanceLabels[appearance]}</SettingsValue>
            }
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
      </View>
      <AppearancePreferenceModal
        activeAppearance={appearance}
        onCancel={() => setIsAppearanceModalVisible(false)}
        onSelect={selectAppearancePreference}
        visible={isAppearanceModalVisible}
      />
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
    paddingBottom: 168,
  },
  loggedInContent: {
    alignItems: 'stretch',
    width: '100%',
  },
  loggedInPanel: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
    width: '100%',
  },
  loggedInPanelGroup: {
    alignSelf: 'stretch',
    gap: 12,
    width: '100%',
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  authActions: {
    gap: 10,
    paddingTop: 8,
  },
  benefitCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  benefitIcon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  benefitStack: {
    gap: 14,
    marginVertical: 8,
  },
  lockedStat: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  lockedStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  loggedOutHero: {
    gap: 14,
  },
  loggedOutLogo: {
    alignSelf: 'flex-start',
    height: 58,
    width: 138,
  },
  loggedOutPanel: {
    gap: 22,
  },
  sectionCopy: {
    flex: 1,
    gap: 6,
  },
  settingsStack: {
    alignSelf: 'stretch',
    gap: 18,
    width: '100%',
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
  appearanceCheck: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flexShrink: 0,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  appearanceOption: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  appearanceOptionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  appearanceOptions: {
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
});
