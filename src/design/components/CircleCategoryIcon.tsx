import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, G, Path, Rect} from 'react-native-svg';

import {useHoystTheme} from '../theme/useHoystTheme';
import {brandColors, type HoystTheme} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {typography} from '../tokens/typography';
import {HoystText} from './HoystText';

export type CircleCategoryTone =
  | 'blue'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'purple';

type CircleCategoryKey =
  | 'custom'
  | 'deepWork'
  | 'fitness'
  | 'general'
  | 'sobriety'
  | 'wellness'
  | 'writing';

export type CircleCategoryVisual = {
  accentColor: string;
  accentDark: string;
  accentLight: string;
  backplateColor: string;
  foregroundColor: string;
  isFallback: boolean;
  key: CircleCategoryKey;
  label: string;
  tone: CircleCategoryTone;
};

type CircleCategoryIconProps = {
  category: string;
  shape?: 'circle' | 'roundedSquare';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type CircleCategoryPillProps = {
  category: string;
  iconSize?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
  uppercase?: boolean;
};

type IconArtworkProps = {
  visual: CircleCategoryVisual;
};

const categoryPillIconSize = 16;
const chipVerticalPadding = 7;
const categoryPillHeight = typography.tiny.lineHeight + chipVerticalPadding * 2;

const categoryVisuals: Record<CircleCategoryKey, CircleCategoryVisual> = {
  custom: {
    accentColor: brandColors.purpleBright,
    accentDark: brandColors.purple,
    accentLight: '#FF7AD8',
    backplateColor: '#F0ECFF',
    foregroundColor: brandColors.purple,
    isFallback: false,
    key: 'custom',
    label: 'Custom',
    tone: 'purple',
  },
  deepWork: {
    accentColor: brandColors.blue,
    accentDark: '#086CA8',
    accentLight: '#8FE2FF',
    backplateColor: '#E7F8FF',
    foregroundColor: '#086CA8',
    isFallback: false,
    key: 'deepWork',
    label: 'Deep Work',
    tone: 'blue',
  },
  fitness: {
    accentColor: brandColors.green,
    accentDark: '#07763E',
    accentLight: '#70E2A3',
    backplateColor: '#E7F8EF',
    foregroundColor: '#07763E',
    isFallback: false,
    key: 'fitness',
    label: 'Fitness',
    tone: 'green',
  },
  general: {
    accentColor: brandColors.graySoft,
    accentDark: '#4D5873',
    accentLight: brandColors.gray,
    backplateColor: '#EEF1F7',
    foregroundColor: '#4D5873',
    isFallback: false,
    key: 'general',
    label: 'General',
    tone: 'neutral',
  },
  sobriety: {
    accentColor: brandColors.orangeStrong,
    accentDark: '#A83A00',
    accentLight: '#FFB36B',
    backplateColor: '#FFF0E6',
    foregroundColor: '#A83A00',
    isFallback: false,
    key: 'sobriety',
    label: 'Sobriety',
    tone: 'orange',
  },
  wellness: {
    accentColor: brandColors.purpleBright,
    accentDark: brandColors.purple,
    accentLight: '#B8A5FF',
    backplateColor: '#F0ECFF',
    foregroundColor: brandColors.purple,
    isFallback: false,
    key: 'wellness',
    label: 'Wellness',
    tone: 'purple',
  },
  writing: {
    accentColor: brandColors.blue,
    accentDark: '#086CA8',
    accentLight: brandColors.spectrumYellow,
    backplateColor: '#E7F8FF',
    foregroundColor: '#086CA8',
    isFallback: false,
    key: 'writing',
    label: 'Writing',
    tone: 'blue',
  },
};

const categoryAliases: Record<string, CircleCategoryKey> = {
  custom: 'custom',
  deepwork: 'deepWork',
  fitness: 'fitness',
  general: 'general',
  sobriety: 'sobriety',
  wellness: 'wellness',
  writing: 'writing',
};

function normalizeCategoryKey(category: string) {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function getCircleCategoryVisual(
  category: string,
): CircleCategoryVisual {
  const normalizedKey = normalizeCategoryKey(category);
  const categoryKey = categoryAliases[normalizedKey];

  if (categoryKey) {
    return categoryVisuals[categoryKey];
  }

  return {
    ...categoryVisuals.general,
    isFallback: normalizedKey !== 'general',
  };
}

export function getCircleCategoryForegroundColor(
  category: string,
  theme: HoystTheme,
) {
  const visual = getCircleCategoryVisual(category);

  if (visual.tone === 'neutral') {
    return theme.textMuted;
  }

  return theme.isDark ? visual.accentLight : visual.foregroundColor;
}

function FitnessArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M13 42 C20 31 31 24 48 21"
        fill="none"
        stroke={visual.accentLight}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Rect
        fill={visual.accentColor}
        height={20}
        rx={4}
        width={9}
        x={8}
        y={24}
      />
      <Rect
        fill={visual.accentDark}
        height={26}
        rx={4}
        width={10}
        x={17}
        y={21}
      />
      <Rect
        fill={visual.accentDark}
        height={8}
        rx={4}
        width={18}
        x={23}
        y={30}
      />
      <Rect
        fill={visual.accentDark}
        height={26}
        rx={4}
        width={10}
        x={38}
        y={21}
      />
      <Rect
        fill={visual.accentColor}
        height={20}
        rx={4}
        width={9}
        x={48}
        y={24}
      />
      <Circle cx={49} cy={19} fill="#FFFFFF" opacity={0.92} r={3.6} />
    </G>
  );
}

function WellnessArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M32 55 C22 51 17 43 18 34 C19 27 24 23 29 18 C33 14 34 10 33 7 C43 13 48 22 45 32 C50 35 51 42 48 48 C45 54 38 57 32 55 Z"
        fill={visual.accentColor}
      />
      <Path
        d="M33 48 C28 46 25 42 26 38 C27 35 29 32 32 30 C35 27 36 24 35 21 C40 26 41 32 38 38 C42 40 42 44 40 47 C38 50 35 50 33 48 Z"
        fill="#FFFFFF"
        opacity={0.86}
      />
      <Path
        d="M18 35 C22 25 33 18 46 18 C45 31 37 40 25 43"
        fill={visual.accentDark}
        opacity={0.26}
      />
      <Path
        d="M23 40 C29 35 35 28 40 20"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeWidth={4}
        opacity={0.82}
      />
    </G>
  );
}

function DeepWorkArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Rect
        fill={visual.accentColor}
        height={40}
        rx={6}
        width={34}
        x={15}
        y={13}
      />
      <Path
        d="M21 19 H31 C33 19 34.5 20.5 34.5 22.5 V49 H23 C21.9 49 21 48.1 21 47 Z"
        fill="#FFFFFF"
        opacity={0.86}
      />
      <Path
        d="M34.5 22.5 C34.5 20.5 36 19 38 19 H43 V47 C43 48.1 42.1 49 41 49 H34.5 Z"
        fill="#FFFFFF"
        opacity={0.64}
      />
      <Path
        d="M34.5 22 V50"
        fill="none"
        stroke={visual.accentDark}
        strokeLinecap="round"
        strokeWidth={3.8}
      />
      <Path
        d="M48 11 L50 17 L56 19 L50 21 L48 27 L46 21 L40 19 L46 17 Z"
        fill={brandColors.spectrumYellow}
      />
      <Path
        d="M23 29 H30 M23 36 H30"
        fill="none"
        stroke={visual.accentDark}
        strokeLinecap="round"
        strokeWidth={3.4}
      />
    </G>
  );
}

function SobrietyArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M32 8 L49 15 V29 C49 43 41.5 51.5 32 56 C22.5 51.5 15 43 15 29 V15 Z"
        fill={visual.accentColor}
      />
      <Path
        d="M32 15 L43 20 V30 C43 39.5 38.5 45.5 32 49 C25.5 45.5 21 39.5 21 30 V20 Z"
        fill="#FFFFFF"
        opacity={0.9}
      />
      <Path
        d="M25 33 L30 38 L40 26"
        fill="none"
        stroke={visual.accentDark}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={5.5}
      />
      <Path
        d="M15 15 L32 8 L49 15 V22 H15 Z"
        fill={visual.accentDark}
        opacity={0.18}
      />
    </G>
  );
}

function CustomArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M32 9 L36 22 L49 26 L36 30 L32 43 L28 30 L15 26 L28 22 Z"
        fill={visual.accentColor}
      />
      <Path
        d="M19 36 L21.6 44 L30 47 L21.6 50 L19 58 L16.4 50 L8 47 L16.4 44 Z"
        fill={visual.accentLight}
      />
      <Path
        d="M48 39 L50 45 L56 47 L50 49 L48 55 L46 49 L40 47 L46 45 Z"
        fill={visual.accentDark}
        opacity={0.86}
      />
      <Circle cx={46} cy={14} fill="#FFFFFF" opacity={0.86} r={3} />
    </G>
  );
}

function WritingArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Rect
        fill="#FFFFFF"
        height={38}
        rx={5}
        width={29}
        x={16}
        y={12}
        opacity={0.92}
      />
      <Path
        d="M23 23 H38 M23 31 H36 M23 39 H31"
        fill="none"
        stroke={visual.accentDark}
        strokeLinecap="round"
        strokeWidth={3.5}
      />
      <Path
        d="M33 47 L50 30 C52 28 52 25 50 23 L48 21 C46 19 43 19 41 21 L24 38 L22 50 Z"
        fill={visual.accentColor}
      />
      <Path
        d="M41 21 L50 30"
        fill="none"
        stroke={visual.accentLight}
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path d="M22 50 L30 48 L24 42 Z" fill={visual.accentDark} />
    </G>
  );
}

function GeneralArtwork({visual}: IconArtworkProps) {
  return (
    <G>
      <Path
        d="M27 28 L37 36 M37 28 L27 36"
        fill="none"
        stroke={visual.accentLight}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Circle cx={22} cy={24} fill={visual.accentColor} r={10} />
      <Circle cx={42} cy={24} fill={visual.accentDark} r={10} />
      <Circle cx={32} cy={42} fill={visual.accentColor} opacity={0.86} r={10} />
      <Circle cx={22} cy={24} fill="#FFFFFF" opacity={0.24} r={5} />
      <Circle cx={42} cy={24} fill="#FFFFFF" opacity={0.2} r={5} />
    </G>
  );
}

function renderCategoryArtwork(visual: CircleCategoryVisual) {
  if (visual.key === 'fitness') {
    return <FitnessArtwork visual={visual} />;
  }

  if (visual.key === 'wellness') {
    return <WellnessArtwork visual={visual} />;
  }

  if (visual.key === 'deepWork') {
    return <DeepWorkArtwork visual={visual} />;
  }

  if (visual.key === 'sobriety') {
    return <SobrietyArtwork visual={visual} />;
  }

  if (visual.key === 'custom') {
    return <CustomArtwork visual={visual} />;
  }

  if (visual.key === 'writing') {
    return <WritingArtwork visual={visual} />;
  }

  return <GeneralArtwork visual={visual} />;
}

function getBackplateRadius(
  size: number,
  shape: NonNullable<CircleCategoryIconProps['shape']>,
) {
  return shape === 'roundedSquare'
    ? Math.min(14, Math.round(size * 0.3))
    : size / 2;
}

export function CircleCategoryIcon({
  category,
  shape = 'circle',
  size = 38,
  style,
}: CircleCategoryIconProps): React.JSX.Element {
  const visual = getCircleCategoryVisual(category);
  const sizeStyle = {
    borderRadius: getBackplateRadius(size, shape),
    height: size,
    width: size,
  };

  return (
    <View
      style={[
        styles.iconWrap,
        {backgroundColor: visual.backplateColor},
        sizeStyle,
        style,
      ]}>
      <Svg height={size * 0.74} viewBox="0 0 64 64" width={size * 0.74}>
        {renderCategoryArtwork(visual)}
      </Svg>
    </View>
  );
}

export function CircleCategoryPill({
  category,
  iconSize = categoryPillIconSize,
  label,
  style,
  uppercase = false,
}: CircleCategoryPillProps): React.JSX.Element {
  const theme = useHoystTheme();
  const visual = getCircleCategoryVisual(category);
  const displayLabel = label ?? visual.label;
  const foregroundColor = getCircleCategoryForegroundColor(category, theme);
  const backgroundColor =
    visual.tone === 'neutral' ? theme.surfaceHigh : `${visual.accentColor}22`;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor,
        },
        styles.pillDefaultBorder,
        style,
      ]}>
      <CircleCategoryIcon category={category} size={iconSize} />
      <HoystText
        numberOfLines={1}
        style={[styles.pillLabel, {color: foregroundColor}]}
        variant="tiny">
        {uppercase ? displayLabel.toUpperCase() : displayLabel}
      </HoystText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: categoryPillHeight,
    maxWidth: '100%',
    minHeight: categoryPillHeight,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  pillDefaultBorder: {
    borderColor: 'transparent',
  },
  pillLabel: {
    flexShrink: 1,
  },
});
