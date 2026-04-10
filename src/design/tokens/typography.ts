export const typography = {
  display: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '800' as const,
  },
  largeTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  headline: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '500' as const,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700' as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  tiny: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800' as const,
  },
} as const;
