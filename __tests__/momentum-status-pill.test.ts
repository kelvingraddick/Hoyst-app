jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import type {MomentumStatus} from '../src/types/models';
import {getMomentumStatusPillPalette} from '../src/design/components/MomentumStatusPill';
import {getHoystThemeColors} from '../src/design/tokens/colors';

describe('MomentumStatusPill palette', () => {
  const theme = getHoystThemeColors('dark');

  it.each([
    [
      'getting_started',
      {
        backgroundColor: theme.surfaceHigh,
        color: theme.textMuted,
      },
    ],
    [
      'building_momentum',
      {
        backgroundColor: `${theme.warning}14`,
        color: theme.warningForeground,
      },
    ],
    [
      'strong_momentum',
      {
        backgroundColor: `${theme.accentTertiary}14`,
        color: theme.accentTertiaryForeground,
      },
    ],
    [
      'peak_momentum',
      {
        backgroundColor: `${theme.success}14`,
        color: theme.successForeground,
      },
    ],
  ] satisfies Array<[MomentumStatus, ReturnType<typeof getMomentumStatusPillPalette>]>)(
    'maps %s to its status palette',
    (status, palette) => {
      expect(getMomentumStatusPillPalette(status, theme)).toEqual(palette);
    },
  );
});
