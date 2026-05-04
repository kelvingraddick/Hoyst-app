import React from 'react';
import {Pressable, StyleSheet, Switch, View} from 'react-native';
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
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import type {LucideIcon} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {signOutOfHoyst} from '../../auth/services/auth-service';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {useOnboardingStore} from '../../../store/onboarding-store';

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
  onPress?: () => void;
  title: string;
  trailing?: React.ReactNode;
};

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
      style={({pressed}) => [
        styles.headerButton,
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

function SectionDivider() {
  const theme = useHoystTheme();

  return (
    <View style={styles.dividerWrap}>
      <View
        style={[
          styles.divider,
          {
            backgroundColor: theme.borderStrong,
          },
        ]}
      />
    </View>
  );
}

function SettingsSection({children, title}: SectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <HoystText tone="muted" variant="label">
        {title}
      </HoystText>
      <GlassPanel style={styles.sectionPanel}>
        <View style={styles.sectionGroup}>{children}</View>
      </GlassPanel>
    </View>
  );
}

function SettingsRow({
  detail,
  disabled = false,
  icon: Icon,
  iconColor,
  onPress,
  title,
  trailing,
}: SettingsRowProps): React.JSX.Element {
  const theme = useHoystTheme();
  const isInteractive = Boolean(onPress) && !disabled;

  return (
    <Pressable
      disabled={!isInteractive}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        {
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
      ]}>
      <View style={styles.rowMain}>
        <View style={styles.rowIcon}>
          <Icon
            color={iconColor ?? theme.accentSecondary}
            size={18}
            strokeWidth={2.1}
          />
        </View>
        <View style={styles.rowContent}>
          <HoystText style={styles.rowTitle}>{title}</HoystText>
          {detail ? (
            <HoystText style={styles.rowDetail} tone="muted" variant="caption">
              {detail}
            </HoystText>
          ) : null}
        </View>
      </View>
      {trailing ? <View style={styles.rowTrailing}>{trailing}</View> : null}
    </Pressable>
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
  );
}

export function SettingsScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const displayProfile = useUserProfileStore(state => state.getDisplayProfile());
  const status = useSessionStore(state => state.status);
  const notifications = useSettingsStore(state => state.notifications);
  const setNotificationPreference = useSettingsStore(
    state => state.setNotificationPreference,
  );
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const startForProtectedAction = useOnboardingStore(
    state => state.startForProtectedAction,
  );
  const setGuest = useSessionStore(state => state.setGuest);
  const isReady = status === 'authenticatedReady' && Boolean(profile);
  const initials = displayProfile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  if (!isReady) {
    return (
      <HoystScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <HeaderButton onPress={() => navigation.goBack()}>
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
            label="Sign in or register"
            onPress={() => {
              beginAuthFlow({type: 'settings'});
              startForProtectedAction();
              navigation.navigate('Auth', {screen: 'Welcome'});
            }}
          />
        </GlassPanel>
      </HoystScreen>
    );
  }

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <HeaderButton onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </HeaderButton>
        <HoystText variant="headline">Settings</HoystText>
      </View>

      <SettingsSection title="Account">
        <AccountSummaryRow
          bio={displayProfile.bio}
          handle={displayProfile.handle}
          imageSource={displayProfile.avatarImage}
          initials={initials}
          name={displayProfile.name}
        />
        <SectionDivider />
        <SettingsRow
          detail="Update your name, handle, and bio."
          icon={UserRound}
          onPress={() => navigation.navigate('EditProfile')}
          title="Edit profile"
          trailing={
            <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail={displayProfile.timezone}
          icon={Clock3}
          title="Timezone"
          trailing={
            <HoystText tone="muted" variant="caption">
              Local
            </HoystText>
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Exit the Hoyst shell and return to auth."
          icon={LogOut}
          iconColor={theme.danger}
          onPress={() => {
            signOutOfHoyst().finally(setGuest).catch(() => undefined);
          }}
          title="Sign out"
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          detail="Daily nudge to keep your streak moving."
          icon={Bell}
          title="Tap In reminders"
          trailing={
            <Switch
              onValueChange={value =>
                setNotificationPreference('tapInReminders', value)
              }
              trackColor={{
                false: theme.borderStrong,
                true: theme.accentSecondary,
              }}
              thumbColor={theme.backgroundElevated}
              value={notifications.tapInReminders}
            />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Circle activity, nudges, and group updates."
          icon={UsersRound}
          title="Circle activity"
          trailing={
            <Switch
              onValueChange={value =>
                setNotificationPreference('circleActivity', value)
              }
              trackColor={{
                false: theme.borderStrong,
                true: theme.accentSecondary,
              }}
              thumbColor={theme.backgroundElevated}
              value={notifications.circleActivity}
            />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Product news and major app announcements."
          icon={Megaphone}
          title="Product updates"
          trailing={
            <Switch
              onValueChange={value =>
                setNotificationPreference('productUpdates', value)
              }
              trackColor={{
                false: theme.borderStrong,
                true: theme.accentSecondary,
              }}
              thumbColor={theme.backgroundElevated}
              value={notifications.productUpdates}
            />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={BellRing}
          title="Reminder time"
          trailing={
            <HoystText tone="muted" variant="caption">
              8:00 AM
            </HoystText>
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={Shield}
          title="Push permissions"
          trailing={
            <HoystText tone="muted" variant="caption">
              System
            </HoystText>
          }
        />
      </SettingsSection>

      <SettingsSection title="App">
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={MoonStar}
          title="Appearance"
          trailing={
            <HoystText tone="muted" variant="caption">
              System
            </HoystText>
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Build information"
          icon={Smartphone}
          title="App version"
          trailing={
            <HoystText tone="muted" variant="caption">
              0.0.1
            </HoystText>
          }
        />
      </SettingsSection>

      <SettingsSection title="Support & Legal">
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={LifeBuoy}
          title="Help"
          trailing={
            <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={ShieldCheck}
          title="Privacy Policy"
          trailing={
            <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
          }
        />
        <SectionDivider />
        <SettingsRow
          detail="Coming soon"
          disabled
          icon={FileText}
          title="Terms"
          trailing={
            <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
          }
        />
      </SettingsSection>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 180,
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
    gap: 10,
  },
  sectionPanel: {
    marginHorizontal: 0,
  },
  sectionGroup: {
    gap: 0,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  summaryCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  dividerWrap: {
    justifyContent: 'center',
    minHeight: 18,
  },
  divider: {
    height: 1,
    marginLeft: 52,
    marginRight: 4,
    opacity: 0.7,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    minHeight: 88,
    paddingHorizontal: 4,
    paddingVertical: 18,
  },
  rowMain: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 3,
    width: 28,
  },
  rowContent: {
    flex: 1,
    gap: 8,
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
    justifyContent: 'flex-start',
    minWidth: 60,
    paddingTop: 2,
  },
});
