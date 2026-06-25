import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Path, Stop} from 'react-native-svg';

import type {HomeProgressCell} from '../../features/home/services/home-data-service';
import type {ProgressDayState} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystText} from './HoystText';
import {MomentumFlameIllustration} from './MomentumIllustrations';

type WeekProgressStripProps = {
  days: HomeProgressCell[];
  streakDays: number;
};

type DayChipVisual = {
  background: string;
  border: string;
  label: string;
};

function useGradientId(name: string) {
  return `${React.useId().replace(/[^a-zA-Z0-9]/g, '')}-${name}`;
}

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

function getDayChipVisual(
  isDark: boolean,
  state: ProgressDayState,
): DayChipVisual {
  if (state === 'done') {
    return isDark
      ? {
          background: 'rgba(16,185,103,0.14)',
          border: 'rgba(75,224,131,0.55)',
          label: '#4BE083',
        }
      : {background: '#F0F9E8', border: '#85C45C', label: '#3C8A24'};
  }

  if (state === 'today') {
    return isDark
      ? {
          background: 'rgba(255,196,0,0.12)',
          border: 'rgba(255,178,32,0.62)',
          label: '#FFB020',
        }
      : {background: '#FFF7E6', border: '#F4B64A', label: '#C27400'};
  }

  if (state === 'missed') {
    return isDark
      ? {
          background: 'rgba(255,59,48,0.12)',
          border: 'rgba(255,107,99,0.5)',
          label: '#FF6B63',
        }
      : {background: '#FDEFEE', border: '#F0A39C', label: '#D21F18'};
  }

  return isDark
    ? {
        background: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.12)',
        label: '#8D96AD',
      }
    : {background: '#FBFCFE', border: '#E2E8F0', label: '#9AA4BA'};
}

function DayCheckIcon({size = 18}: {size?: number}) {
  const gradientId = useGradientId('day-check');

  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Defs>
        <LinearGradient id={gradientId} x1="4" x2="20" y1="6" y2="20">
          <Stop offset="0" stopColor="#46C24E" />
          <Stop offset="1" stopColor="#1E9E3E" />
        </LinearGradient>
      </Defs>
      <Path
        d="M5 13.2 9.8 18 19.4 7.4"
        fill="none"
        opacity={0.35}
        stroke="#0D7A2C"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={5.4}
      />
      <Path
        d="M5 12.6 9.8 17.4 19.4 6.8"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4.4}
      />
    </Svg>
  );
}

function DayBoltIcon({size = 18}: {size?: number}) {
  const gradientId = useGradientId('day-bolt');

  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Defs>
        <LinearGradient id={gradientId} x1="6" x2="18" y1="2" y2="22">
          <Stop offset="0" stopColor="#FFD54F" />
          <Stop offset="1" stopColor="#F57F17" />
        </LinearGradient>
      </Defs>
      <Path
        d="M13.4 2.4 6 13.4h4.4L9.4 21.6l7.8-11.2h-4.6l.8-8Z"
        fill={`url(#${gradientId})`}
        stroke="#E08600"
        strokeLinejoin="round"
        strokeWidth={1}
      />
      <Path
        d="m12.4 5.4-3.6 6h2.4"
        fill="none"
        opacity={0.65}
        stroke="#FFF3CD"
        strokeLinecap="round"
        strokeWidth={1.4}
      />
    </Svg>
  );
}

function DayMissIcon({size = 16}: {size?: number}) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M7 7.6 17 17.6M17 7.6 7 17.6"
        fill="none"
        opacity={0.35}
        stroke="#9F1812"
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="#E0392F"
        strokeLinecap="round"
        strokeWidth={4}
      />
    </Svg>
  );
}

function TodayCoinBadge({size = 18}: {size?: number}) {
  const gradientId = useGradientId('today-coin');

  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Defs>
        <LinearGradient id={gradientId} x1="4" x2="20" y1="4" y2="20">
          <Stop offset="0" stopColor="#FFC400" />
          <Stop offset="1" stopColor="#F57F17" />
        </LinearGradient>
      </Defs>
      <Circle
        cx={12}
        cy={12}
        fill={`url(#${gradientId})`}
        r={11}
        stroke="#FFFFFF"
        strokeWidth={2}
      />
      <Path
        d="M12 17V8.4M8.4 11.6 12 8l3.6 3.6"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.6}
      />
    </Svg>
  );
}

function DayChip({day}: {day: HomeProgressCell}) {
  const theme = useHoystTheme();
  const visual = getDayChipVisual(theme.isDark, day.state);
  const weekdayLabel = getWeekdayLabel(day);
  const shadowColor = theme.isDark ? theme.shadow : 'rgba(15,23,42,0.16)';

  return (
    <View
      accessibilityLabel={`${weekdayLabel}: ${day.state}`}
      style={styles.dayChipSlot}>
      <View
        testID={`week-progress-${day.dateKey}-chip`}
        style={[
          styles.dayChip,
          {
            backgroundColor: visual.background,
            borderColor: visual.border,
            shadowColor,
          },
        ]}>
        <HoystText
          allowFontScaling={false}
          style={[styles.dayChipLabel, {color: visual.label}]}>
          {weekdayLabel}
        </HoystText>
        <View style={styles.dayChipIcon}>
          {day.state === 'done' ? (
            <DayCheckIcon />
          ) : day.state === 'today' ? (
            <DayBoltIcon />
          ) : day.state === 'missed' ? (
            <DayMissIcon />
          ) : null}
        </View>
      </View>
      {day.state === 'today' ? (
        <View style={styles.dayChipBadge}>
          <TodayCoinBadge />
        </View>
      ) : null}
    </View>
  );
}

export function WeekProgressStrip({
  days,
  streakDays,
}: WeekProgressStripProps): React.JSX.Element {
  const theme = useHoystTheme();
  const streakColor = theme.isDark ? '#FF8A3D' : '#E8650D';

  return (
    <View
      accessibilityLabel={`Last 7 days, ${streakDays} day streak`}
      style={styles.strip}>
      <View style={styles.daysRow}>
        {days.map(day => (
          <DayChip day={day} key={day.dateKey} />
        ))}
      </View>
      <View style={styles.streakCluster}>
        <View style={styles.streakFlameFrame}>
          <MomentumFlameIllustration size={30} />
        </View>
        <HoystText
          allowFontScaling={false}
          style={[styles.streakCount, {color: streakColor}]}>
          {streakDays}
        </HoystText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  dayChipSlot: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  dayChip: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 2,
    elevation: 2,
    gap: 2,
    minHeight: 56,
    paddingBottom: 8,
    paddingTop: 6,
    position: 'relative',
    shadowOffset: {height: 2, width: 0},
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  dayChipLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  dayChipIcon: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
  },
  dayChipBadge: {
    alignSelf: 'center',
    bottom: -9,
    position: 'absolute',
  },
  streakCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
  },
  streakFlameFrame: {
    marginRight: -3,
  },
  streakCount: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
});
