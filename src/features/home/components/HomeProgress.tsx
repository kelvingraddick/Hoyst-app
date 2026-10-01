import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {Check, Minus} from 'lucide-react-native';
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
import {DesignSystemProvider} from '../../../design/system';
import {ProgressStatsRow} from '../../progress/components/ProgressStatsRow';

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
  viewportWidth,
  momentumPercent,
  onStreakPress,
  onMomentumPress,
}: {
  streakDays: number;
  viewportWidth?: number;
  momentumPercent: number;
  onStreakPress: () => void;
  onMomentumPress: () => void;
}) {
  const theme = useHoystTheme();
  return (
    <View style={styles.progress}>
      <DesignSystemProvider scheme={theme.isDark ? 'dark' : 'light'}>
        <ProgressStatsRow
          viewportWidth={viewportWidth}
          streak={`${streakDays} ${streakDays === 1 ? 'day' : 'days'}`}
          momentum={`${momentumPercent}%`}
          onStreakPress={onStreakPress}
          onMomentumPress={onMomentumPress}
          testIDPrefix="home"
        />
      </DesignSystemProvider>
    </View>
  );
}

export function HomeDailyActionProgress({
  progress,
}: {
  progress: ReturnType<typeof getHomeDailyProgress>;
}) {
  const theme = useHoystTheme();
  const accent = brandColors.blue;
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
  caption: homeTypography.secondary,
  actionProgress: {gap: 8},
  track: {height: 5, borderRadius: 3, overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
});
