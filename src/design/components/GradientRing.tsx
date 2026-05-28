import React from 'react';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';

import {gradients} from '../tokens/gradients';

type GradientRingProps = {
  flatColor?: string;
  size?: number;
  strokeWidth?: number;
  progress?: number;
  trackColor?: string;
};

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(1, progress));
}

export function GradientRing({
  flatColor,
  size = 96,
  strokeWidth = 10,
  progress = 1,
  trackColor = 'rgba(255,255,255,0.08)',
}: GradientRingProps): React.JSX.Element {
  const clampedProgress = clampProgress(progress);
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clampedProgress);

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
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {clampedProgress > 0 ? (
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
      ) : null}
    </Svg>
  );
}
