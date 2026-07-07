import React from 'react';
import Svg, {Circle, Path, type SvgProps} from 'react-native-svg';

export type TabBarIconProps = SvgProps & {
  color?: string;
  fill?: string;
  focused?: boolean;
  secondaryColor?: string;
  size?: number | string;
  strokeWidth?: number;
};

// When an icon is selected, both the primary shape and its secondary accent
// adopt the active color. Icons that opt into fills use that same active color.
function getIconColors({
  color,
  fill,
  focused,
  secondaryColor,
}: {
  color: string;
  fill: string;
  focused?: boolean;
  secondaryColor?: string;
}) {
  const isSelected =
    focused === true || (fill !== 'none' && fill !== 'transparent');

  return {
    isSelected,
    primary: color,
    secondary: isSelected ? color : secondaryColor ?? color,
    fillPrimary: isSelected ? color : 'none',
  };
}

export function HomeTabIcon({
  color = 'currentColor',
  fill = 'none',
  focused,
  secondaryColor,
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const c = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Path
        d="M4.4 13.2 14 4.6l9.6 8.6V22a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.4 22z"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M11.2 23.4v-5.1c0-1.55 1.25-2.8 2.8-2.8s2.8 1.25 2.8 2.8v5.1"
        fill="none"
        stroke={c.secondary}
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
  focused,
  secondaryColor,
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const c = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Circle
        cx={14}
        cy={8.9}
        fill="none"
        r={5.25}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={9.3}
        cy={17.2}
        fill="none"
        r={5.25}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={18.7}
        cy={17.2}
        fill="none"
        r={5.25}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function ExploreTabIcon({
  color = 'currentColor',
  fill = 'none',
  focused,
  secondaryColor,
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const c = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Path
        d="m11.743 14.575-7.21 1.538a1.09 1.09 0 0 1-1.293-.819l-.627-2.508a1.248 1.248 0 0 1 .806-1.476l15.755-5.18"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="m15.82 13.705 5.054-1.078"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="m18.667 24.5-3.623-7.245"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M19.233 6.93a2.333 2.333 0 0 1 1.697-2.829l1.272-.317a1.167 1.167 0 0 1 1.414.848l1.768 7.07a1.167 1.167 0 0 1-.848 1.415l-1.272.317a2.333 2.333 0 0 1-2.829-1.697z"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="m7.184 10.072 1.3 5.199"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="m9.333 24.5 3.623-7.245"
        fill="none"
        stroke={c.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={14}
        cy={15.167}
        fill="none"
        r={2.333}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function MomentumTabIcon({
  color = 'currentColor',
  fill = 'none',
  focused,
  secondaryColor,
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const c = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Circle
        cx={14}
        cy={10.4}
        fill={c.fillPrimary}
        r={5.8}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M10.4 15.6 8.7 24.4l5.3-3.1 5.3 3.1-1.7-8.8"
        fill="none"
        stroke={c.secondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function ProfileTabIcon({
  color = 'currentColor',
  fill = 'none',
  focused,
  secondaryColor,
  size = 24,
  strokeWidth = 2,
  ...props
}: TabBarIconProps): React.JSX.Element {
  const c = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Circle
        cx={14}
        cy={9.6}
        fill={c.fillPrimary}
        r={4}
        stroke={c.primary}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M6.4 22.4c.6-4.4 3.5-7 7.6-7s7 2.6 7.6 7"
        fill="none"
        stroke={c.secondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
