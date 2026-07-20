import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type {CommitmentType} from '../../types/models';
import {radius} from '../tokens/radius';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';

type CommitmentTypeIconProps = {
  accessibilityLabel?: string;
  commitmentType: CommitmentType;
  decorative?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type CommitmentTypePillProps = {
  commitmentType: CommitmentType;
  density?: 'compact' | 'regular';
  style?: StyleProp<ViewStyle>;
  uppercase?: boolean;
};

type CommitmentTypeVisual = {
  backgroundColor: string;
  label: string;
  source: ImageSourcePropType;
};

const commitmentTypeVisuals: Record<CommitmentType, CommitmentTypeVisual> = {
  avoid: {
    backgroundColor: 'rgba(255,59,48,0.16)',
    label: 'Avoid',
    source: require('../../assets/commitment-types/avoid.png'),
  },
  build: {
    backgroundColor: 'rgba(16,185,103,0.16)',
    label: 'Build',
    source: require('../../assets/commitment-types/build.png'),
  },
  limit: {
    backgroundColor: 'rgba(255,109,0,0.16)',
    label: 'Limit',
    source: require('../../assets/commitment-types/limit.png'),
  },
};

export function getCommitmentTypeVisual(commitmentType: CommitmentType) {
  return commitmentTypeVisuals[commitmentType];
}

export function CommitmentTypeIcon({
  accessibilityLabel,
  commitmentType,
  decorative = false,
  size = 40,
  style,
}: CommitmentTypeIconProps): React.JSX.Element {
  const visual = getCommitmentTypeVisual(commitmentType);

  return (
    <View
      accessibilityLabel={
        decorative
          ? undefined
          : accessibilityLabel ?? `${visual.label} commitment type`
      }
      accessibilityRole={decorative ? undefined : 'image'}
      accessible={!decorative}
      style={[
        styles.iconCircle,
        {
          backgroundColor: visual.backgroundColor,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
        style,
      ]}
      testID={`commitment-type-icon-${commitmentType}`}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={visual.source}
        style={{height: size * 0.76, width: size * 0.76}}
      />
    </View>
  );
}

export function CommitmentTypePill({
  commitmentType,
  density = 'regular',
  style,
  uppercase = false,
}: CommitmentTypePillProps): React.JSX.Element {
  const theme = useHoystTheme();
  const visual = getCommitmentTypeVisual(commitmentType);
  const isCompact = density === 'compact';
  const iconSize = isCompact ? 18 : 22;
  const foregroundColor =
    commitmentType === 'build'
      ? theme.successForeground
      : commitmentType === 'limit'
      ? theme.warningForeground
      : theme.dangerForeground;

  return (
    <View
      accessibilityLabel={`${visual.label} commitment type`}
      accessible
      style={[
        styles.pill,
        isCompact ? styles.pillCompact : styles.pillRegular,
        {backgroundColor: visual.backgroundColor},
        style,
      ]}
      testID={`commitment-type-pill-${commitmentType}`}>
      <CommitmentTypeIcon
        commitmentType={commitmentType}
        decorative
        size={iconSize}
      />
      <HoystText
        numberOfLines={1}
        style={[
          styles.pillLabel,
          isCompact ? styles.pillLabelCompact : undefined,
          {color: foregroundColor},
        ]}
        variant="tiny">
        {uppercase ? visual.label.toUpperCase() : visual.label}
      </HoystText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pillCompact: {
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pillLabel: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pillLabelCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  pillRegular: {
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
