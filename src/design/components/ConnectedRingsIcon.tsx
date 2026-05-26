import React from 'react';
import Svg, {Circle, type SvgProps} from 'react-native-svg';

type ConnectedRingsIconProps = SvgProps & {
  color?: string;
  size?: number | string;
  strokeWidth?: number;
};

export function ConnectedRingsIcon({
  color = 'currentColor',
  size = 24,
  strokeWidth = 2,
  ...props
}: ConnectedRingsIconProps): React.JSX.Element {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Circle
        cx={12}
        cy={7.5}
        r={4.35}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={8.25}
        cy={15.35}
        r={4.35}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={15.75}
        cy={15.35}
        r={4.35}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
