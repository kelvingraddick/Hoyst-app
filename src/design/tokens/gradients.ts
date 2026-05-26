import {brandColors} from './colors';

export const gradients = {
  primaryRing: [
    brandColors.spectrumGreen,
    brandColors.spectrumYellow,
    brandColors.orangeStrong,
    '#FF1EA8',
    brandColors.purple,
    brandColors.blue,
  ],
  frostedHighlight: ['rgba(255,255,255,0.82)', 'rgba(255,255,255,0)'],
  sunriseCard: ['rgba(255,109,0,0.18)', 'rgba(90,28,255,0.08)'],
  warmAccent: [brandColors.orangeStrong, '#ffb36f'],
  purpleButton: [brandColors.purple, brandColors.purpleBright],
  greenGlow: ['rgba(16,185,103,0.24)', 'rgba(16,185,103,0.02)'],
  spectrumGlow: [
    'rgba(0,200,83,0.28)',
    'rgba(24,185,255,0.16)',
    'rgba(90,28,255,0.22)',
    'rgba(255,30,168,0.16)',
  ],
} as const;
