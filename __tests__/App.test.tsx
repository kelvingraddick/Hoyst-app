import {
  brandColors,
  frostedBackdropColors,
  frostedBlobColors,
  getHoystThemeColors,
} from '../src/design/tokens/colors';
import {
  frostedBackdropLightBlobs,
  getFrostedBackdropBlobs,
} from '../src/design/components/FrostedBackdrop';
import {glass} from '../src/design/tokens/glass';
import {gradients} from '../src/design/tokens/gradients';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function hexToRgb(hex: string) {
  const normalizedHex = hex.replace('#', '');

  return [0, 2, 4].map(offset =>
    Number.parseInt(normalizedHex.slice(offset, offset + 2), 16),
  );
}

function getRelativeLuminance(hex: string) {
  const [red, green, blue] = hexToRgb(hex).map(value => {
    const channel = value / 255;

    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('Hoyst design tokens', () => {
  it('keeps the orange CTA token stable', () => {
    expect(brandColors.orange).toBe('#FF8A3D');
  });

  it('keeps saturated accent blob colors separate from backdrop washes', () => {
    expect(frostedBlobColors).toEqual({
      purple: '#7C6FF0',
      green: '#22A565',
      orange: '#F97316',
      blue: '#2F6FED',
    });
    expect(frostedBackdropColors).toEqual({
      purple: '#C8C2FF',
      mint: '#C7EBDD',
      peach: '#FFDCD2',
      blue: '#DCE6FF',
    });
  });

  it('matches the light Home backdrop blob layout to the reference', () => {
    expect(frostedBackdropLightBlobs).toEqual([
      {
        color: frostedBackdropColors.purple,
        cx: 0.12,
        cy: 0.27,
        opacity: 0.64,
        r: 0.38,
      },
      {
        color: frostedBackdropColors.mint,
        cx: 0.82,
        cy: 0.43,
        opacity: 0.68,
        r: 0.39,
      },
      {
        color: frostedBackdropColors.peach,
        cx: 0.22,
        cy: 0.59,
        opacity: 0.66,
        r: 0.37,
      },
      {
        color: frostedBackdropColors.blue,
        cx: 0.84,
        cy: 0.77,
        opacity: 0.72,
        r: 0.43,
      },
    ]);
  });

  it('can tint the top backdrop blob without changing Home defaults', () => {
    const tintedBlobs = getFrostedBackdropBlobs({
      isDark: false,
      topAccentColor: brandColors.blue,
    });

    expect(frostedBackdropLightBlobs[0].color).toBe(
      frostedBackdropColors.purple,
    );
    expect(tintedBlobs[0]).toEqual({
      ...frostedBackdropLightBlobs[0],
      color: brandColors.blue,
      opacity: 0.58,
    });
    expect(tintedBlobs.slice(1)).toEqual(frostedBackdropLightBlobs.slice(1));
  });

  it('defines the six-stop spectrum ring gradient', () => {
    expect(gradients.primaryRing).toHaveLength(6);
  });

  it('keeps dark glass tokens light enough for translucent Home sections', () => {
    const theme = getHoystThemeColors('dark');

    expect(theme.glassSurface).toBe('rgba(18,20,34,0.38)');
    expect(theme.glassSurfaceStrong).toBe('rgba(28,30,46,0.64)');
    expect(theme.glassBorder).toBe('rgba(255,255,255,0.20)');
    expect(theme.glassHighlight).toBe('rgba(255,255,255,0.18)');
    expect(theme.glassChipBorder).toBe('rgba(255,255,255,0.18)');
    expect(glass.darkHighlightGradientColors).toEqual([
      'rgba(255, 255, 255, 0.12)',
      'rgba(255, 255, 255, 0.04)',
      'rgba(255, 255, 255, 0.02)',
    ]);
    expect(glass.darkHighlightSheenHeight).toBe(2);
    expect(glass.darkCardHighlightSheenInset).toBe(24);
    expect(glass.darkPanelHighlightSheenInset).toBe(28);
    expect(glass.darkNavHighlightSheenInset).toBe(32);
    expect(glass.darkTabBarHighlightSheenInset).toBe(28);
    expect(glass.darkHighlightSheenTop).toBe(1);
  });

  it('keeps light-mode foreground tokens readable on app surfaces', () => {
    const theme = getHoystThemeColors('light');
    const appSurfaces = [
      theme.background,
      theme.backgroundElevated,
      theme.surfaceSoft,
      theme.surfaceHigh,
      theme.surfaceStrong,
    ];
    const foregroundTokens = [
      theme.textMuted,
      theme.textSubtle,
      theme.successForeground,
      theme.warningForeground,
      theme.dangerForeground,
      theme.accentForeground,
      theme.accentSecondaryForeground,
      theme.accentTertiaryForeground,
      theme.accentWarmForeground,
    ];

    foregroundTokens.forEach(foreground => {
      appSurfaces.forEach(background => {
        expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    });
  });

  it('keeps bright accent content readable on colored fills', () => {
    const theme = getHoystThemeColors('light');
    const brightFills = [
      brandColors.green,
      brandColors.orangeStrong,
      brandColors.red,
      brandColors.blue,
    ];

    brightFills.forEach(background => {
      expect(
        getContrastRatio(theme.onBrightAccent, background),
      ).toBeGreaterThanOrEqual(4.5);
    });

    [brandColors.purple, brandColors.purpleBright].forEach(background => {
      expect(
        getContrastRatio(theme.onPurpleAccent, background),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});
