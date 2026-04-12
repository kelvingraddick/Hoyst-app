const BRAND_RING_INNER_DIAMETER_RATIO = 382 / 512;
const AVATAR_RING_GAP = 2;

export function getBrandAvatarRingSize(innerSize: number): number {
  return (innerSize + AVATAR_RING_GAP * 2) / BRAND_RING_INNER_DIAMETER_RATIO;
}
