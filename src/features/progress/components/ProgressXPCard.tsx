import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {DSText, useSystemTheme} from '../../../design/system';
import type {ProgressSummary} from '../services/progress-service';

/** Shared presentation for saved progress and the local guest starting state. */
export function ProgressXPCard({
  summary,
  onPress,
  guest = false,
}: {
  summary: ProgressSummary;
  onPress: () => void;
  guest?: boolean;
}) {
  const theme = useSystemTheme();
  return (
    <Pressable
      testID="progress-xp-card"
      accessibilityRole="button"
      accessibilityLabel={`Level ${summary.level}. ${summary.levelXP} of ${summary.requiredXP} XP. ${summary.remainingXP} XP to level up.`}
      onPress={onPress}
      style={styles.xp}>
      <View style={styles.wrap}>
        <View style={styles.levelPill}>
          <DSText variant="action" style={styles.levelLabel}>
            Level {summary.level}
          </DSText>
        </View>
        <DSText variant="body">
          <DSText variant="title">{summary.levelXP}</DSText> /{' '}
          {summary.requiredXP} XP
        </DSText>
        <DSText variant="secondary" tone="muted">
          {summary.remainingXP} XP to level up
        </DSText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: summary.requiredXP,
          now: summary.levelXP,
        }}
        style={[styles.track, {backgroundColor: theme.track}]}>
        <View
          style={[
            styles.fill,
            {width: `${(summary.levelXP / summary.requiredXP) * 100}%`},
          ]}
        />
      </View>
      <DSText variant="secondary" tone="muted">
        {summary.totalXP} total XP
      </DSText>
      {!guest && !summary.flags.earning ? (
        <DSText tone="muted" variant="secondary">
          XP earning is paused. Your earned XP and rewards stay saved.
        </DSText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  xp: {gap: 6},
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
  },
  levelLabel: {color: '#070B1A'},
  track: {height: 8, borderRadius: 8, overflow: 'hidden', marginTop: 2},
  fill: {height: '100%', borderRadius: 8, backgroundColor: '#FF6D00'},
});
