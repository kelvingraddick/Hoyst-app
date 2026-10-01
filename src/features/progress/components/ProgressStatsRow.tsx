import React from 'react';
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {ChevronRight} from 'lucide-react-native';
import {DSSurface, DSText, useSystemTheme} from '../../../design/system';
import {ProgressStatBadge} from './ProgressStatBadge';

/** Presentation only: each caller retains its own data and navigation. */
export function ProgressStatsRow({
  streak,
  momentum,
  viewportWidth,
  onStreakPress,
  onMomentumPress,
  testIDPrefix = 'progress',
}: {
  streak: string;
  momentum: string;
  viewportWidth?: number;
  onStreakPress: () => void;
  onMomentumPress: () => void;
  testIDPrefix?: string;
}) {
  const theme = useSystemTheme();
  const {width, fontScale} = useWindowDimensions();
  const columns = (viewportWidth ?? width) >= 390 && fontScale <= 1.15;
  return (
    <View style={columns ? styles.columns : styles.stack}>
      {[
        {
          key: 'streak',
          title: 'Current streak',
          value: streak,
          tone: 'orange' as const,
          onPress: onStreakPress,
        },
        {
          key: 'momentum',
          title: '14-day momentum',
          value: momentum,
          tone: 'blue' as const,
          onPress: onMomentumPress,
        },
      ].map(stat => (
        <DSSurface
          raised
          key={stat.key}
          style={[styles.card, columns && styles.grow]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stat.value}. ${stat.title}. View details.`}
            onPress={stat.onPress}
            style={styles.row}
            testID={`${testIDPrefix}-${stat.key}-card`}>
            <ProgressStatBadge tone={stat.tone} />
            <View style={styles.copy}>
              <DSText variant="title">{stat.value}</DSText>
              <DSText variant="statCaption" tone="muted">
                {stat.title}
              </DSText>
            </View>
            <ChevronRight
              color={theme.muted}
              size={12}
              style={styles.chevron}
            />
          </Pressable>
        </DSSurface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {flexDirection: 'row', gap: 12, alignItems: 'stretch'},
  stack: {gap: 12},
  card: {padding: 10},
  grow: {flex: 1},
  row: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48},
  copy: {flex: 1, paddingRight: 12},
  chevron: {position: 'absolute', right: 0},
});
