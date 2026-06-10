import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import type {MomentumStatus} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {brandColors, type HoystTheme} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type MomentumStatusPillProps = {
  label: string;
  status: MomentumStatus;
  style?: StyleProp<ViewStyle>;
};

export function getMomentumStatusPillPalette(
  status: MomentumStatus,
  theme: HoystTheme,
) {
  if (status === 'peak_momentum') {
    return {
      backgroundColor: `${theme.success}14`,
      color: theme.successForeground,
    };
  }

  if (status === 'strong_momentum') {
    return {
      backgroundColor: `${theme.accentTertiary}14`,
      color: theme.accentTertiaryForeground,
    };
  }

  if (status === 'building_momentum') {
    return {
      backgroundColor: `${theme.warning}14`,
      color: theme.warningForeground,
    };
  }

  return {
    backgroundColor: theme.surfaceHigh,
    color: theme.textMuted,
  };
}

export function getMomentumStatusVisualColor(
  status: MomentumStatus,
  theme: HoystTheme,
) {
  const palette = getMomentumStatusPillPalette(status, theme);

  if (status === 'building_momentum') {
    return brandColors.orange;
  }

  return palette.color;
}

export function MomentumStatusPill({
  label,
  status,
  style,
}: MomentumStatusPillProps): React.JSX.Element {
  const theme = useHoystTheme();
  const palette = getMomentumStatusPillPalette(status, theme);

  return (
    <View
      style={[styles.badge, {backgroundColor: palette.backgroundColor}, style]}>
      <HoystText
        numberOfLines={1}
        style={[styles.text, {color: palette.color}]}>
        {label.toUpperCase()}
      </HoystText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    flexShrink: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
});
