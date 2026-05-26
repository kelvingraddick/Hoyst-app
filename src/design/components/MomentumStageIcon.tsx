import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';

import type {MomentumStatus} from '../../types/models';

type MomentumStageIconProps = {
  size?: number;
  status: MomentumStatus;
  style?: StyleProp<ViewStyle>;
};

const iconColor = '#FFA300';
const iconColorDark = '#F08A00';
const highlightColor = '#FFFFFF';

function GettingStartedIcon() {
  return (
    <G>
      <Path
        d="M32 9 L35.6 20.4 L47 24 L35.6 27.6 L32 39 L28.4 27.6 L17 24 L28.4 20.4 Z"
        fill={iconColor}
      />
      <Path
        d="M17 36 L19 42 L25 44 L19 46 L17 52 L15 46 L9 44 L15 42 Z"
        fill={iconColorDark}
        opacity={0.82}
      />
      <Circle cx={45} cy={43} fill={iconColorDark} opacity={0.7} r={3} />
    </G>
  );
}

function BuildingMomentumIcon() {
  return (
    <G>
      <Rect
        fill={iconColor}
        height={17}
        rx={4}
        width={9}
        x={13}
        y={35}
      />
      <Rect
        fill={iconColor}
        height={25}
        rx={4}
        width={9}
        x={27.5}
        y={27}
      />
      <Rect
        fill={iconColorDark}
        height={34}
        rx={4}
        width={9}
        x={42}
        y={18}
      />
      <Path
        d="M14 26 C22 23 29 18 35 11"
        fill="none"
        stroke={iconColorDark}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M35 11 L35 22 L46 11 Z"
        fill={iconColorDark}
      />
    </G>
  );
}

function StrongMomentumIcon() {
  return (
    <G>
      <Path
        d="M31 55 C20 52 14 44 16 34 C17 27 22 23 27 18 C31 14 32 10 31 7 C42 13 47 23 44 33 C49 35 52 40 50 46 C48 53 40 57 31 55 Z"
        fill={iconColor}
      />
      <Path
        d="M32 49 C26 47 23 43 24 38 C25 34 28 31 31 28 C34 25 35 22 34 19 C41 25 43 32 39 39 C43 40 44 44 42 47 C40 51 36 52 32 49 Z"
        fill={highlightColor}
        opacity={0.88}
      />
      <Path
        d="M31 55 C40 57 48 53 50 46 C52 40 49 35 44 33 C47 23 42 13 31 7 C35 20 20 24 16 34 C14 44 20 52 31 55 Z"
        fill={iconColorDark}
        opacity={0.18}
      />
    </G>
  );
}

function PeakMomentumIcon() {
  return (
    <G>
      <Path
        d="M20 20 H44 V28 C44 40 39 47 32 47 C25 47 20 40 20 28 Z"
        fill={iconColor}
      />
      <Path
        d="M24 23 H40 V29 C40 38 37 43 32 43 C27 43 24 38 24 29 Z"
        fill="#FFC247"
      />
      <Path
        d="M20 24 H13 C12 24 11 25 11 26 V31 C11 39 16 43 23 43"
        fill="none"
        stroke={iconColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={6}
      />
      <Path
        d="M44 24 H51 C52 24 53 25 53 26 V31 C53 39 48 43 41 43"
        fill="none"
        stroke={iconColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={6}
      />
      <Path
        d="M32 47 V54"
        stroke={iconColorDark}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d="M23 56 H41"
        stroke={iconColorDark}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d="M27 62 H37"
        stroke={iconColor}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Polygon
        fill={highlightColor}
        points="32,27 34.1,31.1 38.7,31.8 35.4,35 36.2,39.6 32,37.4 27.8,39.6 28.6,35 25.3,31.8 29.9,31.1"
      />
      <Path
        d="M20 20 H44 V25 H20 Z"
        fill={iconColorDark}
        opacity={0.22}
      />
    </G>
  );
}

function renderStageIcon(status: MomentumStatus) {
  if (status === 'peak_momentum') {
    return <PeakMomentumIcon />;
  }

  if (status === 'strong_momentum') {
    return <StrongMomentumIcon />;
  }

  if (status === 'building_momentum') {
    return <BuildingMomentumIcon />;
  }

  return <GettingStartedIcon />;
}

export function MomentumStageIcon({
  size = 64,
  status,
  style,
}: MomentumStageIconProps): React.JSX.Element {
  const sizeStyle = {
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  return (
    <View style={[styles.wrap, sizeStyle, style]}>
      <Svg height={size * 0.72} viewBox="0 0 64 64" width={size * 0.72}>
        {renderStageIcon(status)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#FFF3DF',
    justifyContent: 'center',
  },
});
