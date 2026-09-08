import {brandColors, type HoystTheme} from '../design/tokens/colors';

export function getAppTabBarColors(theme: Pick<HoystTheme, 'isDark' | 'text'>) {
  return {
    activeIcon: brandColors.blue,
    inactiveIcon: theme.isDark ? brandColors.gray : brandColors.graySoft,
    label: theme.text,
  };
}
