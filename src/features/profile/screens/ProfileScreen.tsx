import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronRight, Settings2} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {AppTabsParamList, RootStackParamList} from '../../../navigation/types';
import {useUserProfileStore} from '../../../store/profile-store';

type Props = BottomTabScreenProps<AppTabsParamList, 'Profile'>;

export function ProfileScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const profile = useUserProfileStore(state => state.profile);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <GlassPanel>
        <View style={styles.profileHeader}>
          <LayeredAvatar
            initials={initials}
            imageSource={profile.avatarImage}
            size={68}
            state="done"
          />
          <View style={styles.copy}>
            <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
            <HoystText variant="title">{profile.name}</HoystText>
            <HoystText tone="muted">@{profile.handle}</HoystText>
            {profile.bio ? <HoystText tone="muted">{profile.bio}</HoystText> : null}
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
          onPress={() => rootNavigation?.navigate('Settings')}
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
