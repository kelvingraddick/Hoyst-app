export const brandColors = {
  green: '#10B967',
  spectrumGreen: '#00C853',
  spectrumYellow: '#FFC400',
  orange: '#FF8A3D',
  orangeStrong: '#FF6D00',
  red: '#FF3B30',
  purple: '#5A1CFF',
  purpleBright: '#7A55FF',
  blue: '#18B9FF',
  blueVivid: '#2F6FED',
  charcoal: '#070B1A',
  gray: '#B4BCD1',
  graySoft: '#6C748C',
  white: '#FFFFFF',
  backgroundDark: '#090B12',
  backgroundLight: '#F4F3FB',
} as const;

// Saturated accent colors used by foreground progress bars and brand glows.
export const frostedBlobColors = {
  purple: '#7C6FF0',
  green: '#22A565',
  orange: '#F97316',
  blue: '#2F6FED',
} as const;

// Light-mode backdrop washes matched to the Home frosted-glass reference.
export const frostedBackdropColors = {
  purple: '#C8C2FF',
  mint: '#C7EBDD',
  peach: '#FFDCD2',
  blue: '#DCE6FF',
} as const;

export type HoystTheme = ReturnType<typeof getHoystThemeColors>;

export function getHoystThemeColors(
  scheme: 'light' | 'dark' | 'unspecified' | null | undefined,
) {
  const isDark = scheme !== 'light';

  return {
    isDark,
    background: isDark
      ? brandColors.backgroundDark
      : brandColors.backgroundLight,
    backgroundElevated: isDark ? '#10131F' : '#FFFFFF',
    surface: isDark ? 'rgba(18,20,30,0.88)' : 'rgba(255,255,255,0.92)',
    surfaceStrong: isDark ? '#151827' : '#FFFFFF',
    // Opaque app-wide panel fill. The FrostedBackdrop remains visible around
    // panels without showing through their content surfaces.
    panelSurface: isDark ? '#222638' : '#FFFFFF',
    // Translucent neutral fill used by Home surfaces such as the Hoy bubble.
    neutralSurface: isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(226,232,240,0.72)',
    // Opaque equivalent of neutralSurface over the Home canvas. Floating
    // navigation must not reveal changing screen content beneath it.
    tabBarSurface: isDark ? '#202020' : '#FAFAF7',
    // Translucent supporting controls that are not part of the panel system.
    glassSurfaceStrong: isDark
      ? 'rgba(28,30,46,0.64)'
      : 'rgba(255,255,255,0.72)',
    glassBorder: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.65)',
    glassShadow: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(60,50,120,0.14)',
    glassChipBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)',
    surfaceMuted: isDark ? '#222638' : '#EEF1F7',
    surfaceSoft: isDark ? '#111420' : '#F9FAFE',
    surfaceHigh: isDark ? '#252A3D' : '#F1F3FA',
    text: isDark ? brandColors.white : brandColors.charcoal,
    textMuted: isDark ? brandColors.gray : '#4D5873',
    textSubtle: isDark ? '#8D96AD' : '#5B657C',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(16,24,40,0.08)',
    borderStrong: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(16,24,40,0.14)',
    ring: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(16,24,40,0.08)',
    shadow: isDark ? 'rgba(0,0,0,0.46)' : 'rgba(15,23,42,0.16)',
    tint: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
    actionSurface: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
    actionBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(16,24,40,0.12)',
    actionForeground: isDark ? brandColors.white : brandColors.charcoal,
    actionShadowColor: isDark ? '#000000' : 'rgba(15,23,42,0.22)',
    actionShadowOpacity: isDark ? 0.36 : 0.16,
    tabActiveBackground: isDark
      ? 'rgba(90,28,255,0.16)'
      : 'rgba(90,28,255,0.10)',
    tabActiveForeground: isDark ? brandColors.purpleBright : brandColors.purple,
    tabActiveShadowColor: isDark
      ? brandColors.purpleBright
      : brandColors.purple,
    tabActiveShadowOpacity: isDark ? 0.28 : 0.18,
    success: brandColors.green,
    successForeground: isDark ? '#4BE083' : '#07763E',
    warning: brandColors.orangeStrong,
    warningForeground: isDark ? '#FF8A3D' : '#A83A00',
    danger: brandColors.red,
    dangerForeground: isDark ? '#FF6B63' : '#D21F18',
    accent: brandColors.purple,
    accentForeground: isDark ? brandColors.purpleBright : brandColors.purple,
    accentSecondary: brandColors.purpleBright,
    accentSecondaryForeground: isDark
      ? brandColors.purpleBright
      : brandColors.purple,
    accentTertiary: brandColors.blue,
    accentTertiaryForeground: isDark ? brandColors.blue : '#086CA8',
    accentWarm: brandColors.orangeStrong,
    accentWarmForeground: isDark ? '#FF8A3D' : '#A83A00',
    accentWarmSoft: brandColors.orange,
    onBrightAccent: brandColors.backgroundDark,
    onPurpleAccent: brandColors.white,
  };
}
