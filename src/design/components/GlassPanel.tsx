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

import {useHoystTheme} from '../theme/useHoystTheme';
import {glass} from '../tokens/glass';
import {radius} from '../tokens/radius';
import {shadows} from '../tokens/shadows';

type GlassPanelProps = PropsWithChildren<{
  padding?: 'compact' | 'none' | 'regular';
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'nav' | 'panel';
}>;

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

  return (
    <View
      style={[
        styles.container,
        variant === 'nav' ? shadows.floating : shadows.soft,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        variant === 'panel' ? styles.panel : undefined,
        variant === 'nav' ? styles.nav : undefined,
        style,
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurAmount={glass.blurAmount}
          blurType={theme.isDark ? 'dark' : 'light'}
          reducedTransparencyFallbackColor={theme.surfaceStrong}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.tint,
            },
          ]}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.highlight,
          {
            borderColor: theme.border,
          },
        ]}
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
});
