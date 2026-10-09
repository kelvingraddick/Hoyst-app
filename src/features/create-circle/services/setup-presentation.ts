import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getSystemTheme} from '../../../design/system/tokens';
import {brandColors, type HoystTheme} from '../../../design/tokens/colors';

// Setup opts into blue without changing the app's default theme or category palettes.
export function getSetupTheme(theme: HoystTheme) {
  const blue = getSystemTheme(theme.isDark ? 'dark' : 'light');
  return {
    ...theme,
    accent: blue.actionFill,
    accentForeground: blue.action,
    accentSecondary: brandColors.blue,
    accentSecondaryForeground: blue.action,
    accentTertiaryForeground: blue.action,
    setupTint: blue.category.blue.surface,
  };
}

export function useSetupTheme() {
  return getSetupTheme(useHoystTheme());
}
