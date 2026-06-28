import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, Defs, RadialGradient, Stop} from 'react-native-svg';

import {frostedBackdropColors, frostedBlobColors} from '../tokens/colors';
import {useHoystTheme} from '../theme/useHoystTheme';

type Blob = {
  color: string;
  cx: number;
  cy: number;
  opacity: number;
  r: number;
};

// Blob layouts are fractions of the backdrop so the glow positions hold across
// device sizes. Each blob is a soft radial glow the frosted glass refracts.
export const frostedBackdropLightBlobs: readonly Blob[] = [
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
];

const frostedBackdropDarkBlobs: readonly Blob[] = [
  {color: frostedBlobColors.purple, cx: 0.06, cy: 0.16, opacity: 0.34, r: 0.34},
  {color: frostedBlobColors.green, cx: 0.94, cy: 0.4, opacity: 0.28, r: 0.36},
  {color: frostedBlobColors.orange, cx: 0.2, cy: 0.64, opacity: 0.3, r: 0.34},
  {color: frostedBlobColors.blue, cx: 0.96, cy: 0.88, opacity: 0.26, r: 0.34},
];

function useGradientId(name: string) {
  return `${React.useId().replace(/[^a-zA-Z0-9]/g, '')}-${name}`;
}

type FrostedBackdropProps = {
  style?: StyleProp<ViewStyle>;
  topAccentColor?: string;
};

export function getFrostedBackdropBlobs({
  isDark,
  topAccentColor,
}: {
  isDark: boolean;
  topAccentColor?: string;
}): readonly Blob[] {
  const blobs = isDark ? frostedBackdropDarkBlobs : frostedBackdropLightBlobs;

  if (!topAccentColor) {
    return blobs;
  }

  return [
    {
      ...blobs[0],
      color: topAccentColor,
      opacity: isDark ? 0.34 : 0.58,
    },
    ...blobs.slice(1),
  ];
}

// Full-bleed background for frosted-glass screens: a flat themed base wash
// plus four soft color glows. Render it behind the screen content (absolute
// fill) so glass surfaces have something colorful to blur.
export function FrostedBackdrop({
  style,
  topAccentColor,
}: FrostedBackdropProps): React.JSX.Element {
  const theme = useHoystTheme();
  const gradientPrefix = useGradientId('blob');
  const blobs = getFrostedBackdropBlobs({
    isDark: theme.isDark,
    topAccentColor,
  });
  // Blobs read brighter on the pale light canvas; dim them on dark so they
  // glow rather than glare.
  const blobOpacityScale = theme.isDark ? 0.7 : 1;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: theme.background},
        style,
      ]}>
      <Svg
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 100 100"
        width="100%">
        <Defs>
          {blobs.map((blob, index) => (
            <RadialGradient
              cx="50%"
              cy="50%"
              id={`${gradientPrefix}-${index}`}
              key={`${gradientPrefix}-${index}`}
              r="50%">
              <Stop
                offset="0"
                stopColor={blob.color}
                stopOpacity={blob.opacity * blobOpacityScale}
              />
              <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((blob, index) => (
          <Circle
            cx={blob.cx * 100}
            cy={blob.cy * 100}
            fill={`url(#${gradientPrefix}-${index})`}
            key={`${gradientPrefix}-circle-${index}`}
            r={blob.r * 100}
          />
        ))}
      </Svg>
    </View>
  );
}
