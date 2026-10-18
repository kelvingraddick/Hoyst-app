import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Flame} from 'lucide-react-native';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {formatCircleStreak} from '../../../shared/circle-progress';
import type {CircleSummary} from '../../../types/models';

export function CircleCardStreaks({
  circle,
}: {
  circle: Pick<
    CircleSummary,
    | 'circleMode'
    | 'viewerMembershipStatus'
    | 'viewerCircleProgress'
    | 'groupStreak'
  >;
}) {
  const theme = useHoystTheme();
  if (circle.viewerMembershipStatus === 'pending') {
    return null;
  }
  return (
    <View style={styles.row}>
      {[
        ...(circle.viewerMembershipStatus === 'active'
          ? [{label: 'Your streak', summary: circle.viewerCircleProgress}]
          : []),
        ...(circle.circleMode === 'personal'
          ? []
          : [{label: 'Group streak', summary: circle.groupStreak}]),
      ].map(item => (
        <View
          key={item.label}
          style={styles.item}
          accessible
          accessibilityLabel={`${item.label}: ${formatCircleStreak(
            item.summary?.streak,
          )}`}>
          <HoystText style={styles.label} tone="muted">
            {item.label}
          </HoystText>
          <Flame accessible={false} size={13} color={theme.streakForeground} />
          <HoystText style={[styles.value, {color: theme.streakForeground}]}>
            {formatCircleStreak(item.summary?.streak)}
          </HoystText>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  item: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4},
  label: {fontSize: 11, lineHeight: 16},
  value: {fontSize: 12, lineHeight: 17, fontWeight: '600'},
});
