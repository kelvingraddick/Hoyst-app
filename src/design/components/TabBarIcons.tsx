import React from 'react';
import Svg, {Circle, Path, Rect, type SvgProps} from 'react-native-svg';

const selectedFillOpacity = 0.18;

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
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const isFilled = fill !== 'none' && fill !== 'transparent';

  if (isFilled) {
    return (
      <Svg
        fill="none"
        height={size}
        viewBox="0 0 24 24"
        width={size}
        {...props}>
        <Path
          d="M3.38 12.04 11.12 5.8a1.36 1.36 0 0 1 1.76 0l7.74 6.24h-1.57v6.53c0 .84-.68 1.52-1.52 1.52H14.6v-4.66a2.6 2.6 0 0 0-5.2 0v4.66H6.47c-.84 0-1.52-.68-1.52-1.52v-6.53H3.38Z"
          fill={fill}
          fillOpacity={selectedFillOpacity}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path
        d="M4.95 11.15 11.12 5.8a1.36 1.36 0 0 1 1.76 0l6.17 5.35v7.42c0 .84-.68 1.52-1.52 1.52H14.6v-4.66a2.6 2.6 0 0 0-5.2 0v4.66H6.47c-.84 0-1.52-.68-1.52-1.52v-7.42Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3.38 12.04 11.12 5.8a1.36 1.36 0 0 1 1.76 0l7.74 6.24"
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
  fill = 'none',
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const isFilled = fill !== 'none' && fill !== 'transparent';

  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Circle
        cx={12}
        cy={8.55}
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        r={4.15}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={8.65}
        cy={14.4}
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        r={4.15}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={15.35}
        cy={14.4}
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        r={4.15}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function MomentumTabIcon({
  color = 'currentColor',
  fill = 'none',
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const isFilled = fill !== 'none' && fill !== 'transparent';

  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Rect
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        height={5}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        width={2.5}
        x={4.2}
        y={15.25}
      />
      <Rect
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        height={8.55}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        width={2.5}
        x={8.55}
        y={11.7}
      />
      <Rect
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        height={12.1}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        width={2.5}
        x={12.9}
        y={8.15}
      />
      <Rect
        fill={isFilled ? fill : 'none'}
        fillOpacity={isFilled ? selectedFillOpacity : 1}
        height={15.65}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        width={2.5}
        x={17.25}
        y={4.6}
      />
    </Svg>
  );
}

export function ProfileTabIcon({
  color = 'currentColor',
  fill = 'none',
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const isFilled = fill !== 'none' && fill !== 'transparent';

  if (isFilled) {
    return (
      <Svg
        fill="none"
        height={size}
        viewBox="0 0 24 24"
        width={size}
        {...props}>
        <Circle
          cx={12}
          cy={7.25}
          fill={fill}
          fillOpacity={selectedFillOpacity}
          r={3.05}
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M5.45 20.15c.24-4.1 2.78-6.4 6.55-6.4s6.31 2.3 6.55 6.4c.02.32-.24.6-.56.6H6.01a.56.56 0 0 1-.56-.6Z"
          fill={fill}
          fillOpacity={selectedFillOpacity}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Circle
        cx={12}
        cy={7.25}
        r={3.05}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5.45 20.15c.24-4.1 2.78-6.4 6.55-6.4s6.31 2.3 6.55 6.4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
