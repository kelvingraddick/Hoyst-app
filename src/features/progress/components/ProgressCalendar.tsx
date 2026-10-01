import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {DateTime} from 'luxon';
import Svg, {Path} from 'react-native-svg';
import {Check, ChevronLeft, ChevronRight, Shield} from 'lucide-react-native';
import {DSText, minimumTarget, useSystemTheme} from '../../../design/system';
import type {ProgressDay, ProgressMonth} from '../services/history-service';
const dayOffsets = [0, 3, 0, 5, 2, 0, 3];
const markerCenter = 17;
const connectorClearance = 19;

export function calendarConnectorSegments(
  week: (string | undefined)[],
  width: number,
) {
  const column = width / 7;
  const days = week.flatMap((day, i) =>
    day ? [{x: column * (i + 0.5), y: markerCenter + dayOffsets[i], i}] : [],
  );
  const segments: string[] = [];
  if (days[0]?.i === 0 && days[0].x > connectorClearance) {
    segments.push(
      `M -30 ${days[0].y} L ${days[0].x - connectorClearance} ${days[0].y}`,
    );
  }
  for (let i = 1; i < days.length; i++) {
    const previous = days[i - 1];
    const next = days[i];
    const start = previous.x + connectorClearance;
    const end = next.x - connectorClearance;
    if (end <= start) {
      continue;
    }
    const middle = (start + end) / 2;
    segments.push(
      `M ${start} ${previous.y} C ${middle} ${previous.y}, ${middle} ${next.y}, ${end} ${next.y}`,
    );
  }
  const last = days[days.length - 1];
  if (last?.i === 6 && width - last.x > connectorClearance) {
    segments.push(
      `M ${last.x + connectorClearance} ${last.y} L ${width + 30} ${last.y}`,
    );
  }
  return segments;
}

export function calendarWeeks(monthKey: string) {
  const first = DateTime.fromISO(`${monthKey}-01`);
  const cells: (string | undefined)[] = Array(first.weekday % 7).fill(
    undefined,
  );
  for (let n = 1; n <= (first.daysInMonth || 0); n++) {
    cells.push(first.set({day: n}).toISODate()!);
  }
  while (cells.length % 7) {
    cells.push(undefined);
  }
  return Array.from({length: cells.length / 7}, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}
function DayNode({
  status,
  future,
  compact = false,
}: {
  status: ProgressDay['status'];
  future?: boolean;
  compact?: boolean;
}) {
  const theme = useSystemTheme();
  return (
    <View
      style={[
        styles.node,
        compact && {width: 16, height: 16, borderRadius: 8},
        {
          borderColor: status === 'success' ? '#10B967' : theme.muted,
          backgroundColor: status === 'success' ? '#10B967' : theme.canvas,
          opacity: future ? 0.35 : 1,
        },
      ]}>
      {status === 'success' ? (
        <Check size={compact ? 10 : 13} color="#FFFFFF" strokeWidth={2.5} />
      ) : status === 'partial' ? (
        <View
          style={[
            styles.partial,
            !compact && styles.partialBadge,
            {borderColor: theme.canvas},
          ]}
        />
      ) : status === 'protected' ? (
        <Shield size={compact ? 10 : 13} color="#FF6D00" />
      ) : null}
    </View>
  );
}
export function ProgressCalendar({
  monthKey,
  today,
  selected,
  data,
  width,
  onSelect,
  onMonth,
}: {
  monthKey: string;
  today: string;
  selected: string;
  data?: ProgressMonth;
  width: number;
  onSelect: (dateKey: string) => void;
  onMonth: (key: string) => void;
}) {
  const theme = useSystemTheme();
  const {fontScale} = useWindowDimensions();
  const month = DateTime.fromISO(`${monthKey}-01`);
  const fullWidth = width;
  return (
    <View testID="progress-calendar">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={styles.action}
          onPress={() => onMonth(month.minus({months: 1}).toFormat('yyyy-MM'))}>
          <ChevronLeft size={18} color={theme.action} />
        </Pressable>
        <DSText style={styles.month}>{month.toFormat('LLLL yyyy')}</DSText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{disabled: monthKey >= today.slice(0, 7)}}
          disabled={monthKey >= today.slice(0, 7)}
          style={styles.action}
          onPress={() => onMonth(month.plus({months: 1}).toFormat('yyyy-MM'))}>
          <ChevronRight
            size={18}
            color={monthKey >= today.slice(0, 7) ? theme.muted : theme.action}
          />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(label => (
          <View key={label} style={[styles.column, {minHeight: 0}]}>
            <DSText style={styles.weekday} tone="muted">
              {label}
            </DSText>
          </View>
        ))}
      </View>
      {calendarWeeks(monthKey).map((week, index) => {
        const segments = calendarConnectorSegments(week, fullWidth);
        return (
          <View key={index} style={styles.week}>
            {fontScale < 1.5 ? (
              <Svg
                pointerEvents="none"
                width={fullWidth + 60}
                height={48}
                style={styles.connector}
                testID="progress-calendar-connector">
                {segments.map((path, segment) => (
                  <Path
                    key={segment}
                    d={path}
                    transform="translate(30 0)"
                    stroke={theme.isDark ? '#71717A' : '#A0A0A5'}
                    strokeWidth={1.4}
                    strokeDasharray="5 6"
                    fill="none"
                  />
                ))}
              </Svg>
            ) : null}
            {week.map((dateKey, i) => {
              if (!dateKey) {
                return <View key={i} style={styles.column} />;
              }
              const day = data?.days.find(value => value.dateKey === dateKey);
              const isToday = dateKey === today;
              const isSelected = dateKey === selected;
              const future = dateKey > today;
              return (
                <Pressable
                  key={dateKey}
                  accessibilityRole="button"
                  accessibilityState={{selected: isSelected, disabled: future}}
                  accessibilityLabel={`${DateTime.fromISO(dateKey).toFormat(
                    'cccc, LLLL d',
                  )}. ${isToday ? 'Today. ' : ''}${
                    day
                      ? `${day.tapIns} successful Tap Ins. ${day.activityCount} activities. ${day.status}.`
                      : 'History unavailable.'
                  }`}
                  disabled={future}
                  hitSlop={4}
                  onPress={() => onSelect(dateKey)}
                  style={styles.column}
                  testID={`progress-calendar-day-${dateKey}`}>
                  <View
                    style={[
                      styles.selection,
                      {marginTop: dayOffsets[i]},
                      (isToday || isSelected) && {
                        borderColor: '#18B9FF',
                        borderWidth: isToday ? 2 : 1,
                      },
                    ]}>
                    <DayNode status={day?.status || 'none'} future={future} />
                  </View>
                  <DSText
                    style={[
                      styles.date,
                      isToday && {color: theme.action},
                      future && styles.future,
                    ]}>
                    {Number(dateKey.slice(-2))}
                  </DSText>
                  {isToday ? (
                    <DSText style={[styles.today, {color: theme.action}]}>
                      Today
                    </DSText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <View style={styles.legend}>
        {(['success', 'partial', 'protected', 'none'] as const).map(
          (status, i) => (
            <View key={status} style={styles.legendItem}>
              <DayNode status={status} compact />
              <DSText tone="muted" style={styles.legendLabel}>
                {['Tap In', 'Partial', 'Protected', 'No Tap In'][i]}
              </DSText>
            </View>
          ),
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  action: {
    minWidth: minimumTarget(),
    minHeight: minimumTarget(),
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1},
  weekdays: {flexDirection: 'row', marginBottom: 8},
  weekday: {fontSize: 11, lineHeight: 16},
  week: {flexDirection: 'row', minHeight: 56, position: 'relative'},
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    minHeight: minimumTarget(),
  },
  connector: {position: 'absolute', left: -30, top: 0},
  selection: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partialBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  partial: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#18B9FF'},
  date: {fontSize: 12, lineHeight: 17, marginTop: 2},
  today: {fontSize: 10, lineHeight: 14, color: '#0B76B5'},
  future: {opacity: 0.35},
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
  legendLabel: {fontSize: 10, lineHeight: 15},
});
