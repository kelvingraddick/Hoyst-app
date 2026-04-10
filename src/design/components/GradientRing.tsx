import React from 'react';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';

import {gradients} from '../tokens/gradients';

type GradientRingProps = {
  flatColor?: string;
  size?: number;
  strokeWidth?: number;
  progress?: number;
};

export function GradientRing({
  flatColor,
  size = 96,
  strokeWidth = 10,
  progress = 1,
}: GradientRingProps): React.JSX.Element {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <Svg height={size} width={size}>
      <Defs>
        <LinearGradient id="hoystRing" x1="0%" x2="100%" y1="0%" y2="100%">
          {gradients.primaryRing.map((color, index) => (
            <Stop
              key={color}
              offset={`${(index / (gradients.primaryRing.length - 1)) * 100}%`}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="transparent"
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="transparent"
        r={radius}
        rotation="-90"
        originX={size / 2}
        originY={size / 2}
        stroke={flatColor ?? 'url(#hoystRing)'}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
