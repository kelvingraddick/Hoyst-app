import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {BlurView} from '@react-native-community/blur';

import {useHoystTheme} from '../../design/theme/useHoystTheme';

export function HoystTabBarBackground(): React.JSX.Element {
  const theme = useHoystTheme();

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        blurAmount={24}
        blurType={theme.isDark ? 'dark' : 'light'}
        reducedTransparencyFallbackColor={theme.surfaceStrong}
        style={[
          StyleSheet.absoluteFillObject,
          styles.base,
          {
            borderColor: theme.border,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        styles.base,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 32,
    borderWidth: 1,
  },
});
