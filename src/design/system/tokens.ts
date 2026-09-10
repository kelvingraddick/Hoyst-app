import {Platform, type TextStyle} from 'react-native';

/** Opt-in v1. Home and legacy tokens deliberately do not import this module. */
export const systemVersion = '1.2.0';
export const typography = {
  screenTitle: {fontSize: 24, lineHeight: 29, fontWeight: '600'},
  heading: {fontSize: 18, lineHeight: 23, fontWeight: '600'},
  statistic: {fontSize: 18, lineHeight: 22, fontWeight: '600'},
  title: {fontSize: 16, lineHeight: 21, fontWeight: '600'},
  message: {fontSize: 15, lineHeight: 20, fontWeight: '400'},
  body: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
  action: {fontSize: 13, lineHeight: 18, fontWeight: '600'},
  secondary: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
  category: {fontSize: 11, lineHeight: 15, fontWeight: '600'},
  statCaption: {fontSize: 11, lineHeight: 15, fontWeight: '400'},
} as const satisfies Record<string, TextStyle>;
export type TextVariant = keyof typeof typography;
export const nativeFont = Platform.OS === 'ios' ? 'System' : undefined;
export const space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  spacious: 40,
} as const;
export const layout = {
  gutter: 22,
  sectionGap: 16,
  cardPadding: 12,
  supportingGap: 4,
  iconBackplate: 32,
  avatar: 24,
  controlIcon: 20,
  statIcon: 16,
  buttonVisualHeight: 32,
  controlHeight: 48,
} as const;
export const radii = {
  input: 12,
  statistics: 14,
  message: 18,
  card: 20,
  pill: 999,
} as const;
export function minimumTarget(platform: string = Platform.OS) {
  return platform === 'android' ? 48 : 44;
}
export const softShadow = {
  shadowOffset: {width: 0, height: 6},
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 3,
} as const;

// Saturated brand marks are separate from readable small-text foregrounds.
export const palette = {
  blue: '#18B9FF',
  purple: '#5A1CFF',
  green: '#10B967',
  orange: '#FF6D00',
  red: '#FF3B30',
} as const;
export type CategoryTone = 'blue' | 'purple' | 'green' | 'orange' | 'neutral';
export type SemanticTone =
  | 'text'
  | 'muted'
  | 'action'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger';
export type SystemScheme = 'light' | 'dark';

export function getSystemTheme(scheme: SystemScheme) {
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    canvas: isDark ? '#121212' : '#FAFAF7',
    surface: isDark ? '#242428' : '#FFFFFF',
    mutedSurface: isDark ? '#202024' : '#F1F1EE',
    text: isDark ? '#FFFFFF' : '#070B1A',
    muted: isDark ? '#B4BCD1' : '#4D5873',
    action: isDark ? '#8FE2FF' : '#086CA8',
    actionFill: '#086CA8',
    onAction: '#FFFFFF',
    progress: isDark ? '#B89FFF' : '#5A1CFF',
    success: isDark ? '#4BE083' : '#07763E',
    warning: isDark ? '#FF8A3D' : '#A83A00',
    danger: isDark ? '#FF6B63' : '#D21F18',
    border: isDark ? '#46464F' : '#D8D8DD',
    inputBorder: isDark ? '#8D96AD' : '#6C748C',
    track: isDark ? '#303036' : '#E9E9ED',
    shadow: isDark ? '#000000' : '#92723E',
    category: {
      blue: {
        surface: isDark ? '#133240' : '#E7F8FF',
        foreground: isDark ? '#8FE2FF' : '#086CA8',
      },
      purple: {
        surface: isDark ? '#29213E' : '#F0ECFF',
        foreground: isDark ? '#B8A5FF' : '#5A1CFF',
      },
      green: {
        surface: isDark ? '#122B1F' : '#E7F8EF',
        foreground: isDark ? '#70E2A3' : '#07763E',
      },
      orange: {
        surface: isDark ? '#38291F' : '#FFF0E6',
        foreground: isDark ? '#FFB36B' : '#A83A00',
      },
      neutral: {
        surface: isDark ? '#252A33' : '#EEF1F7',
        foreground: isDark ? '#B4BCD1' : '#4D5873',
      },
    },
  };
}
export type SystemTheme = ReturnType<typeof getSystemTheme>;
