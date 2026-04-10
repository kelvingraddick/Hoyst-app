import {useColorScheme} from 'react-native';

import {getHoystThemeColors} from '../tokens/colors';

export function useHoystTheme() {
  const scheme = useColorScheme();

  return getHoystThemeColors(scheme);
}
