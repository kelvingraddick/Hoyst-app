import React from 'react';
import {StyleSheet, View} from 'react-native';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {currentUserProfile} from '../../circles/mockData';

export function ProfileScreen(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <GlassPanel>
        <View style={styles.profileHeader}>
          <LayeredAvatar
            initials="KE"
            imageSource={currentUserProfile.avatarImage}
            size={68}
            state="done"
          />
          <View style={styles.copy}>
            <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
            <HoystText variant="title">@{currentUserProfile.handle}</HoystText>
            <HoystText tone="muted">{currentUserProfile.bio}</HoystText>
          </View>
        </View>
        <View style={styles.chips}>
          <HoystChip label="18 Day Streak" tone="green" />
          <HoystChip label="3 Circles" tone="purple" />
        </View>
      </GlassPanel>
      <GlassPanel>
        <HoystText variant="title">Settings</HoystText>
        <HoystText tone="muted">
          Notification timing, profile edits, and account methods will plug into
          this redesigned shell next.
        </HoystText>
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
});
