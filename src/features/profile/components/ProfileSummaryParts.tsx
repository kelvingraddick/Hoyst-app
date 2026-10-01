import React from 'react';
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {CalendarCheck, ChevronRight, Trophy} from 'lucide-react-native';
import {DSSurface, DSText, useSystemTheme} from '../../../design/system';
import {ProgressStatBadge} from '../../progress/components/ProgressStatBadge';
import type {ProgressSummary} from '../../progress/services/progress-service';
import {ProfileIcon} from './ProfileScaffold';

export function ProfileXP({
  summary,
  onPress,
}: {
  summary?: ProgressSummary;
  onPress?: () => void;
}) {
  const theme = useSystemTheme();
  const fill =
    summary && summary.requiredXP > 0
      ? Math.max(0, Math.min(100, (100 * summary.levelXP) / summary.requiredXP))
      : 0;
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        summary
          ? `Level ${summary.level}. ${summary.levelXP} of ${summary.requiredXP} XP. ${summary.remainingXP} XP to level up.`
          : 'XP is loading'
      }
      onPress={onPress}
      style={styles.xp}
      testID="profile-xp">
      <View style={styles.xpHeader}>
        <View style={[styles.levelPill, {backgroundColor: '#FFFFFF'}]}>
          <DSText variant="action" style={{color: '#070B1A'}}>
            {summary ? `Level ${summary.level}` : 'Level'}
          </DSText>
        </View>
        <DSText variant="body">
          <DSText variant="title">{summary?.levelXP ?? '-'}</DSText> /{' '}
          {summary?.requiredXP ?? '-'} XP
        </DSText>
        <DSText tone="muted" variant="secondary">
          {summary ? `${summary.remainingXP} XP to level up` : 'Loading XP'}
        </DSText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Level progress"
        accessibilityValue={
          summary
            ? {min: 0, max: summary.requiredXP, now: summary.levelXP}
            : undefined
        }
        style={[styles.track, {backgroundColor: theme.track}]}>
        <View style={[styles.fill, {width: `${fill}%`}]} />
      </View>
      <DSText tone="muted" variant="secondary">
        {summary
          ? `${summary.totalXP.toLocaleString()} total XP`
          : 'Total XP unavailable'}
      </DSText>
      {summary && !summary.flags.earning ? (
        <DSText tone="muted" variant="secondary">
          XP earning is paused. Your earned progress is saved.
        </DSText>
      ) : null}
    </Pressable>
  );
}
export function ProfileStats({
  streak,
  momentum,
  tapIns,
  onStreak,
  onMomentum,
}: {
  streak: string;
  momentum: string;
  tapIns: string;
  onStreak?: () => void;
  onMomentum?: () => void;
}) {
  const theme = useSystemTheme();
  const {width, fontScale} = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const stats = [
    {
      key: 'streak',
      value: streak,
      label: 'Current streak',
      icon: <ProgressStatBadge tone="orange" />,
      action: onStreak,
    },
    {
      key: 'momentum',
      value: momentum,
      label: momentum.includes(' of 3')
        ? 'Momentum calibration'
        : '14-day momentum',
      icon: <ProgressStatBadge tone="blue" />,
      action: onMomentum,
    },
    {
      key: 'tap-ins',
      value: tapIns,
      label: 'Total Tap Ins',
      icon: <ProfileIcon icon={CalendarCheck} tone="green" />,
    },
  ];
  return (
    <DSSurface
      raised
      style={[styles.stats, stacked && styles.stacked]}
      testID="profile-stats">
      {stats.map((stat, index) => (
        <View
          key={stat.key}
          style={[
            styles.statColumn,
            stacked && {flex: 0, width: '100%'},
            !stacked &&
              index > 0 && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: theme.border,
              },
            stacked &&
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              },
          ]}>
          <Pressable
            onPress={stat.action}
            disabled={!stat.action}
            accessibilityRole={stat.action ? 'button' : undefined}
            accessibilityLabel={`${stat.value}. ${stat.label}${
              stat.action ? '. View details.' : ''
            }`}
            style={[styles.stat, stacked && styles.statHorizontal]}
            testID={`profile-stat-${stat.key}`}>
            {stat.icon}
            <View style={stacked ? {flex: 1, minWidth: 0} : styles.statCopy}>
              <DSText variant="statistic" style={!stacked && styles.center}>
                {stat.value}
              </DSText>
              <DSText
                tone="muted"
                variant="statCaption"
                style={!stacked && styles.center}>
                {stat.label}
              </DSText>
            </View>
          </Pressable>
        </View>
      ))}
    </DSSurface>
  );
}
export function ProfileTextLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useSystemTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.link}
      testID={testID}>
      <DSText variant="action" tone="action" style={{flexShrink: 1}}>
        {label}
      </DSText>
      <ChevronRight color={theme.action} size={16} />
    </Pressable>
  );
}
export function ProfileBestIcon() {
  return <ProfileIcon icon={Trophy} tone="gold" />;
}
const styles = StyleSheet.create({
  xp: {gap: 6},
  xpHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  levelPill: {paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999},
  track: {height: 8, borderRadius: 8, overflow: 'hidden'},
  fill: {height: '100%', backgroundColor: '#FF6D00', borderRadius: 8},
  stats: {flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 12},
  stacked: {flexDirection: 'column'},
  statColumn: {flex: 1, minWidth: 0},
  stat: {alignItems: 'center', gap: 5, paddingHorizontal: 3, minHeight: 80},
  statHorizontal: {flexDirection: 'row', padding: 8, gap: 12, minHeight: 48},
  statCopy: {gap: 2},
  center: {textAlign: 'center'},
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    alignSelf: 'flex-end',
  },
});
