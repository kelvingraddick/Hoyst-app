import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';

import {useHoystTheme} from '../theme/useHoystTheme';
import {glass} from '../tokens/glass';
import {radius} from '../tokens/radius';
import {shadows} from '../tokens/shadows';

type GlassPanelProps = PropsWithChildren<{
  padding?: 'compact' | 'none' | 'regular';
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'nav' | 'panel';
}>;

// Frosted glass surface (v4). A live BlurView with a translucent tint overlay
// so the FrostedBackdrop color blobs still refract through the card, finished
// with a bright top-edge highlight and a soft violet drop shadow. Restyled here
// once so every glass surface in the app inherits the new look.
export function GlassPanel({
  children,
  padding = 'regular',
  style,
  variant = 'card',
}: GlassPanelProps): React.JSX.Element {
  const theme = useHoystTheme();
  const contentStyle =
    padding === 'none'
      ? styles.contentNone
      : padding === 'compact'
      ? styles.contentCompact
      : styles.content;
  const darkTopSheenStyle =
    variant === 'panel'
      ? styles.darkPanelTopSheen
      : variant === 'nav'
      ? styles.darkNavTopSheen
      : styles.darkCardTopSheen;

  return (
    <View
      style={[
        styles.container,
        variant === 'nav' ? shadows.floating : shadows.soft,
        {
          backgroundColor: 'transparent',
          borderColor: theme.glassBorder,
          shadowColor: theme.glassShadow,
        },
        variant === 'panel' ? styles.panel : undefined,
        variant === 'nav' ? styles.nav : undefined,
        style,
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={glass.blurAmount}
          blurType={theme.isDark ? 'thinMaterialDark' : 'light'}
          reducedTransparencyFallbackColor={theme.glassSurfaceStrong}
          testID="glass-panel-blur"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.glassSurfaceStrong,
            },
          ]}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.glassSurface,
          },
        ]}
        testID="glass-panel-tint"
      />
      {theme.isDark ? (
        <LinearGradient
          colors={[...glass.darkHighlightGradientColors]}
          end={{x: 0.5, y: 1}}
          pointerEvents="none"
          start={{x: 0.5, y: 0}}
          style={StyleSheet.absoluteFill}
          testID="glass-panel-highlight-gradient"
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.highlight,
          {
            borderColor: theme.glassBorder,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.topSheen,
          theme.isDark ? darkTopSheenStyle : undefined,
          {backgroundColor: theme.glassHighlight},
        ]}
        testID="glass-panel-top-sheen"
      />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: glass.borderWidth,
    overflow: 'hidden',
  },
  content: {
    gap: 14,
    padding: glass.cardPadding,
  },
  contentCompact: {
    gap: 12,
    padding: glass.compactPadding,
  },
  contentNone: {
    gap: 0,
    padding: 0,
  },
  highlight: {
    borderRadius: radius.lg,
  },
  nav: {
    borderRadius: radius.xl,
  },
  panel: {
    borderRadius: 28,
  },
  topSheen: {
    borderRadius: 999,
    height: glass.highlightHeight,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 0.5,
  },
  darkCardTopSheen: {
    height: glass.darkHighlightSheenHeight,
    left: glass.darkCardHighlightSheenInset,
    right: glass.darkCardHighlightSheenInset,
    top: glass.darkHighlightSheenTop,
  },
  darkPanelTopSheen: {
    height: glass.darkHighlightSheenHeight,
    left: glass.darkPanelHighlightSheenInset,
    right: glass.darkPanelHighlightSheenInset,
    top: glass.darkHighlightSheenTop,
  },
  darkNavTopSheen: {
    height: glass.darkHighlightSheenHeight,
    left: glass.darkNavHighlightSheenInset,
    right: glass.darkNavHighlightSheenInset,
    top: glass.darkHighlightSheenTop,
  },
});
