import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';

import type {HomeProgressCell} from '../../features/home/services/home-data-service';
import type {ProgressDayState} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {MomentumFlameIllustration} from './MomentumIllustrations';
import {SectionEyebrow} from './SectionEyebrow';

type WeekProgressStripProps = {
  compact?: boolean;
  days: WeekProgressDay[];
  headerAccessory?: React.ReactNode;
  showStreak?: boolean;
  streakDays?: number;
  title?: string;
  weekdayLabelLength?: 2 | 3;
};

type WeekProgressDay = HomeProgressCell & {
  coveredCount?: number;
  totalCount?: number;
};

type DayCircleVisual = {
  background: string;
  border: string;
  borderWidth: number;
  label: string;
};

const TWO_LETTER_WEEKDAY_LABELS = [
  'Su',
  'Mo',
  'Tu',
  'We',
  'Th',
  'Fr',
  'Sa',
] as const;
const THREE_LETTER_WEEKDAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

// progressDays labels are day-of-month ("03"); the strip shows weekday names
// like the reference design, derived from the cell's date key.
function getWeekdayLabel(day: WeekProgressDay, weekdayLabelLength: 2 | 3) {
  const date = new Date(`${day.dateKey}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return day.label;
  }

  return (
    weekdayLabelLength === 3
      ? THREE_LETTER_WEEKDAY_LABELS
      : TWO_LETTER_WEEKDAY_LABELS
  )[date.getDay()];
}

function getDayCircleVisual(
  isDark: boolean,
  state: ProgressDayState,
  isPartial = false,
): DayCircleVisual {
  if (state === 'done') {
    return {
      background: '#22A565',
      border: 'rgba(34,165,101,0.5)',
      borderWidth: 0,
      label: isDark ? '#4BE083' : '#1E8A55',
    };
  }

  if (isPartial) {
    return {
      background: isDark ? 'rgba(34,165,101,0.16)' : 'rgba(34,165,101,0.12)',
      border: isDark ? 'rgba(75,224,131,0.62)' : 'rgba(34,165,101,0.46)',
      borderWidth: 1.5,
      label: isDark ? '#4BE083' : '#1E8A55',
    };
  }

  if (state === 'today') {
    return {
      background: 'rgba(245,166,35,0.16)',
      border: '#F5A623',
      borderWidth: 2,
      label: '#C2410C',
    };
  }

  if (state === 'missed') {
    return {
      background: 'rgba(255,90,95,0.14)',
      border: '#FF5A5F',
      borderWidth: 1.5,
      label: isDark ? '#FF6B63' : '#D21F18',
    };
  }

  return {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(226,232,240,0.72)',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.42)',
    borderWidth: isDark ? 1 : 1.25,
    label: isDark ? '#8D96AD' : '#9A9ABC',
  };
}

function getPartialProgress(day: WeekProgressDay) {
  if (
    typeof day.coveredCount !== 'number' ||
    typeof day.totalCount !== 'number' ||
    day.totalCount <= 0
  ) {
    return undefined;
  }

  const progress = day.coveredCount / day.totalCount;

  return progress > 0 && progress < 1 ? progress : undefined;
}

function getDayAccessibilityLabel(day: WeekProgressDay, weekdayLabel: string) {
  if (day.quantityLabel) {
    return `${weekdayLabel}: ${day.quantityLabel}`;
  }

  if (
    typeof day.coveredCount === 'number' &&
    typeof day.totalCount === 'number'
  ) {
    const progressLabel =
      day.coveredCount >= day.totalCount && day.totalCount > 0
        ? 'complete'
        : day.coveredCount > 0
        ? 'partial'
        : 'empty';

    return `${weekdayLabel}: ${progressLabel}, ${day.coveredCount} of ${day.totalCount} completed`;
  }

  return `${weekdayLabel}: ${day.state}`;
}

function DayCheckIcon({size = 15}: {size?: number}) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M5 12.5l4.2 4.2L19 7"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3.2}
      />
    </Svg>
  );
}

function DayBoltIcon({size = 13}: {size?: number}) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path d="M13 2L4 13.5h5.5L9 22l9-12h-6z" fill="#F5A623" />
    </Svg>
  );
}

function DayMissIcon({size = 12}: {size?: number}) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="#E0392F"
        strokeLinecap="round"
        strokeWidth={3.4}
      />
    </Svg>
  );
}

function TodayArrowBadge({size = 17}: {size?: number}) {
  const theme = useHoystTheme();

  return (
    <View
      style={[
        styles.todayBadge,
        {borderColor: theme.background, height: size, width: size},
      ]}>
      <Svg height={size * 0.55} viewBox="0 0 24 24" width={size * 0.55}>
        <Path
          d="M12 19V6M6 12l6-6 6 6"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3.6}
        />
      </Svg>
    </View>
  );
}

function DayPartialRing({
  dateKey,
  progress,
  size = 22,
}: {
  dateKey: string;
  progress: number;
  size?: number;
}) {
  const radius = 8.5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <Svg
      height={size}
      testID={`week-progress-${dateKey}-partial-ring`}
      viewBox="0 0 24 24"
      width={size}>
      <Circle
        cx={12}
        cy={12}
        fill="none"
        r={radius}
        stroke="rgba(34,165,101,0.22)"
        strokeWidth={3.2}
      />
      <Circle
        cx={12}
        cy={12}
        fill="none"
        r={radius}
        stroke="#22A565"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={3.2}
        transform="rotate(-90 12 12)"
      />
    </Svg>
  );
}

function DayCell({
  day,
  weekdayLabelLength,
}: {
  day: WeekProgressDay;
  weekdayLabelLength: 2 | 3;
}) {
  const theme = useHoystTheme();
  const partialProgress = getPartialProgress(day);
  const visual = getDayCircleVisual(
    theme.isDark,
    day.state,
    partialProgress !== undefined,
  );
  const weekdayLabel = getWeekdayLabel(day, weekdayLabelLength);

  return (
    <View
      accessibilityLabel={getDayAccessibilityLabel(day, weekdayLabel)}
      style={styles.dayCell}>
      <HoystText
        allowFontScaling={false}
        style={[styles.weekdayLabel, {color: visual.label}]}>
        {weekdayLabel}
      </HoystText>
      <View style={styles.circleSlot}>
        <View
          testID={`week-progress-${day.dateKey}-chip`}
          style={[
            styles.circle,
            {
              backgroundColor: visual.background,
              borderColor: visual.border,
              borderWidth: visual.borderWidth,
              shadowColor:
                day.state === 'done' ? 'rgba(34,165,101,0.4)' : 'transparent',
            },
          ]}>
          {day.quantityLabel ? (
            <HoystText
              adjustsFontSizeToFit
              allowFontScaling={false}
              minimumFontScale={0.65}
              numberOfLines={1}
              style={[
                styles.quantityValue,
                {color: day.state === 'done' ? '#FFFFFF' : visual.label},
              ]}>
              {day.quantityLabel}
            </HoystText>
          ) : day.state === 'done' ? (
            <DayCheckIcon />
          ) : partialProgress !== undefined ? (
            <DayPartialRing dateKey={day.dateKey} progress={partialProgress} />
          ) : day.state === 'today' ? (
            <DayBoltIcon />
          ) : day.state === 'missed' ? (
            <DayMissIcon />
          ) : null}
        </View>
        {day.state === 'today' ? (
          <View style={styles.todayBadgeSlot}>
            <TodayArrowBadge />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StreakPill({streakDays}: {streakDays: number}) {
  const theme = useHoystTheme();
  const dayLabel = streakDays === 1 ? 'day' : 'days';

  return (
    <View
      style={[
        styles.streakPill,
        {
          backgroundColor: theme.glassSurfaceStrong,
          borderColor: theme.glassChipBorder,
        },
      ]}>
      <MomentumFlameIllustration size={16} />
      <HoystText
        allowFontScaling={false}
        style={[styles.streakPillLabel, {color: theme.warningForeground}]}>
        {`${streakDays} ${dayLabel}`}
      </HoystText>
    </View>
  );
}

// "Your week" content: an eyebrow + streak pill header over a row of seven
// soft day circles. It can render as a standalone section or in a panel.
export function WeekProgressStrip({
  compact = false,
  days,
  headerAccessory,
  showStreak = true,
  streakDays = 0,
  title = 'Your last 7 days',
  weekdayLabelLength = 2,
}: WeekProgressStripProps): React.JSX.Element {
  const accessibilityLabel = showStreak
    ? `${title}, ${streakDays} day streak`
    : title;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.strip, compact ? styles.stripCompact : undefined]}
      testID="week-progress-strip">
      <View style={styles.header}>
        <SectionEyebrow>{title}</SectionEyebrow>
        {showStreak || headerAccessory ? (
          <View
            style={styles.headerActions}
            testID="week-progress-header-actions">
            {showStreak ? <StreakPill streakDays={streakDays} /> : null}
            {headerAccessory}
          </View>
        ) : null}
      </View>
      <View style={styles.daysRow}>
        {days.map(day => (
          <DayCell
            day={day}
            key={day.dateKey}
            weekdayLabelLength={weekdayLabelLength}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: 16,
  },
  stripCompact: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    alignItems: 'center',
    gap: 8,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 13,
  },
  circleSlot: {
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    alignItems: 'center',
    borderRadius: 16,
    elevation: 2,
    height: 32,
    justifyContent: 'center',
    shadowOffset: {height: 3, width: 0},
    shadowOpacity: 0.5,
    shadowRadius: 6,
    width: 32,
  },
  quantityValue: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 13,
    maxWidth: 26,
    textAlign: 'center',
  },
  todayBadgeSlot: {
    bottom: -7,
    position: 'absolute',
  },
  todayBadge: {
    alignItems: 'center',
    backgroundColor: '#F5A623',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
  },
  streakPill: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 11,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  streakPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
});
