import {useColorScheme, type ColorSchemeName} from 'react-native';

import {getHoystThemeColors} from '../tokens/colors';
import {
  useSettingsStore,
  type AppearancePreference,
} from '../../store/settings-store';

export function resolveHoystThemeScheme(
  appearance: AppearancePreference,
  systemScheme: ColorSchemeName,
) {
  if (appearance === 'system') {
    return systemScheme;
  }

  return appearance;
}

export function useHoystTheme() {
  const systemScheme = useColorScheme();
  const appearance = useSettingsStore(state => state.appearance);
  const scheme = resolveHoystThemeScheme(appearance, systemScheme);

  return getHoystThemeColors(scheme);
}
