import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight, Settings2} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {AppTabsParamList, RootStackParamList} from '../../../navigation/types';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';

type Props = BottomTabScreenProps<AppTabsParamList, 'Profile'>;

export function ProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const displayProfile = useUserProfileStore(state => state.getDisplayProfile());
  const status = useSessionStore(state => state.status);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const startForProtectedAction = useOnboardingStore(
    state => state.startForProtectedAction,
  );
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const isReady = status === 'authenticatedReady' && Boolean(profile);
  const initials = displayProfile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      {!isReady ? (
        <GlassPanel>
          <View style={styles.sectionCopy}>
            <HoystText variant="title">Create your Hoyst account</HoystText>
            <HoystText tone="muted">
              Profiles, settings, joins, and Tap Ins unlock after sign-in and a
              handle.
            </HoystText>
          </View>
          <HoystButton
            label="Sign in or register"
            onPress={() => {
              beginAuthFlow({type: 'settings'});
              startForProtectedAction();
              rootNavigation?.navigate('Auth', {screen: 'Welcome'});
            }}
          />
        </GlassPanel>
      ) : null}
      <GlassPanel>
        <View style={styles.profileHeader}>
          <LayeredAvatar
            initials={initials}
            imageSource={displayProfile.avatarImage}
            size={68}
            state="done"
          />
          <View style={styles.copy}>
            <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
            <HoystText variant="title">{displayProfile.name}</HoystText>
            <HoystText tone="muted">@{displayProfile.handle}</HoystText>
            {displayProfile.bio ? (
              <HoystText tone="muted">{displayProfile.bio}</HoystText>
            ) : null}
          </View>
        </View>
        <View style={styles.chips}>
          <HoystChip label="18 Day Streak" tone="green" />
          <HoystChip label="3 Circles" tone="purple" />
        </View>
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
            if (!isReady) {
              beginAuthFlow({type: 'settings'});
              startForProtectedAction();
              rootNavigation?.navigate('Auth', {screen: 'Welcome'});
              return;
            }

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
  logo: {
    height: 20,
    width: 48,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
