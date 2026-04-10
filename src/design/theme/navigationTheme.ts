import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';

import type {HoystTheme} from '../tokens/colors';

export function createNavigationTheme(colors: HoystTheme): Theme {
  const baseTheme = colors.isDark ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.surfaceStrong,
      border: colors.border,
      primary: colors.accent,
      text: colors.text,
      notification: colors.danger,
    },
  };
}
