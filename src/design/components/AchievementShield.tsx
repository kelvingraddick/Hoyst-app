import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
  type SvgProps,
} from 'react-native-svg';

import type {HomeAchievementTier} from '../../features/home/services/achievement-service';

type AchievementShieldProps = SvgProps & {
  label: string;
  size?: number;
  tier: HomeAchievementTier;
};

const tierVisuals: Record<
  HomeAchievementTier,
  {
    border: string;
    highlight: string;
    shadow: string;
    start: string;
    stop: string;
    text: string;
  }
> = {
  gold: {
    border: '#E08600',
    highlight: '#FFE9A8',
    shadow: '#B36A00',
    start: '#FFD54F',
    stop: '#FF9800',
    text: '#FFFFFF',
  },
  bronze: {
    border: '#9C5A2A',
    highlight: '#F4CFA8',
    shadow: '#7A431D',
    start: '#E3A878',
    stop: '#B96B33',
    text: '#FFFFFF',
  },
  starter: {
    border: '#8FA3C0',
    highlight: '#F2F7FD',
    shadow: '#6E84A3',
    start: '#DFE9F5',
    stop: '#ABBDD4',
    text: '#5B7194',
  },
};

function useGradientId(name: string) {
  return `${React.useId().replace(/[^a-zA-Z0-9]/g, '')}-${name}`;
}

export function AchievementShield({
  label,
  size = 34,
  tier,
  ...props
}: AchievementShieldProps): React.JSX.Element {
  const visual = tierVisuals[tier];
  const gradientId = useGradientId(`achievement-shield-${tier}`);

  return (
    <Svg height={size} viewBox="0 0 48 48" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="10" x2="38" y1="6" y2="44">
          <Stop offset="0" stopColor={visual.start} />
          <Stop offset="1" stopColor={visual.stop} />
        </LinearGradient>
      </Defs>
      <Path
        d="M24 3 41 9.4c.8.3 1.4 1.1 1.4 2v12.2c0 9.6-6.3 16.6-17.3 21.1a3 3 0 0 1-2.2 0C11.9 40.2 5.6 33.2 5.6 23.6V11.4c0-.9.6-1.7 1.4-2L24 3Z"
        fill={visual.border}
      />
      <Path
        d="M24 6.4 38.6 12v11.6c0 8-5.2 13.9-14.6 17.9-9.4-4-14.6-9.9-14.6-17.9V12L24 6.4Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M24 6.4 38.6 12v3.4L24 9.8 9.4 15.4V12L24 6.4Z"
        fill={visual.highlight}
        opacity={0.85}
      />
      <Path
        d="M24 41.5c9.4-4 14.6-9.9 14.6-17.9v-7.2l-22 22.4c2.2 1 4.6 1.9 7.4 2.7Z"
        fill={visual.shadow}
        opacity={0.22}
      />
      {label ? (
        <SvgText
          fill={visual.text}
          fontSize={15}
          fontWeight="800"
          textAnchor="middle"
          x={24}
          y={29.5}>
          {label}
        </SvgText>
      ) : (
        <Path
          d="m24 14 2.9 6 6.6 1-4.8 4.6 1.2 6.5L24 29l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-1 2.9-6Z"
          fill={visual.text}
        />
      )}
    </Svg>
  );
}
