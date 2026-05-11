import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {
  ChevronRight,
  LockKeyhole,
  Settings2,
  ShieldCheck,
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
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {AppTabsParamList, RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {getProfileSignInParams} from '../../auth/services/auth-route-intent';
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

export function ProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const clearPendingAction = useSessionStore(state => state.clearPendingAction);
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
    rootNavigation?.navigate('Auth', {
      params: getProfileSignInParams(),
      screen: 'SignIn',
    });
  };
  const openCompleteProfile = () => {
    rootNavigation?.navigate('Auth', {screen: 'CompleteProfile'});
  };

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
                  {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
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
            <HoystButton label="Sign in or register" onPress={openProfileAuth} />
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

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <GlassPanel>
        <View style={styles.profileHeader}>
          <LayeredAvatar
            initials={initials}
            imageSource={avatarSource}
            size={68}
            state="done"
          />
          <View style={styles.copy}>
            <HoystText variant="title">{profile.name}</HoystText>
            <HoystText tone="muted">@{profile.handle}</HoystText>
            {profile.bio ? (
              <HoystText tone="muted">{profile.bio}</HoystText>
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
      </GlassPanel>
      <GlassPanel>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <HoystText variant="title">Account Hub</HoystText>
            <HoystText tone="muted">
              Manage notifications, profile details, and support destinations in
              one dedicated space.
            </HoystText>
          </View>
          <View
            style={[
              styles.sectionIcon,
              {backgroundColor: theme.surfaceSoft, borderColor: theme.border},
            ]}>
            <Settings2 color={theme.accentSecondary} size={18} strokeWidth={2.1} />
          </View>
        </View>
        <Pressable
          onPress={() => {
            rootNavigation?.navigate('Settings');
          }}
          style={({pressed}) => [
            styles.settingsLink,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <View style={styles.settingsLinkInner}>
            <View style={styles.settingsLinkCopy}>
              <HoystText>Open settings</HoystText>
              <HoystText tone="muted" variant="caption">
                Notifications, app preferences, and sign out
              </HoystText>
            </View>
            <View style={styles.settingsLinkChevron}>
              <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
            </View>
          </View>
        </Pressable>
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  copy: {
    flex: 1,
    gap: 6,
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  sectionCopy: {
    flex: 1,
    gap: 6,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingsLink: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  settingsLinkInner: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  settingsLinkCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  settingsLinkChevron: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    paddingTop: 2,
  },
});
