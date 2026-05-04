export const brandColors = {
  green: '#44d85c',
  orange: '#FF8A3D',
  orangeStrong: '#ff8a3d',
  red: '#ff6e84',
  purple: '#8b5cf6',
  purpleBright: '#ba9eff',
  blue: '#68B8E8',
  charcoal: '#1F2933',
  gray: '#9898a6',
  graySoft: '#6f6f7a',
  white: '#FFFFFF',
  backgroundDark: '#0e0e0e',
  backgroundLight: '#FFFFFF',
} as const;

export type HoystTheme = ReturnType<typeof getHoystThemeColors>;

export function getHoystThemeColors(
  scheme: 'light' | 'dark' | 'unspecified' | null | undefined,
) {
  const isDark = scheme !== 'light';

  return {
    isDark,
    background: isDark ? brandColors.backgroundDark : '#F5F5F7',
    backgroundElevated: isDark ? '#121212' : '#FFFFFF',
    surface: isDark ? 'rgba(19, 19, 19, 0.94)' : 'rgba(255, 255, 255, 0.86)',
    surfaceStrong: isDark ? '#171717' : '#FFFFFF',
    surfaceMuted: isDark ? '#202020' : '#EEF1F4',
    surfaceSoft: isDark ? '#141414' : '#FAFAFA',
    surfaceHigh: isDark ? '#262626' : '#F1F3F5',
    text: isDark ? brandColors.white : brandColors.charcoal,
    textMuted: isDark ? brandColors.gray : '#75808A',
    textSubtle: isDark ? brandColors.graySoft : '#8a939b',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(31,41,51,0.08)',
    borderStrong: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(31,41,51,0.14)',
    ring: 'rgba(255,255,255,0.09)',
    shadow: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(15,23,42,0.14)',
    tint: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.54)',
    actionSurface: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
    actionBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(31,41,51,0.14)',
    actionForeground: isDark ? brandColors.white : brandColors.charcoal,
    actionShadowColor: isDark ? '#FFFFFF' : 'rgba(15,23,42,0.24)',
    actionShadowOpacity: isDark ? 0.1 : 0.14,
    tabActiveBackground: isDark
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(31,41,51,0.08)',
    tabActiveForeground: isDark ? brandColors.white : brandColors.charcoal,
    tabActiveShadowColor: isDark ? '#FFFFFF' : 'rgba(15,23,42,0.24)',
    tabActiveShadowOpacity: isDark ? 0.62 : 0.16,
    success: brandColors.green,
    warning: brandColors.orangeStrong,
    danger: brandColors.red,
    accent: brandColors.purple,
    accentSecondary: brandColors.purpleBright,
    accentTertiary: brandColors.blue,
    accentWarm: brandColors.orangeStrong,
    accentWarmSoft: brandColors.orange,
  };
}
