import React from 'react';
import Svg, {Circle, Path, type SvgProps} from 'react-native-svg';

type NudgeMarkProps = SvgProps & {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

export function NudgeMark({
  color = '#FFFFFF',
  size = 24,
  strokeWidth = 4.5,
  ...props
}: NudgeMarkProps): React.JSX.Element {
  return (
    <Svg fill="none" height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Circle
        cx={24}
        cy={19}
        r={10}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M10 52V44C10 35.7 16.7 29 25 29H30.5C37.1 29 42.8 33.3 44.6 39.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M42 35V26.5C42 24.3 43.8 22.5 46 22.5C48.2 22.5 50 24.3 50 26.5V37"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M50 34.5V31.5C50 29.6 51.6 28 53.5 28C55.4 28 57 29.6 57 31.5V43.6C57 46.3 55.7 48.8 53.6 50.4L47.1 55.2L37.1 47.8C35.5 46.6 35.1 44.4 36.3 42.8C37.4 41.3 39.5 40.9 41.1 41.9L44.7 44.3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M38 21.5L34.7 18.2M46 17V12.3M54 21.5L57.3 18.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
