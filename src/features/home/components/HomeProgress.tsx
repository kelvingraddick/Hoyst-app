import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {Check, Flame, Minus, TrendingUp} from 'lucide-react-native';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {HomeProgressCell} from '../services/home-data-service';
import {
  getHomeDailyActionProgressLabel,
  type getHomeDailyProgress,
} from '../services/home-daily-actions';
import {brandColors} from '../../../design/tokens/colors';
import {homeTypography} from '../../../design/tokens/home';
import {DateTime} from 'luxon';

export function HomeWeekPath({days}: {days: readonly HomeProgressCell[]}) {
  const theme = useHoystTheme();
  const {width, fontScale} = useWindowDimensions();
  const labelScale = Math.min(fontScale, 1.2);
  const accent = brandColors.blue;
  const innerWidth = width - 44;
  const columnWidth = innerWidth / Math.max(1, days.length);
  const offsets = [0, 4, 0, 14, 0, 10, 3];
  const centers = days.map((_, i) => ({
    x: columnWidth * (i + 0.5),
    y: 17 + offsets[i % 7],
  }));
  return (
    <View testID="home-week-path" style={styles.week}>
      <Svg
        width={innerWidth}
        height={55}
        style={styles.path}
        pointerEvents="none">
        <Path
          d={centers.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}
          stroke={theme.isDark ? '#71717A' : '#A0A0A5'}
          strokeWidth={1.4}
          strokeDasharray="5 6"
          fill="none"
        />
      </Svg>
      {days.map((day, i) => {
        const date = DateTime.fromISO(day.dateKey);
        const today = i === days.length - 1;
        const partial = day.state !== 'done' && (day.quantityValue ?? 0) > 0;
        const statusLabel =
          day.state === 'done'
            ? 'completed'
            : partial
            ? 'partial progress'
            : day.state === 'missed'
            ? 'missed'
            : 'no Tap In recorded';
        const color = today
          ? accent
          : day.state === 'done'
          ? theme.successForeground
          : day.state === 'missed' && !partial
          ? theme.dangerForeground
          : theme.textSubtle;
        return (
          <View
            key={day.dateKey}
            style={styles.day}
            accessible
            accessibilityLabel={`${date.toFormat(
              'cccc, LLLL d',
            )}: ${statusLabel}${
              day.quantityLabel ? `, ${day.quantityLabel} logged` : ''
            }${today ? ', today' : ''}`}>
            <View
              style={[
                styles.node,
                {
                  marginTop: offsets[i % 7] + 6,
                  backgroundColor:
                    day.state === 'done'
                      ? today
                        ? accent
                        : theme.success
                      : theme.isDark
                      ? '#121212'
                      : '#FAFAF7',
                  borderColor: color,
                },
              ]}>
              {day.state === 'done' ? (
                <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
              ) : partial ? (
                <View
                  testID={`home-week-partial-${day.dateKey}`}
                  style={[styles.partial, {backgroundColor: color}]}
                />
              ) : day.state === 'missed' ? (
                <Minus size={12} color={color} />
              ) : null}
            </View>
            <HoystText
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.weekday,
                {fontSize: 12 * labelScale, lineHeight: 16 * labelScale},
                {
                  marginTop: 26 - offsets[i % 7],
                  color: today ? accent : theme.textMuted,
                },
              ]}>
              {date.toFormat('ccc')}
            </HoystText>
            <HoystText
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.date,
                {fontSize: 14 * labelScale, lineHeight: 20 * labelScale},
                {color: today ? accent : theme.text},
              ]}>
              {date.toFormat('d')}
            </HoystText>
            {today && (
              <HoystText
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.today,
                  {
                    color: accent,
                    fontSize: 12 * labelScale,
                    lineHeight: 16 * labelScale,
                  },
                ]}>
                Today
              </HoystText>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function HomeProgress({
  streakDays,
  momentumPercent,
  onMomentumPress,
}: {
  streakDays: number;
  momentumPercent: number;
  onMomentumPress: () => void;
}) {
  const theme = useHoystTheme();
  const accent = theme.isDark ? '#B89FFF' : theme.accentForeground;
  const statsSurface = theme.isDark ? '#121212' : '#FAFAF7';
  const statsShadow = theme.isDark ? '#000000' : '#92723E';
  return (
    <View style={styles.progress}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current streak ${streakDays} days. 14-day momentum ${momentumPercent}%. View Momentum`}
        onPress={onMomentumPress}
        style={[
          styles.stats,
          {backgroundColor: statsSurface, shadowColor: statsShadow},
        ]}
        testID="home-momentum-bar">
        <View style={styles.stat}>
          <View style={styles.statValue}>
            <Flame size={16} color={theme.warningForeground} />
            <HoystText
              style={[styles.number, {color: theme.warningForeground}]}>
              {streakDays} {streakDays === 1 ? 'day' : 'days'}
            </HoystText>
          </View>
          <HoystText style={styles.statCaption} tone="muted">
            Current streak
          </HoystText>
        </View>
        <View style={[styles.divider, {backgroundColor: theme.borderStrong}]} />
        <View style={styles.stat}>
          <View style={styles.statValue}>
            <TrendingUp size={16} color={accent} />
            <HoystText style={[styles.number, {color: accent}]}>
              {momentumPercent}%
            </HoystText>
          </View>
          <HoystText style={styles.statCaption} tone="muted">
            14-day momentum
          </HoystText>
        </View>
      </Pressable>
    </View>
  );
}

export function HomeDailyActionProgress({
  progress,
}: {
  progress: ReturnType<typeof getHomeDailyProgress>;
}) {
  const theme = useHoystTheme();
  const accent = theme.isDark ? '#B89FFF' : theme.accentForeground;
  const trackSurface = theme.isDark ? '#303036' : '#E9E9ED';
  const label = getHomeDailyActionProgressLabel(progress);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: progress.total || 1,
        now: progress.completed,
        text: label,
      }}
      style={styles.actionProgress}
      testID="home-daily-action-progress">
      <HoystText style={styles.caption} tone="muted">
        {label}
      </HoystText>
      <View
        style={[styles.track, {backgroundColor: trackSurface}]}
        testID="home-daily-action-progress-track">
        <View
          style={[
            styles.fill,
            {
              backgroundColor: accent,
              width: `${
                progress.total ? (progress.completed / progress.total) * 100 : 0
              }%`,
            },
          ]}
          testID="home-daily-action-progress-fill"
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  week: {flexDirection: 'row', minHeight: 112},
  path: {position: 'absolute', top: 0, left: 0},
  day: {flex: 1, alignItems: 'center'},
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partial: {width: 8, height: 8, borderRadius: 4},
  weekday: {fontSize: 12, lineHeight: 16, fontWeight: '500'},
  date: {fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 2},
  today: {fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 4},
  progress: {gap: 12},
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  stat: {flex: 1, gap: 4},
  statValue: {flexDirection: 'row', alignItems: 'center', gap: 8},
  number: {fontSize: 18, lineHeight: 22, fontWeight: '600', flexShrink: 1},
  statCaption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
    marginLeft: 24,
  },
  caption: homeTypography.secondary,
  divider: {width: 1, height: 32},
  actionProgress: {gap: 8},
  track: {height: 5, borderRadius: 3, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
});
