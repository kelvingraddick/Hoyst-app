import {brandColors, getHoystThemeColors} from '../src/design/tokens/colors';
import {gradients} from '../src/design/tokens/gradients';

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

  it('defines the six-stop spectrum ring gradient', () => {
    expect(gradients.primaryRing).toHaveLength(6);
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
