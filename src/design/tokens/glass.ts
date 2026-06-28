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
} as const;
