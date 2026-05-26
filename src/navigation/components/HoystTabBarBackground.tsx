import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';

import {useHoystTheme} from '../../design/theme/useHoystTheme';

export function HoystTabBarBackground(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        {
          backgroundColor: theme.isDark
            ? 'rgba(20, 22, 32, 0.84)'
            : 'rgba(255, 255, 255, 0.86)',
        },
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={30}
          blurType={theme.isDark ? 'dark' : 'light'}
          reducedTransparencyFallbackColor={theme.surfaceStrong}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        colors={
          theme.isDark
            ? [
                'rgba(255, 255, 255, 0.12)',
                'rgba(255, 255, 255, 0.04)',
                'rgba(255, 255, 255, 0.02)',
              ]
            : [
                'rgba(255, 255, 255, 0.96)',
                'rgba(255, 255, 255, 0.8)',
                'rgba(255, 255, 255, 0.7)',
              ]
        }
        end={{x: 0.5, y: 1}}
        start={{x: 0.5, y: 0}}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.innerBorder,
          {
            borderColor: theme.isDark
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(16, 24, 40, 0.08)',
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.topSheen,
          {
            backgroundColor: theme.isDark
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(255, 255, 255, 0.74)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: 34,
    overflow: 'hidden',
  },
  innerBorder: {
    borderRadius: 34,
    borderWidth: 1,
  },
  topSheen: {
    borderRadius: 999,
    height: 2,
    left: 28,
    position: 'absolute',
    right: 28,
    top: 1,
  },
});
