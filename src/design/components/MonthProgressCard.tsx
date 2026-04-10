import React from 'react';
import {StyleSheet, View} from 'react-native';

import type {CircleProgressDay} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {radius} from '../tokens/radius';
import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';

type MonthProgressCardProps = {
  completionLabel: string;
  days: CircleProgressDay[];
  title: string;
};

export function MonthProgressCard({
  completionLabel,
  days,
  title,
}: MonthProgressCardProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <GlassPanel>
      <View style={styles.header}>
        <HoystText tone="muted" variant="label">
          {title}
        </HoystText>
        <HoystText style={{color: theme.success}} variant="caption">
          {completionLabel}
        </HoystText>
      </View>
      <View style={styles.grid}>
        {days.map(day => {
          const backgroundColor =
            day.state === 'done'
              ? 'rgba(68,216,92,0.18)'
              : day.state === 'missed'
                ? 'rgba(255,110,132,0.18)'
                : day.state === 'today'
                  ? 'rgba(139,92,246,0.24)'
                  : theme.surfaceHigh;
          const textColor =
            day.state === 'future' ? theme.textSubtle : theme.text;

          return (
            <View
              key={day.day}
              style={[
                styles.cell,
                {
                  backgroundColor,
                },
              ]}>
              <HoystText style={{color: textColor}} variant="tiny">
                {String(day.day).padStart(2, '0')}
              </HoystText>
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: '13%',
  },
});
