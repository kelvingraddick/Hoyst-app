import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {DateTime} from 'luxon';
import {ChevronRight, Trophy, BarChart3} from 'lucide-react-native';
import {
  DSSurface,
  DSText,
  DSButton,
  minimumTarget,
  useSystemTheme,
} from '../../../design/system';
import {useUserProfileStore} from '../../../store/profile-store';
import type {ProfileSummary} from '../../profile/services/profile-summary-service';
import type {
  ProgressActivity,
  ProgressActivityPage,
  ProgressMonth,
} from '../services/history-service';
import {useProgressHistory} from '../hooks/useProgressHistory';
import {ProgressActivityRow} from './ProgressActivityRow';
import {ProgressCalendar} from './ProgressCalendar';

export function historyFixture(
  monthKey: string,
  timezone = 'America/New_York',
): {
  month: ProgressMonth;
  day: ProgressActivityPage;
} {
  const today = DateTime.now().setZone(timezone).toISODate()!;
  const count = DateTime.fromISO(`${monthKey}-01`).daysInMonth || 30;
  const green = [
    1, 4, 5, 7, 8, 11, 12, 15, 16, 17, 19, 21, 22, 24, 25, 27, 28, 29, 30,
  ];
  const days = Array.from({length: count}, (_, i) => {
    const dateKey = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
    const success = green.includes(i + 1) && dateKey <= today;
    const partial = [9, 23].includes(i + 1);
    const tapIns = success ? (green.indexOf(i + 1) < 13 ? 2 : 1) : 0;
    return {
      dateKey,
      tapIns,
      activityCount: tapIns || (partial || i === 17 ? 1 : 0),
      status: success
        ? ('success' as const)
        : partial
        ? ('partial' as const)
        : i === 17
        ? ('protected' as const)
        : ('none' as const),
    };
  });
  return {
    month: {
      monthKey,
      timezone,
      todayDateKey: today,
      days,
      tapIns: days.reduce((n, day) => n + day.tapIns, 0),
      activeDays: days.filter(day => day.tapIns).length,
    },
    day: {
      dateKey: today,
      timezone,
      nextCursor: null,
      entries: [
        {
          id: 'preview-read',
          circleId: 'preview-read',
          dateKey: today,
          title: 'Read every day',
          category: 'Writing',
          status: 'completed',
          description: 'Completed · 20 pages',
          note: 'Finished a chapter before bed.',
          sortKey: '2',
        },
        {
          id: 'preview-sleep',
          circleId: 'preview-sleep',
          dateKey: today,
          title: 'Sleep 7 hours',
          category: 'Wellness',
          status: 'partial',
          description: 'Partial · 6 hours',
          sortKey: '1',
        },
      ],
    },
  };
}
export function ProgressStatsSection({
  uid,
  width,
  preview = false,
  profile,
  profileError,
  children,
  onDay,
  onActivity,
  onAchievements,
  onLayout,
}: {
  uid?: string;
  width: number;
  preview?: boolean;
  profile?: ProfileSummary;
  profileError?: boolean;
  children: React.ReactNode;
  onDay: (dateKey: string) => void;
  onActivity: (dateKey: string, entry: ProgressActivity) => void;
  onAchievements: () => void;
  onLayout?: React.ComponentProps<typeof View>['onLayout'];
}) {
  const theme = useSystemTheme();
  const [pressedAction, setPressedAction] = useState<string>();
  const previousToday = React.useRef<string | undefined>(undefined);
  const savedTimezone =
    useUserProfileStore(state => state.profile?.timezone) || 'UTC';
  const zone = preview
    ? 'America/New_York'
    : DateTime.now().setZone(savedTimezone).isValid
    ? savedTimezone
    : 'UTC';
  const [clock, setClock] = useState(
    () => DateTime.now().setZone(zone).toISODate()!,
  );
  useEffect(() => {
    const timer = setInterval(
      () => setClock(DateTime.now().setZone(zone).toISODate()!),
      60000,
    );
    return () => clearInterval(timer);
  }, [zone]);
  const [monthKey, setMonthKey] = useState(clock.slice(0, 7));
  const [selected, setSelected] = useState(clock);
  useEffect(() => {
    const today = DateTime.now().setZone(zone).toISODate()!;
    setClock(today);
    setMonthKey(today.slice(0, 7));
    setSelected(today);
  }, [uid, zone]);
  const history = useProgressHistory(uid, zone, monthKey, selected, preview);
  const refreshHistory = history.refresh;
  useEffect(() => {
    const prior = previousToday.current;
    if (prior && prior !== clock) {
      setSelected(value => (value === prior ? clock : value));
      setMonthKey(value =>
        value === prior.slice(0, 7) ? clock.slice(0, 7) : value,
      );
      refreshHistory();
    }
    previousToday.current = clock;
  }, [clock, refreshHistory]);
  const fixture = preview ? historyFixture(monthKey) : undefined;
  const month = fixture?.month || history.month.data;
  const day = fixture?.day || history.day.data;
  const today = month?.todayDateKey || clock;
  const changeMonth = (key: string) => {
    setMonthKey(key);
    setSelected(
      key === today.slice(0, 7)
        ? today
        : DateTime.fromISO(`${key}-01`).endOf('month').toISODate()!,
    );
  };
  const dayEntries = (day?.entries || []).slice(0, 2);
  return (
    <View onLayout={onLayout} style={styles.stack} testID="progress-your-stats">
      <DSText variant="heading">Your stats</DSText>
      {children}
      <ProgressCalendar
        width={width}
        monthKey={monthKey}
        today={today}
        selected={selected}
        data={month}
        onSelect={setSelected}
        onMonth={changeMonth}
      />
      {!preview && history.month.isPending ? (
        <ActivityIndicator
          accessibilityLabel="Loading Tap In history"
          color={theme.action}
        />
      ) : null}
      {!preview && history.month.isError ? (
        <View>
          <DSText tone="muted">Tap In history is unavailable.</DSText>
          <DSButton
            label="Retry history"
            variant="quiet"
            onPress={history.refresh}
          />
        </View>
      ) : null}
      <DSSurface raised style={styles.surface} testID="progress-selected-day">
        <DSText style={styles.dayTitle}>
          {DateTime.fromISO(selected).toFormat('cccc, LLL d')}
        </DSText>
        {!preview && history.day.isPending ? (
          <ActivityIndicator
            accessibilityLabel="Loading selected day"
            color={theme.action}
          />
        ) : !preview && history.day.isError ? (
          <View>
            <DSText tone="muted">This day’s activity is unavailable.</DSText>
            <DSButton
              label="Retry day"
              variant="quiet"
              onPress={history.refresh}
            />
          </View>
        ) : dayEntries.length ? (
          dayEntries.map(entry => (
            <ProgressActivityRow
              key={entry.id}
              entry={entry}
              onPress={() => onActivity(selected, entry)}
            />
          ))
        ) : (
          <DSText tone="muted" style={styles.empty}>
            No recorded activity on this day.
          </DSText>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View all activity for ${selected}`}
          onPress={() => onDay(selected)}
          onPressIn={() => setPressedAction('day')}
          onPressOut={() => setPressedAction(undefined)}
          style={[
            styles.actionRow,
            {opacity: pressedAction === 'day' ? 0.7 : 1},
          ]}>
          <DSText style={[styles.actionText, {color: theme.action}]}>
            View all activity
          </DSText>
          <ChevronRight size={16} color={theme.action} />
        </Pressable>
      </DSSurface>
      <DSSurface raised style={styles.totals} testID="progress-month-totals">
        {[
          {value: month?.tapIns, title: 'Tap Ins this month'},
          {value: month?.activeDays, title: 'Active days'},
        ].map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.totalColumn,
              index === 1 && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: theme.border,
              },
            ]}>
            <DSText style={styles.value}>
              {item.value === undefined ? '—' : item.value}
            </DSText>
            <DSText tone="muted" style={styles.caption}>
              {item.title}
            </DSText>
          </View>
        ))}
      </DSSurface>
      {month && !month.tapIns ? (
        <DSText tone="muted" style={styles.caption}>
          No successful Tap Ins recorded this month yet.
        </DSText>
      ) : null}
      <View>
        <DSText variant="heading">Your personal bests</DSText>
        <DSText tone="muted" style={styles.caption}>
          All-time
        </DSText>
      </View>
      <DSSurface raised style={styles.surface} testID="progress-personal-bests">
        <View style={styles.bestRow}>
          {[
            {
              Icon: Trophy,
              color: '#E8A600',
              label: 'Best streak',
              value: preview
                ? '12 days'
                : profile
                ? `${profile.longestStreakDays} days`
                : profileError
                ? 'Unavailable'
                : '…',
            },
            {
              Icon: BarChart3,
              color: '#18B9FF',
              label: 'Lifetime Tap Ins',
              value: preview
                ? '147'
                : profile
                ? String(profile.totalTapIns)
                : profileError
                ? 'Unavailable'
                : '…',
            },
          ].map(({Icon, color, label, value}, index) => (
            <View
              key={label}
              style={[
                styles.bestColumn,
                index === 1 && {
                  borderLeftWidth: StyleSheet.hairlineWidth,
                  borderLeftColor: theme.border,
                },
              ]}>
              <View style={[styles.icon, {backgroundColor: color + '18'}]}>
                <Icon size={22} color={color} />
              </View>
              <View style={styles.bestCopy}>
                <DSText style={styles.bestValue}>{value}</DSText>
                <DSText tone="muted" style={styles.caption}>
                  {label}
                </DSText>
              </View>
            </View>
          ))}
        </View>
        <DSText tone="muted" style={styles.explanation}>
          Protection can preserve your streak. Skips and restores don’t count as
          Tap Ins.
        </DSText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View achievements"
          onPress={onAchievements}
          onPressIn={() => setPressedAction('achievements')}
          onPressOut={() => setPressedAction(undefined)}
          style={[
            styles.actionRow,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
              opacity: pressedAction === 'achievements' ? 0.7 : 1,
            },
          ]}>
          <DSText style={[styles.actionText, {color: theme.action}]}>
            View achievements
          </DSText>
          <ChevronRight size={16} color={theme.action} />
        </Pressable>
      </DSSurface>
    </View>
  );
}
const styles = StyleSheet.create({
  stack: {gap: 12},
  surface: {padding: 12, gap: 0},
  dayTitle: {fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 4},
  empty: {fontSize: 12, lineHeight: 18, paddingVertical: 12},
  actionRow: {
    minHeight: minimumTarget(),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#0B76B5',
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  totals: {flexDirection: 'row', padding: 12},
  totalColumn: {flex: 1, alignItems: 'center', paddingHorizontal: 8},
  value: {fontSize: 20, lineHeight: 26, fontWeight: '700'},
  caption: {fontSize: 11, lineHeight: 16, marginTop: 2},
  bestRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  bestColumn: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  bestCopy: {flex: 1, minWidth: 72},
  bestValue: {fontSize: 15, lineHeight: 21, fontWeight: '600'},
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanation: {fontSize: 10, lineHeight: 15, marginTop: 10, marginBottom: 6},
});
