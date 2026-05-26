import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {BrandMark} from './BrandMark';
import {useHoystTheme} from '../theme/useHoystTheme';

type TapInRingMarkProps = {
  innerSize?: number;
  outerSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function TapInRingMark({
  innerSize = 45,
  outerSize = 81,
  style,
}: TapInRingMarkProps): React.JSX.Element {
  const theme = useHoystTheme();
  const visibleOuterSize = outerSize * 0.94;
  const visibleRingSize = Math.min(innerSize * 1.12, visibleOuterSize * 0.72);
  const wrapInset = Math.max(8, outerSize * 0.12);
  const glowInset = Math.max(8, visibleOuterSize * 0.11);
  const bottomGlowInset = Math.max(7, visibleOuterSize * 0.1);
  const shadowRadius = Math.max(7, visibleOuterSize * 0.13);
  const shadowLift = Math.max(3, visibleOuterSize * 0.055);
  const wrapSize = outerSize + wrapInset;
  const glowSize = visibleOuterSize + glowInset;
  const bottomGlowSize = visibleOuterSize + bottomGlowInset;
  const wrapSizeStyle = {height: wrapSize, width: wrapSize};
  const discSizeStyle = {
    borderRadius: visibleOuterSize / 2,
    height: visibleOuterSize,
    width: visibleOuterSize,
  };
  const ringSizeStyle = {height: visibleRingSize, width: visibleRingSize};
  const glowSizeStyle = {
    borderRadius: glowSize / 2,
    height: glowSize,
    width: glowSize,
  };
  const bottomGlowSizeStyle = {
    borderRadius: bottomGlowSize / 2,
    height: bottomGlowSize,
    width: bottomGlowSize,
  };

  return (
    <View style={[styles.wrap, wrapSizeStyle, style]}>
      <LinearGradient
        colors={[
          'rgba(0, 200, 83, 0.14)',
          'rgba(24, 185, 255, 0.12)',
          'rgba(90, 28, 255, 0.16)',
          'rgba(255, 30, 168, 0.12)',
        ]}
        end={{x: 1, y: 1}}
        start={{x: 0, y: 0}}
        style={[
          styles.spectrumGlow,
          glowSizeStyle,
          theme.isDark ? styles.spectrumGlowDark : undefined,
        ]}
      />
      <LinearGradient
        colors={[
          'rgba(24, 185, 255, 0)',
          'rgba(24, 185, 255, 0.14)',
          'rgba(90, 28, 255, 0.17)',
          'rgba(255, 30, 168, 0.08)',
        ]}
        style={[styles.bottomGlow, bottomGlowSizeStyle]}
      />
      <View
        style={[
          styles.discShadow,
          discSizeStyle,
          {
            elevation: Math.max(4, Math.round(visibleOuterSize / 14)),
            shadowColor: theme.isDark ? '#000000' : 'rgba(15, 23, 42, 0.28)',
            shadowOffset: {
              height: shadowLift,
              width: 0,
            },
            shadowOpacity: theme.isDark ? 0.16 : 0.11,
            shadowRadius,
          },
        ]}>
        <View
          style={[
            styles.discSurface,
            discSizeStyle,
            {
              backgroundColor: theme.isDark
                ? 'rgba(255, 255, 255, 0.14)'
                : 'rgba(255, 255, 255, 0.88)',
              borderColor: theme.isDark
                ? 'rgba(255, 255, 255, 0.24)'
                : 'rgba(255, 255, 255, 0.96)',
            },
          ]}>
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.84)',
              'rgba(255, 255, 255, 0.26)',
              'rgba(255, 255, 255, 0)',
            ]}
            end={{x: 0.5, y: 1}}
            start={{x: 0.5, y: 0}}
            style={[StyleSheet.absoluteFill, styles.topHighlight]}
          />
          <View
            style={[
              styles.innerShadow,
              {
                borderColor: theme.isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(16, 24, 40, 0.06)',
                borderRadius: visibleOuterSize / 2,
              },
            ]}
          />
          <View
            style={[
              styles.innerGlow,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(255, 255, 255, 0.34)',
                borderRadius: visibleOuterSize / 2,
              },
            ]}
          />
          <BrandMark
            isDark={theme.isDark}
            kind="ring"
            style={[styles.ringOverlay, ringSizeStyle]}
          />
          <BrandMark
            isDark={theme.isDark}
            kind="ring"
            style={[styles.ring, ringSizeStyle]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomGlow: {
    bottom: 0,
    opacity: 0.66,
    position: 'absolute',
  },
  discShadow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discSurface: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerGlow: {
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  innerShadow: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  ring: {},
  ringOverlay: {
    opacity: 0.42,
    position: 'absolute',
    transform: [{scale: 1.055}],
  },
  spectrumGlow: {
    opacity: 0.56,
    position: 'absolute',
  },
  spectrumGlowDark: {
    opacity: 0.44,
  },
  topHighlight: {
    opacity: 0.74,
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
