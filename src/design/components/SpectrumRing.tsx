import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {gradients} from '../tokens/gradients';
import {BrandMark} from './BrandMark';
import {useHoystTheme} from '../theme/useHoystTheme';

type SpectrumRingProps = {
  glow?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function SpectrumRing({
  glow = true,
  size = 44,
  style,
}: SpectrumRingProps): React.JSX.Element {
  const theme = useHoystTheme();
  const sizeStyle = {height: size, width: size};

  return (
    <View style={[styles.wrap, sizeStyle, style]}>
      {glow ? (
        <LinearGradient
          colors={[...gradients.spectrumGlow]}
          style={[
            styles.glow,
            theme.isDark ? styles.glowDark : styles.glowLight,
            {
              borderRadius: size,
              height: size + 20,
              width: size + 20,
            },
          ]}
        />
      ) : null}
      <BrandMark
        isDark={theme.isDark}
        kind="ring"
        style={[styles.ringOverlay, sizeStyle]}
      />
      <BrandMark isDark={theme.isDark} kind="ring" style={sizeStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
  glowDark: {
    opacity: 0.5,
  },
  glowLight: {
    opacity: 0.72,
  },
  ringOverlay: {
    opacity: 0.42,
    position: 'absolute',
    transform: [{scale: 1.055}],
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
