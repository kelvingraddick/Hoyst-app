import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {glass} from '../tokens/glass';
import {radius} from '../tokens/radius';
import {shadows} from '../tokens/shadows';

type GlassPanelProps = PropsWithChildren<{
  padding?: 'compact' | 'none' | 'regular';
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'nav' | 'panel';
}>;

// Shared opaque panel surface. The light theme uses white and the dark theme
// uses a cool slate fill, with the existing rounded shape and elevation.
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
          backgroundColor: theme.panelSurface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        variant === 'panel' ? styles.panel : undefined,
        variant === 'nav' ? styles.nav : undefined,
        style,
      ]}
      testID="solid-panel-surface">
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
  nav: {
    borderRadius: radius.xl,
  },
  panel: {
    borderRadius: 28,
  },
});
