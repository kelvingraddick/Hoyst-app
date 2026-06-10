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
    primary: color,
    secondary: isSelected ? color : secondaryColor ?? color,
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
  const iconColors = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Path
        d="M3.85 13.55 13.02 4.2a1.33 1.33 0 0 1 1.96 0l9.17 9.35"
        stroke={iconColors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5.85 12.95v9.32c0 .9.73 1.63 1.63 1.63h13.04c.9 0 1.63-.73 1.63-1.63v-9.32"
        stroke={iconColors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M11.2 23.9v-5.82c0-1.46 1.18-2.64 2.8-2.64s2.8 1.18 2.8 2.64v5.82"
        stroke={iconColors.secondary}
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
  const iconColors = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Path
        d="M11.4 9.55 8.15 17.75M16.6 9.55l3.25 8.2M10.3 21h7.4"
        stroke={iconColors.secondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={14}
        cy={7}
        r={3}
        stroke={iconColors.primary}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={7.2}
        cy={21}
        r={3}
        stroke={iconColors.primary}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={20.8}
        cy={21}
        r={3}
        stroke={iconColors.primary}
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
  const iconColors = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Path
        d="M10.2 18.85 8.9 24l4.08-2.38M17.8 18.85 19.1 24l-4.08-2.38"
        stroke={iconColors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M14 4 16 6.06l2.76-.2.78 2.68 2.34 1.47-1.08 2.58.74 2.7-2.52 1.12-1.45 2.4-2.72-.46L14 20.98l-1.85-2.63-2.72.46-1.45-2.4-2.52-1.12.74-2.7-1.08-2.58 2.34-1.47.78-2.68 2.76.2L14 4Z"
        stroke={iconColors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={14}
        cy={12.5}
        r={4.5}
        stroke={iconColors.secondary}
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
  const iconColors = getIconColors({color, fill, focused, secondaryColor});

  return (
    <Svg fill="none" height={size} viewBox="0 0 28 28" width={size} {...props}>
      <Circle
        cx={14}
        cy={14}
        r={10}
        stroke={iconColors.secondary}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={14}
        cy={10.55}
        r={2.75}
        stroke={iconColors.primary}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M8.65 20.65c.8-3.2 2.72-4.8 5.35-4.8 2.64 0 4.56 1.6 5.36 4.8"
        stroke={iconColors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
