import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {usePreventRemove} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {
  Archive,
  Bell,
  BellRing,
  Check,
  Compass,
  Globe,
  Info,
  LifeBuoy,
  LogOut,
  Megaphone,
  MoonStar,
  Shield,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import {
  DSButton,
  DSInput,
  DSListRow,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {
  useSettingsStore,
  type AppearancePreference,
} from '../../../store/settings-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {
  deleteAccount,
  updateProfileFields,
} from '../../auth/services/account-service';
import {signOutOfHoyst} from '../../auth/services/auth-service';
import {normalizeHandle} from '../../auth/services/profile-validation';
import {TimezonePicker} from '../../auth/components/TimezonePicker';
import {requestPushNotificationPermission} from '../../../lib/notifications';
import {
  subscribeToNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '../services/notification-settings-service';
import {getInstalledAppInfo} from '../services/app-info';
import {ProfileAvatar} from '../../profile/components/ProfileAvatar';
import {
  ProfileIcon,
  ProfileScaffold,
  ProfileTheme,
} from '../../profile/components/ProfileScaffold';
import {useProfilePreview} from '../../profile/components/ProfilePreviewContext';

type Route =
  | 'Settings'
  | 'AccountSettings'
  | 'NotificationSettings'
  | 'AppearanceSettings'
  | 'AboutHoyst';
type Props<R extends Route> = NativeStackScreenProps<RootStackParamList, R>;
function Boundary({children}: {children: ReactNode}) {
  return <ProfileTheme>{children}</ProfileTheme>;
}
function useIdentity() {
  const stored = useUserProfileStore(state => state.profile);
  const preview = useProfilePreview();
  const uid = useSessionStore(state => state.user?.uid);
  return preview ? preview.profile : stored?.id === uid ? stored : undefined;
}
function Group({title, children}: {title: string; children: ReactNode}) {
  return (
    <View style={styles.group}>
      <DSText variant="heading" accessibilityRole="header">
        {title}
      </DSText>
      <DSSurface style={styles.groupSurface}>{children}</DSSurface>
    </View>
  );
}
export function SettingsScreen(props: Props<'Settings'>) {
  return (
    <Boundary>
      <SettingsContent {...props} />
    </Boundary>
  );
}
function SettingsContent({navigation}: Props<'Settings'>) {
  const profile = useIdentity();
  const preview = useProfilePreview();
  const appearance = useSettingsStore(state => state.appearance);
  const info = getInstalledAppInfo();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    if (preview) {
      Alert.alert(
        'Read-only preview',
        'No account changes are made in this preview.',
      );
      return;
    }
    Alert.alert(
      'Sign out?',
      'Your saved progress will be here when you sign back in.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            const signingOutUid = useSessionStore.getState().user?.uid;
            setSigningOut(true);
            signOutOfHoyst()
              .then(() => {
                const activeUid = useSessionStore.getState().user?.uid;
                if (activeUid && activeUid !== signingOutUid) return;
                useUserProfileStore.getState().setProfile(undefined);
                useSessionStore.getState().setGuest();
              })
              .catch(reason => {
                setSigningOut(false);
                Alert.alert(
                  'Could not sign out',
                  reason.message || 'Try again.',
                );
              });
          },
        },
      ],
    );
  };
  return (
    <ProfileScaffold title="Settings" onBack={navigation.goBack}>
      {profile ? (
        <DSListRow
          title={profile.name}
          subtitle={`@${profile.handle}${
            profile.bio ? `\n${profile.bio}` : ''
          }`}
          leading={<ProfileAvatar profile={profile} size={48} />}
          onPress={() => navigation.navigate('EditProfile')}
          testID="settings-edit-profile"
        />
      ) : null}
      <Group title="Preferences">
        <DSListRow
          title="Notifications"
          subtitle="Reminders, nudges & Circle activity"
          leading={<ProfileIcon icon={Bell} tone="green" />}
          onPress={() => navigation.navigate('NotificationSettings')}
          testID="settings-notifications"
        />
        <DSListRow
          title="Appearance"
          leading={<ProfileIcon icon={MoonStar} tone="purple" />}
          action={
            <DSText variant="secondary" tone="muted">
              {preview
                ? 'Preview'
                : appearance === 'system'
                ? 'System'
                : appearance === 'dark'
                ? 'Dark'
                : 'Light'}
            </DSText>
          }
          onPress={() => navigation.navigate('AppearanceSettings')}
          testID="settings-appearance"
        />
      </Group>
      {profile ? (
        <Group title="Account">
          <DSListRow
            title="Account settings"
            subtitle="Profile, timezone & commitment history"
            leading={<ProfileIcon icon={UserRound} tone="blue" />}
            onPress={() => navigation.navigate('AccountSettings')}
            testID="settings-account"
          />
        </Group>
      ) : null}
      <Group title="Help & about">
        <DSListRow
          title="Contact support"
          subtitle="Get help with Hoyst"
          leading={<ProfileIcon icon={LifeBuoy} />}
          onPress={() =>
            void Linking.openURL(
              'mailto:support@hoyst.app?subject=Hoyst%20support',
            ).catch(() =>
              Alert.alert('Contact Hoyst', 'Email support@hoyst.app for help.'),
            )
          }
          testID="settings-support"
        />
        <DSListRow
          title="About Hoyst"
          subtitle="App information"
          leading={<ProfileIcon icon={Info} />}
          onPress={() => navigation.navigate('AboutHoyst')}
          testID="settings-about"
        />
      </Group>
      {profile ? (
        <>
          <DSSurface>
            <DSListRow
              title={signingOut ? 'Signing out...' : 'Sign out'}
              titleTone="danger"
              chevronTone="danger"
              leading={<ProfileIcon icon={LogOut} tone="danger" />}
              onPress={signingOut ? undefined : signOut}
              testID="settings-sign-out"
            />
          </DSSurface>
          <DSListRow
            title="Delete account"
            titleTone="danger"
            chevronTone="danger"
            leading={<ProfileIcon icon={Trash2} tone="danger" />}
            onPress={() => setDeleteVisible(true)}
            testID="settings-delete-account"
          />
        </>
      ) : null}
      <View style={styles.footer}>
        <DSText variant="action" tone="muted">
          Hoyst
        </DSText>
        <DSText tone="muted" variant="secondary">
          {info.version && info.build
            ? `Version ${info.version} (${info.build})`
            : 'Build information unavailable'}
        </DSText>
      </View>
      {profile ? (
        <DeleteAccountModal
          visible={deleteVisible}
          onClose={() => setDeleteVisible(false)}
        />
      ) : null}
    </ProfileScaffold>
  );
}
function DeleteAccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const profile = useIdentity();
  const preview = useProfilePreview();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (visible) {
      setConfirm('');
      setError(undefined);
    }
  }, [visible]);
  const canDelete = Boolean(
    profile && normalizeHandle(confirm) === profile.handle && !busy,
  );
  const remove = async () => {
    if (!canDelete || !profile) return;
    if (preview) {
      setError('Read-only preview. No account will be deleted.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const uid = useSessionStore.getState().user?.uid;
      if (uid !== profile.id)
        throw new Error('Your account changed. Reopen Settings.');
      await deleteAccount();
      const activeUid = useSessionStore.getState().user?.uid;
      if (activeUid && activeUid !== uid) return;
      await signOutOfHoyst().catch(() => undefined);
      if (
        useSessionStore.getState().user?.uid &&
        useSessionStore.getState().user?.uid !== uid
      )
        return;
      useSessionStore.getState().clearPendingAction();
      const onboarding = useOnboardingStore.getState();
      onboarding.reset();
      onboarding.markSeen();
      useSettingsStore.getState().reset();
      useUserProfileStore.getState().setProfile(undefined);
      useSessionStore.getState().setGuest();
      onClose();
      Alert.alert('Account deleted', 'Your Hoyst account has been deleted.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Delete failed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ProfileTheme>
          <ProfileScaffold
            title="Delete account"
            onBack={busy ? undefined : onClose}>
            <DSText>
              Permanently delete your Hoyst account, circles, history, and
              uploads. This cannot be undone.
            </DSText>
            <DSInput
              label={`Type @${profile?.handle ?? ''} to confirm`}
              autoCapitalize="none"
              autoCorrect={false}
              value={confirm}
              onChangeText={setConfirm}
              editable={!busy}
              testID="delete-account-username"
            />
            {error ? (
              <DSText tone="danger" accessibilityLiveRegion="polite">
                {error}
              </DSText>
            ) : null}
            <DSButton
              label="Delete account"
              variant="danger"
              disabled={!canDelete}
              busy={busy}
              onPress={() => void remove()}
              testID="delete-account-confirm"
            />
            <DSButton
              label="Cancel"
              variant="quiet"
              disabled={busy}
              onPress={onClose}
            />
          </ProfileScaffold>
        </ProfileTheme>
      </SafeAreaProvider>
    </Modal>
  );
}
export function AccountSettingsScreen(props: Props<'AccountSettings'>) {
  const uid = useSessionStore(state => state.user?.uid);
  return (
    <Boundary>
      <AccountContent key={uid ?? 'guest'} {...props} />
    </Boundary>
  );
}
function AccountContent({navigation}: Props<'AccountSettings'>) {
  const profile = useIdentity();
  const preview = useProfilePreview();
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'UTC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [discardAction, setDiscardAction] =
    useState<Parameters<typeof navigation.dispatch>[0]>();
  const dirty = Boolean(profile && timezone !== profile.timezone);
  usePreventRemove(dirty && !discardAction, ({data}) => {
    if (busy) return;
    Alert.alert(
      'Discard changes?',
      'Your timezone change has not been saved.',
      [
        {text: 'Keep editing', style: 'cancel'},
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => setDiscardAction(data.action),
        },
      ],
    );
  });
  useEffect(() => {
    if (discardAction) navigation.dispatch(discardAction);
  }, [discardAction, navigation]);
  const saveTimezone = async () => {
    if (!profile || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (preview) {
        preview.updateProfile?.({...profile, timezone});
        return;
      }
      if (useSessionStore.getState().user?.uid !== profile.id)
        throw new Error('Your account changed. Reopen Account settings.');
      const result = await updateProfileFields({timezone});
      if (useSessionStore.getState().user?.uid === profile.id)
        useUserProfileStore.getState().setProfile(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not save timezone.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ProfileScaffold title="Account settings" onBack={navigation.goBack}>
      <DSSurface>
        <DSListRow
          title="Edit profile"
          subtitle="Photo, name, username, bio & color"
          leading={<ProfileIcon icon={UserRound} />}
          onPress={() => navigation.navigate('EditProfile')}
        />
      </DSSurface>
      <Group title="Timezone">
        <TimezonePicker
          value={timezone}
          onChange={value => {
            if (!busy) setTimezone(value);
          }}
          helperText="Sets your personal reset window and defaults. Existing Circle timezones stay the same."
          modalTitle="Account timezone"
        />
        {error ? (
          <DSText tone="danger" accessibilityLiveRegion="polite">
            {error}
          </DSText>
        ) : null}
        {dirty ? (
          <DSButton
            label="Save timezone"
            busy={busy}
            onPress={() => void saveTimezone()}
          />
        ) : null}
      </Group>
      <Group title="Commitment history">
        <DSListRow
          title="Archived commitments & circles"
          subtitle="View history and restore items you own."
          leading={<ProfileIcon icon={Archive} tone="purple" />}
          onPress={() => navigation.navigate('ArchivedCircles')}
          testID="account-archives"
        />
      </Group>
    </ProfileScaffold>
  );
}
const notificationRows: Array<{
  key: keyof NotificationSettings;
  title: string;
  detail: string;
  icon: typeof Bell;
  tone: 'blue' | 'green' | 'orange' | 'purple';
}> = [
  {
    key: 'tapInReminders',
    title: 'Tap In reminders',
    detail: 'A reminder before your Opportunity closes.',
    icon: Bell,
    tone: 'orange',
  },
  {
    key: 'socialActivity',
    title: 'Circle activity',
    detail: 'Recaps for Tap Ins, completions, joins, and milestones.',
    icon: UsersRound,
    tone: 'green',
  },
  {
    key: 'nudgePrompts',
    title: 'Nudge reminders',
    detail: 'A daily prompt to help Members before an Opportunity closes.',
    icon: Shield,
    tone: 'orange',
  },
  {
    key: 'nudges',
    title: 'Nudges',
    detail: 'When a Member nudges you.',
    icon: BellRing,
    tone: 'purple',
  },
  {
    key: 'discovery',
    title: 'Circle discovery',
    detail: 'Suggestions after a few quiet Tap In days.',
    icon: Compass,
    tone: 'blue',
  },
  {
    key: 'productUpdates',
    title: 'Product updates',
    detail: 'Product news and major app announcements.',
    icon: Megaphone,
    tone: 'blue',
  },
];
export function NotificationSettingsScreen(
  props: Props<'NotificationSettings'>,
) {
  const uid = useSessionStore(state => state.user?.uid);
  return (
    <Boundary>
      <NotificationsContent key={uid ?? 'guest'} {...props} />
    </Boundary>
  );
}
function NotificationsContent({navigation}: Props<'NotificationSettings'>) {
  const theme = useSystemTheme();
  const preview = useProfilePreview();
  const uid = useSessionStore(state => state.user?.uid);
  const [values, setValues] = useState<NotificationSettings>();
  const [pending, setPending] = useState<
    Partial<Record<keyof NotificationSettings, boolean>>
  >({});
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (preview) {
      setValues({
        tapInReminders: true,
        socialActivity: true,
        nudgePrompts: true,
        nudges: true,
        discovery: true,
        productUpdates: true,
      });
      return () => {
        mounted.current = false;
      };
    }
    if (!uid) return;
    const unsubscribe = subscribeToNotificationSettings({
      uid,
      onSettings: settings => {
        if (mounted.current) {
          setValues(settings);
          useSettingsStore.getState().setNotificationSettings(settings);
        }
      },
      onError: reason => {
        if (mounted.current) setError(reason.message);
      },
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [uid, preview]);
  const change = async (key: keyof NotificationSettings, value: boolean) => {
    if (!values || pending[key]) return;
    const previous = values[key];
    setError(undefined);
    setPending(current => ({...current, [key]: true}));
    try {
      if (!preview && value) {
        const granted = await requestPushNotificationPermission();
        if (!granted)
          throw new Error(
            `Allow Hoyst notifications in ${
              Platform.OS === 'ios' ? 'iOS' : 'Android'
            } Settings before enabling this preference.`,
          );
      }
      if (
        !mounted.current ||
        (!preview && useSessionStore.getState().user?.uid !== uid)
      )
        return;
      setValues(current => (current ? {...current, [key]: value} : current));
      if (!preview) {
        useSettingsStore.getState().setNotificationPreference(key, value);
        await updateNotificationSettings({[key]: value});
      }
    } catch (reason) {
      if (
        mounted.current &&
        (preview || useSessionStore.getState().user?.uid === uid)
      ) {
        setValues(current =>
          current ? {...current, [key]: previous} : current,
        );
        if (!preview)
          useSettingsStore.getState().setNotificationPreference(key, previous);
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not update notifications. Try again.',
        );
      }
    } finally {
      if (mounted.current) setPending(current => ({...current, [key]: false}));
    }
  };
  return (
    <ProfileScaffold title="Notifications" onBack={navigation.goBack}>
      <DSText tone="muted">Choose which Hoyst updates reach you.</DSText>
      {error ? (
        <DSText tone="danger" accessibilityLiveRegion="polite">
          {error}
        </DSText>
      ) : null}
      {!values ? (
        <DSText tone="muted">Loading notification preferences...</DSText>
      ) : (
        <DSSurface style={styles.groupSurface}>
          {notificationRows.map(row => (
            <DSListRow
              key={row.key}
              title={row.title}
              subtitle={row.detail}
              leading={<ProfileIcon icon={row.icon} tone={row.tone} />}
              action={
                <Switch
                  accessibilityLabel={row.title}
                  testID={`notification-${row.key}`}
                  value={values[row.key]}
                  disabled={pending[row.key]}
                  onValueChange={value => void change(row.key, value)}
                  trackColor={{false: theme.track, true: '#10B967'}}
                  thumbColor="#FFFFFF"
                />
              }
            />
          ))}
        </DSSurface>
      )}
      <DSSurface>
        <DSListRow
          title="Device notification settings"
          subtitle="Manage Hoyst push permissions on your device."
          leading={<ProfileIcon icon={Shield} tone="green" />}
          onPress={() =>
            void Linking.openSettings().catch(() =>
              setError('Could not open device Settings.'),
            )
          }
        />
      </DSSurface>
    </ProfileScaffold>
  );
}
export function AppearanceSettingsScreen(props: Props<'AppearanceSettings'>) {
  return (
    <Boundary>
      <AppearanceContent {...props} />
    </Boundary>
  );
}
function AppearanceContent({navigation}: Props<'AppearanceSettings'>) {
  const preview = useProfilePreview();
  const theme = useSystemTheme();
  const selected = useSettingsStore(state => state.appearance);
  const [fixture, setFixture] = useState<AppearancePreference>(
    preview?.scheme ?? selected,
  );
  return (
    <ProfileScaffold title="Appearance" onBack={navigation.goBack}>
      <DSText tone="muted">Choose how Hoyst looks on this device.</DSText>
      <DSSurface>
        {(['light', 'dark', 'system'] as AppearancePreference[]).map(value => (
          <DSListRow
            key={value}
            title={
              value === 'system'
                ? 'System'
                : value === 'dark'
                ? 'Dark'
                : 'Light'
            }
            subtitle={
              value === 'system'
                ? 'Match your device appearance.'
                : `Always use ${value} mode.`
            }
            onPress={() =>
              preview
                ? setFixture(value)
                : useSettingsStore.getState().setAppearancePreference(value)
            }
            action={
              (preview ? fixture : selected) === value ? (
                <Check
                  size={18}
                  color={theme.success}
                  accessibilityLabel="Selected"
                />
              ) : undefined
            }
            testID={`appearance-${value}`}
          />
        ))}
      </DSSurface>
    </ProfileScaffold>
  );
}
export function AboutHoystScreen(props: Props<'AboutHoyst'>) {
  return (
    <Boundary>
      <AboutContent {...props} />
    </Boundary>
  );
}
function AboutContent({navigation}: Props<'AboutHoyst'>) {
  const info = getInstalledAppInfo();
  return (
    <ProfileScaffold title="About Hoyst" onBack={navigation.goBack}>
      <DSText variant="heading">Commit. Tap In. Keep moving.</DSText>
      <DSText tone="muted">
        Build commitments, share the rhythm with a Circle, and make progress
        through showing up.
      </DSText>
      <DSSurface>
        <DSListRow
          title="Version"
          subtitle={info.version ?? 'Unavailable in this build'}
        />
        <DSListRow
          title="Build"
          subtitle={info.build ?? 'Unavailable in this build'}
        />
        <DSListRow
          title="Hoyst website"
          subtitle="hoyst.app"
          leading={<ProfileIcon icon={Globe} />}
          onPress={() =>
            void Linking.openURL('https://hoyst.app/').catch(() =>
              Alert.alert(
                'Could not open website',
                'Visit hoyst.app in your browser.',
              ),
            )
          }
        />
      </DSSurface>
    </ProfileScaffold>
  );
}
const styles = StyleSheet.create({
  group: {gap: 8},
  groupSurface: {paddingVertical: 4},
  footer: {alignItems: 'center', gap: 4, marginTop: 8},
});
