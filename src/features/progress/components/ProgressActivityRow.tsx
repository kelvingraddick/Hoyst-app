import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Check, ChevronRight, Minus, Shield} from 'lucide-react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {CircleCategoryIcon} from '../../../design/components/CircleCategoryIcon';
import {DSText, minimumTarget, useSystemTheme} from '../../../design/system';
import type {ProgressActivity} from '../services/history-service';
export function ActivityStatus({status}: {status: ProgressActivity['status']}) {
  const theme = useSystemTheme();
  const color =
    status === 'completed'
      ? '#10B967'
      : status === 'partial'
      ? '#18B9FF'
      : status === 'skipped' || status === 'restored'
      ? '#FF6D00'
      : theme.muted;
  const Icon =
    status === 'completed'
      ? Check
      : status === 'skipped' || status === 'restored'
      ? Shield
      : Minus;
  return (
    <View
      style={[
        styles.status,
        status === 'completed' && {backgroundColor: color},
      ]}>
      {status === 'partial' ? (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Circle
            cx={11}
            cy={11}
            r={10}
            fill={theme.surface}
            stroke={theme.border}
          />
          <Path d="M 11 1 A 10 10 0 0 1 21 11 L 11 11 Z" fill="#18B9FF" />
        </Svg>
      ) : (
        <Icon
          size={16}
          color={status === 'completed' ? '#FFFFFF' : color}
          strokeWidth={2}
        />
      )}
    </View>
  );
}
export function ProgressActivityRow({
  entry,
  onPress,
}: {
  entry: ProgressActivity;
  onPress: () => void;
}) {
  const theme = useSystemTheme();
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}. ${entry.description}. View activity details.`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.row,
        {opacity: pressed ? 0.72 : 1, borderBottomColor: theme.border},
      ]}
      testID={`progress-activity-${entry.id}`}>
      <CircleCategoryIcon category={entry.category} size={32} />
      <View style={styles.copy}>
        <DSText style={styles.title}>{entry.title}</DSText>
        <DSText tone="muted" style={styles.description}>
          {entry.description}
        </DSText>
      </View>
      <ActivityStatus status={entry.status} />
      <ChevronRight size={14} color={theme.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    minHeight: minimumTarget(),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {flex: 1, minWidth: 0},
  title: {fontSize: 15, lineHeight: 20, fontWeight: '600'},
  description: {fontSize: 12, lineHeight: 17, marginTop: 2},
  status: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
