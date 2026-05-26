import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, G, Path, Polygon, Rect} from 'react-native-svg';

import {brandColors} from '../tokens/colors';

export type OverviewStatusIconKind =
  | 'completedToday'
  | 'needsTap'
  | 'onTrack'
  | 'pending';

type OverviewStatusIconProps = {
  kind: OverviewStatusIconKind;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type IconVisual = {
  backplateColor: string;
  highlightColor: string;
  primaryColor: string;
  secondaryColor: string;
  shadowColor: string;
};

type IconArtworkProps = {
  visual: IconVisual;
};

const visuals: Record<OverviewStatusIconKind, IconVisual> = {
  completedToday: {
    backplateColor: '#F0ECFF',
    highlightColor: '#D6CCFF',
    primaryColor: brandColors.purpleBright,
    secondaryColor: brandColors.purple,
    shadowColor: '#3C0EB4',
  },
  needsTap: {
    backplateColor: '#F0ECFF',
    highlightColor: '#CDBDFF',
    primaryColor: brandColors.purple,
    secondaryColor: brandColors.purpleBright,
    shadowColor: '#351091',
  },
  onTrack: {
    backplateColor: '#E7F8EF',
    highlightColor: '#8EE9B8',
    primaryColor: brandColors.green,
    secondaryColor: '#07763E',
    shadowColor: '#064C2A',
  },
  pending: {
    backplateColor: '#FFF2D8',
    highlightColor: '#FFE2A3',
    primaryColor: '#FFB000',
    secondaryColor: brandColors.orangeStrong,
    shadowColor: '#A83A00',
  },
};

function NeedsTapArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M37 6 L16 36 H30 L24 58 L49 25 H35 Z"
        fill={visual.primaryColor}
      />
      <Path
        d="M37 6 L31 28 H41 L28 51 L49 25 H35 Z"
        fill={visual.secondaryColor}
        opacity={0.46}
      />
      <Path
        d="M26 18 L19 32 H29"
        fill="none"
        opacity={0.88}
        stroke={visual.highlightColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
      <Circle cx={44} cy={44} fill={visual.shadowColor} opacity={0.24} r={4} />
    </G>
  );
}

function PendingArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Rect
        fill="#FFF8EA"
        height={38}
        rx={8}
        stroke={visual.primaryColor}
        strokeWidth={4}
        width={42}
        x={11}
        y={15}
      />
      <Path d="M13 27 H51" stroke={visual.primaryColor} strokeWidth={5} />
      <Path
        d="M22 10 V20 M42 10 V20"
        stroke={visual.secondaryColor}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Rect
        fill={visual.highlightColor}
        height={6}
        rx={3}
        width={7}
        x={20}
        y={34}
      />
      <Rect
        fill={visual.highlightColor}
        height={6}
        rx={3}
        width={7}
        x={31}
        y={34}
      />
      <Circle
        cx={42}
        cy={43}
        fill="#FFF8EA"
        r={10}
        stroke={visual.secondaryColor}
        strokeWidth={4}
      />
      <Path
        d="M42 37 V43 L47 46"
        fill="none"
        stroke={visual.shadowColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3.4}
      />
    </G>
  );
}

function OnTrackArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M15 48 C22 47 29 43 35 36 C41 29 45 22 49 14"
        fill="none"
        stroke={visual.highlightColor}
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d="M18 45 L46 17"
        fill="none"
        stroke={visual.primaryColor}
        strokeLinecap="round"
        strokeWidth={7}
      />
      <Path
        d="M34 17 H47 V30"
        fill="none"
        stroke={visual.primaryColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={7}
      />
      <Path
        d="M18 45 L32 31"
        fill="none"
        opacity={0.34}
        stroke={visual.shadowColor}
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Circle cx={16} cy={48} fill={visual.secondaryColor} opacity={0.55} r={3} />
    </G>
  );
}

function CompletedTodayArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Polygon
        fill={visual.primaryColor}
        points="32,8 38.8,23 55,24.5 42.8,35.1 46.4,51 32,42.8 17.6,51 21.2,35.1 9,24.5 25.2,23"
      />
      <Path
        d="M32 8 L38.8 23 L55 24.5 L42.8 35.1 L46.4 51 L32 42.8 Z"
        fill={visual.secondaryColor}
        opacity={0.28}
      />
      <Path
        d="M28 23 L32 15 L36 23"
        fill="none"
        opacity={0.76}
        stroke={visual.highlightColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
      <Circle cx={48} cy={16} fill={visual.highlightColor} opacity={0.86} r={3} />
      <Circle cx={15} cy={42} fill={visual.shadowColor} opacity={0.18} r={4} />
    </G>
  );
}

function renderArtwork(kind: OverviewStatusIconKind, visual: IconVisual) {
  if (kind === 'completedToday') {
    return <CompletedTodayArtwork visual={visual} />;
  }

  if (kind === 'onTrack') {
    return <OnTrackArtwork visual={visual} />;
  }

  if (kind === 'pending') {
    return <PendingArtwork visual={visual} />;
  }

  return <NeedsTapArtwork visual={visual} />;
}

export function OverviewStatusIcon({
  kind,
  size = 44,
  style,
}: OverviewStatusIconProps): React.JSX.Element {
  const visual = visuals[kind];
  const sizeStyle = {
    backgroundColor: visual.backplateColor,
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  return (
    <View style={[styles.wrap, sizeStyle, style]}>
      <Svg height={size * 0.72} viewBox="0 0 64 64" width={size * 0.72}>
        {renderArtwork(kind, visual)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
