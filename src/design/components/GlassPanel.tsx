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
  style?: StyleProp<ViewStyle>;
}>;

export function GlassPanel({
  children,
  style,
}: GlassPanelProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        styles.container,
        shadows.soft,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
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
      <View style={styles.content}>{children}</View>
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
    padding: 18,
    gap: 12,
  },
  highlight: {
    borderRadius: radius.lg,
  },
});
