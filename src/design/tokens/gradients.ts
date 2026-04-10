import {brandColors} from './colors';

export const gradients = {
  primaryRing: [
    brandColors.green,
    brandColors.orangeStrong,
    brandColors.purple,
    brandColors.blue,
  ],
  sunriseCard: ['rgba(255,154,88,0.26)', 'rgba(139,92,246,0.1)'],
  orangeButton: [brandColors.orangeStrong, '#ffb36f'],
  purpleButton: [brandColors.purple, brandColors.purpleBright],
  greenGlow: ['rgba(68,216,92,0.24)', 'rgba(68,216,92,0.02)'],
} as const;
