import {radius} from './radius';

export const glass = {
  opacityDark: 0.88,
  opacityLight: 0.92,
  borderWidth: 1,
  // v4 frosted glass: a slightly stronger blur than before so the color
  // blobs behind the surface read as soft, saturated light.
  blurAmount: 26,
  cardPadding: 18,
  compactPadding: 16,
  // Height of the bright sheen drawn along the top edge of each glass card.
  highlightHeight: 1.5,
  darkHighlightGradientColors: [
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.04)',
    'rgba(255, 255, 255, 0.02)',
  ],
  darkHighlightSheenHeight: 2,
  darkCardHighlightSheenInset: radius.lg,
  darkPanelHighlightSheenInset: 28,
  darkNavHighlightSheenInset: radius.xl,
  darkTabBarHighlightSheenInset: 28,
  darkHighlightSheenTop: 1,
} as const;
