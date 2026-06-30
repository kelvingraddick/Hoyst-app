import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';

import {useHoystTheme} from '../../design/theme/useHoystTheme';
import {glass} from '../../design/tokens/glass';

export function HoystTabBarBackground(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        {
          backgroundColor: theme.isDark
            ? 'rgba(20, 22, 32, 0.6)'
            : 'rgba(255, 255, 255, 0.6)',
        },
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={28}
          blurType={theme.isDark ? 'dark' : 'light'}
          reducedTransparencyFallbackColor={theme.glassSurfaceStrong}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        colors={
          theme.isDark
            ? [...glass.darkHighlightGradientColors]
            : [
                'rgba(255, 255, 255, 0.72)',
                'rgba(255, 255, 255, 0.5)',
                'rgba(255, 255, 255, 0.4)',
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
            borderColor: theme.glassBorder,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.topSheen,
          {
            backgroundColor: theme.glassHighlight,
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
    height: glass.darkHighlightSheenHeight,
    left: glass.darkTabBarHighlightSheenInset,
    position: 'absolute',
    right: glass.darkTabBarHighlightSheenInset,
    top: glass.darkHighlightSheenTop,
  },
});
