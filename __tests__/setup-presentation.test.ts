import {getSetupTheme} from '../src/features/create-circle/services/setup-presentation';
import {getHoystThemeColors, brandColors} from '../src/design/tokens/colors';
import {palettes} from '../src/shared/commitment-appearance';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

it.each(['light', 'dark'] as const)(
  'opts into readable blue in %s without changing global or category colors',
  scheme => {
    const original = getHoystThemeColors(scheme);
    const snapshot = {...original};
    const setup = getSetupTheme(original);
    expect(setup).toMatchObject({
      accent: '#086CA8',
      accentForeground: scheme === 'dark' ? '#8FE2FF' : '#086CA8',
      accentSecondary: brandColors.blue,
      setupTint: scheme === 'dark' ? '#133240' : '#E7F8FF',
    });
    expect(original).toEqual(snapshot);
    expect(getHoystThemeColors(scheme).accent).toBe(brandColors.purple);
    expect(setup.text).toBe(original.text);
    expect(setup.surface).toBe(original.surface);
    expect(setup.success).toBe(original.success);
    expect(setup.warning).toBe(original.warning);
    expect(setup.danger).toBe(original.danger);
    expect(palettes.purple.foreground).toBe('#5A1CFF');
  },
);
