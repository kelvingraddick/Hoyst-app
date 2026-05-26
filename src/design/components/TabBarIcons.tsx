import React from 'react';
import Svg, {Circle, Path, Rect, type SvgProps} from 'react-native-svg';

export type TabBarIconProps = SvgProps & {
  color?: string;
  fill?: string;
  size?: number | string;
  strokeWidth?: number;
};

export function HomeTabIcon({
  color = 'currentColor',
  fill = 'none',
  size = 24,
  strokeWidth = 2.4,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const isFilled = fill !== 'none' && fill !== 'transparent';

  if (isFilled) {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size} {...props}>
        <Path
          d="M3.25 10.95 11.08 4.32a1.42 1.42 0 0 1 1.84 0l7.83 6.63c.5.42.2 1.23-.45 1.23H19v7.08c0 .77-.63 1.4-1.4 1.4h-3.36a.56.56 0 0 1-.56-.56v-4.66a1.68 1.68 0 0 0-3.36 0v4.66a.56.56 0 0 1-.56.56H6.4c-.77 0-1.4-.63-1.4-1.4v-7.08H3.7c-.65 0-.95-.81-.45-1.23Z"
          fill={fill}
        />
      </Svg>
    );
  }

  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path
        d="M4.85 11 11.08 5.72a1.42 1.42 0 0 1 1.84 0L19.15 11v7.78c0 .82-.67 1.49-1.49 1.49h-3.23v-4.94a2.43 2.43 0 0 0-4.86 0v4.94H6.34c-.82 0-1.49-.67-1.49-1.49V11Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3.2 12.1 11.08 5.56a1.42 1.42 0 0 1 1.84 0l7.88 6.54"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function CirclesTabIcon({
  color = 'currentColor',
  size = 24,
  strokeWidth = 2.4,
  ...props
}: TabBarIconProps): React.JSX.Element {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Circle
        cx={12}
        cy={7.35}
        r={3.72}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={8.45}
        cy={15.55}
        r={3.72}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={15.55}
        cy={15.55}
        r={3.72}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function MomentumTabIcon({
  color = 'currentColor',
  size = 24,
  strokeWidth = 2.4,
  ...props
}: TabBarIconProps): React.JSX.Element {
  return (
    <Svg fill="none" height={size} viewBox="0 0 26 24" width={size} {...props}>
      <Rect
        height={5.2}
        rx={1.8}
        stroke={color}
        strokeWidth={strokeWidth}
        width={3.25}
        x={3.15}
        y={15.35}
      />
      <Rect
        height={9.2}
        rx={1.8}
        stroke={color}
        strokeWidth={strokeWidth}
        width={3.25}
        x={9.2}
        y={11.35}
      />
      <Rect
        height={13.2}
        rx={1.8}
        stroke={color}
        strokeWidth={strokeWidth}
        width={3.25}
        x={15.25}
        y={7.35}
      />
      <Rect
        height={16.2}
        rx={1.8}
        stroke={color}
        strokeWidth={strokeWidth}
        width={3.25}
        x={21.3}
        y={4.35}
      />
    </Svg>
  );
}

export function ProfileTabIcon({
  color = 'currentColor',
  size = 24,
  strokeWidth = 2.4,
  ...props
}: TabBarIconProps): React.JSX.Element {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Circle
        cx={12}
        cy={7.35}
        r={3.28}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M4.6 20.15v-1.1c0-3.82 3.05-6.75 7.4-6.75s7.4 2.93 7.4 6.75v1.1"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
