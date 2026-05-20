import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {HoystText} from './HoystText';

type HoystChipProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'green' | 'orange' | 'purple' | 'neutral';
};

export function HoystChip({
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
      : tone === 'orange'
      ? {
          backgroundColor: 'rgba(255,138,61,0.14)',
          color: theme.warningForeground,
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
      <HoystText style={{color: palette.color}} variant="tiny">
        {label}
      </HoystText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
