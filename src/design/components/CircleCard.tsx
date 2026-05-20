import React from 'react';
import {StyleSheet, View} from 'react-native';

import {GlassPanel} from './GlassPanel';
import {HoystText} from './HoystText';
import {useHoystTheme} from '../theme/useHoystTheme';

type CircleCardProps = {
  title: string;
  memberCount: string;
  progressLabel: string;
  statusLabel: string;
  progress: number;
};

export function CircleCard({
  title,
  memberCount,
  progressLabel,
  statusLabel,
  progress,
}: CircleCardProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <GlassPanel>
      <View style={styles.header}>
        <View style={styles.copy}>
          <HoystText variant="title">{title}</HoystText>
          <HoystText tone="muted">{memberCount}</HoystText>
        </View>
        <HoystText tone="success" variant="caption">
          {statusLabel}
        </HoystText>
      </View>
      <View style={[styles.track, {backgroundColor: theme.surfaceHigh}]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: theme.successForeground,
              width: `${Math.max(6, progress * 100)}%`,
            },
          ]}
        />
      </View>
      <HoystText tone="muted" variant="caption">
        {progressLabel}
      </HoystText>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  track: {
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
    height: '100%',
  },
});
