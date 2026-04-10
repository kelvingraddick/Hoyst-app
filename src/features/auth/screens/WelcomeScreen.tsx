import React from 'react';
import {StyleSheet, View} from 'react-native';

import {BrandMark} from '../../../design/components/BrandMark';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';

export function WelcomeScreen(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <HoystScreen>
      <View style={styles.hero}>
        <BrandMark
          isDark={theme.isDark}
          kind="logo"
          style={styles.logo}
        />
        <HoystText style={styles.title} variant="largeTitle">
          Consistency feels lighter in a circle.
        </HoystText>
        <HoystText style={styles.copy} tone="muted">
          Daily accountability, group streaks, low-friction check-ins, and a
          little momentum you can actually keep.
        </HoystText>
      </View>
      <GlassPanel>
        <HoystText variant="title">Scaffold Notes</HoystText>
        <HoystText tone="muted">
          The app currently opens in preview mode so the main Hoyst shell is
          reviewable before auth wiring lands.
        </HoystText>
        <HoystButton label="Continue To Preview" />
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 16,
    paddingTop: 28,
  },
  title: {
    maxWidth: 320,
  },
  copy: {
    maxWidth: 320,
  },
  logo: {
    height: 52,
  },
});
