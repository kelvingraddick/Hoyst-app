import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {brandColors} from '../tokens/colors';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type HoystChipProps = {
  density?: 'compact' | 'regular';
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'blue' | 'green' | 'neutral' | 'orange' | 'purple' | 'yellow';
};

export function HoystChip({
  density = 'regular',
  label,
  style,
  tone = 'neutral',
}: HoystChipProps): React.JSX.Element {
  const theme = useHoystTheme();
  const palette =
    tone === 'green'
      ? {
          backgroundColor: 'rgba(68,216,92,0.14)',
          color: theme.successForeground,
        }
      : tone === 'blue'
      ? {
          backgroundColor: 'rgba(104,184,232,0.14)',
          color: theme.accentTertiaryForeground,
        }
      : tone === 'orange'
      ? {
          backgroundColor: 'rgba(255,138,61,0.14)',
          color: theme.warningForeground,
        }
      : tone === 'yellow'
      ? {
          backgroundColor: 'rgba(255,196,0,0.18)',
          color: theme.isDark ? brandColors.spectrumYellow : '#7A5C00',
        }
      : tone === 'purple'
      ? {
          backgroundColor: 'rgba(139,92,246,0.16)',
          color: theme.accentSecondaryForeground,
        }
      : {backgroundColor: theme.surfaceHigh, color: theme.textMuted};

  return (
    <View
      style={[styles.base, {backgroundColor: palette.backgroundColor}, style]}>
      <HoystText
        style={[
          styles.label,
          {color: palette.color},
          density === 'compact' ? styles.compactLabel : undefined,
        ]}
        variant="tiny">
        {label}
      </HoystText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  compactLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    textAlign: 'center',
  },
});
