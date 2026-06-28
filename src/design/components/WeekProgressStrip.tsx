import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import type {HomeProgressCell} from '../../features/home/services/home-data-service';
import type {ProgressDayState} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {MomentumFlameIllustration} from './MomentumIllustrations';
import {SectionEyebrow} from './SectionEyebrow';

type WeekProgressStripProps = {
  days: HomeProgressCell[];
  streakDays: number;
};

type DayCircleVisual = {
  background: string;
  border: string;
  borderWidth: number;
  label: string;
};

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

// progressDays labels are day-of-month ("03"); the strip shows weekday names
// like the reference design, derived from the cell's date key.
function getWeekdayLabel(day: HomeProgressCell) {
  const date = new Date(`${day.dateKey}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return day.label;
  }

  return WEEKDAY_LABELS[date.getDay()];
}

function getDayCircleVisual(
  isDark: boolean,
  state: ProgressDayState,
): DayCircleVisual {
  if (state === 'done') {
    return {
      background: '#22A565',
      border: 'rgba(34,165,101,0.5)',
      borderWidth: 0,
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

function DayCell({day}: {day: HomeProgressCell}) {
  const theme = useHoystTheme();
  const visual = getDayCircleVisual(theme.isDark, day.state);
  const weekdayLabel = getWeekdayLabel(day);

  return (
    <View
      accessibilityLabel={`${weekdayLabel}: ${day.state}`}
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
          {day.state === 'done' ? (
            <DayCheckIcon />
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

// "Your week" content (v4 frosted style): an eyebrow + streak pill header over
// a row of seven soft day circles. Render inside a GlassPanel.
export function WeekProgressStrip({
  days,
  streakDays,
}: WeekProgressStripProps): React.JSX.Element {
  return (
    <View
      accessibilityLabel={`Last 7 days, ${streakDays} day streak`}
      style={styles.strip}>
      <View style={styles.header}>
        <SectionEyebrow>Your last 7 days</SectionEyebrow>
        <StreakPill streakDays={streakDays} />
      </View>
      <View style={styles.daysRow}>
        {days.map(day => (
          <DayCell day={day} key={day.dateKey} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
