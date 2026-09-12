import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {Check, Minus} from 'lucide-react-native';
import {DateTime} from 'luxon';

import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {ProgressDayState} from '../../../types/models';

type CircleWeekCell = {
  coveredCount?: number;
  dateKey: string;
  quantityLabel?: string;
  quantityValue?: number;
  state: ProgressDayState;
  totalCount?: number;
};

const OFFSETS = [0, 4, 0, 14, 0, 10, 3];
const NODE_SIZE = 22;
const PARTIAL_RADIUS = 8.4;
const PARTIAL_CIRCUMFERENCE = 2 * Math.PI * PARTIAL_RADIUS;

function getCoverage(day: CircleWeekCell) {
  if (!day.totalCount || day.totalCount <= 0) {
    return undefined;
  }

  return Math.max(0, Math.min(1, (day.coveredCount ?? 0) / day.totalCount));
}

function getStatusLabel(day: CircleWeekCell, partial: boolean) {
  if (day.state === 'done') {
    return 'complete';
  }

  if (partial) {
    return 'partial';
  }

  if (day.state === 'missed') {
    return 'missed';
  }

  if (day.state === 'today') {
    return 'today';
  }

  return 'empty';
}

export function CircleGroupWeekPath({
  days,
}: {
  days: readonly CircleWeekCell[];
}): React.JSX.Element {
  const theme = useHoystTheme();
  const {fontScale, width} = useWindowDimensions();
  const labelScale = Math.min(fontScale, 1.2);
  const innerWidth = width - 44;
  const columnWidth = innerWidth / Math.max(1, days.length);
  const centers = days.map((_, index) => ({
    x: columnWidth * (index + 0.5),
    y: 17 + OFFSETS[index % OFFSETS.length],
  }));

  return (
    <View style={styles.week} testID="circle-group-week-path">
      <Svg
        height={55}
        pointerEvents="none"
        style={styles.path}
        width={innerWidth}>
        <Path
          d={centers
            .map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`)
            .join(' ')}
          fill="none"
          stroke={theme.isDark ? '#71717A' : '#A0A0A5'}
          strokeDasharray="5 6"
          strokeWidth={1.4}
        />
      </Svg>
      {days.map((day, index) => {
        const date = DateTime.fromISO(day.dateKey);
        const offset = OFFSETS[index % OFFSETS.length];
        const today = day.state === 'today' || index === days.length - 1;
        const coverage = getCoverage(day);
        const partial =
          day.state !== 'done' &&
          (coverage !== undefined
            ? coverage > 0
            : (day.quantityValue ?? 0) > 0);
        const complete = day.state === 'done';
        const todayLabelColor =
          today && complete ? theme.successForeground : theme.accentForeground;
        const statusLabel = getStatusLabel(day, partial);
        const coverageLabel =
          day.totalCount !== undefined
            ? `, ${day.coveredCount ?? 0} of ${day.totalCount} completed`
            : day.quantityLabel
            ? `, ${day.quantityLabel} logged`
            : '';
        const nodeBorderColor = complete
          ? theme.success
          : today
          ? theme.accentForeground
          : day.state === 'missed'
          ? theme.dangerForeground
          : theme.textSubtle;

        return (
          <View
            accessible
            accessibilityLabel={`${date.toFormat(
              'cccc, LLLL d',
            )}: ${statusLabel}${coverageLabel}${today ? ', today' : ''}`}
            key={day.dateKey}
            style={styles.day}>
            <View
              style={[
                styles.node,
                {
                  backgroundColor: complete
                    ? theme.success
                    : theme.isDark
                    ? '#121212'
                    : '#FAFAF7',
                  borderColor: nodeBorderColor,
                  marginTop: offset + 6,
                },
              ]}
              testID={`circle-group-week-node-${day.dateKey}`}>
              {complete ? (
                <Check color="#FFFFFF" size={13} strokeWidth={2.5} />
              ) : partial ? (
                <Svg
                  height={NODE_SIZE}
                  pointerEvents="none"
                  style={styles.partialArc}
                  width={NODE_SIZE}
                  testID={`circle-group-week-partial-${day.dateKey}`}>
                  <Circle
                    cx={NODE_SIZE / 2}
                    cy={NODE_SIZE / 2}
                    fill="none"
                    r={PARTIAL_RADIUS}
                    stroke={
                      theme.isDark
                        ? 'rgba(255,255,255,0.16)'
                        : 'rgba(16,185,103,0.16)'
                    }
                    strokeWidth={2.5}
                  />
                  <Circle
                    cx={NODE_SIZE / 2}
                    cy={NODE_SIZE / 2}
                    fill="none"
                    r={PARTIAL_RADIUS}
                    stroke={theme.success}
                    strokeDasharray={`${
                      PARTIAL_CIRCUMFERENCE * (coverage ?? 0.34)
                    } ${PARTIAL_CIRCUMFERENCE}`}
                    strokeLinecap="round"
                    strokeWidth={2.5}
                    transform={`rotate(-90 ${NODE_SIZE / 2} ${NODE_SIZE / 2})`}
                  />
                </Svg>
              ) : day.state === 'missed' ? (
                <Minus color={nodeBorderColor} size={12} strokeWidth={2.2} />
              ) : null}
            </View>
            <HoystText
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.weekday,
                {
                  color: today ? todayLabelColor : theme.textMuted,
                  fontSize: 12 * labelScale,
                  lineHeight: 16 * labelScale,
                  marginTop: 26 - offset,
                },
              ]}>
              {date.toFormat('ccc')}
            </HoystText>
            <HoystText
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.date,
                {
                  color: today ? todayLabelColor : theme.text,
                  fontSize: 14 * labelScale,
                  lineHeight: 20 * labelScale,
                },
              ]}>
              {date.toFormat('d')}
            </HoystText>
            {today ? (
              <HoystText
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.today,
                  {
                    color: todayLabelColor,
                    fontSize: 12 * labelScale,
                    lineHeight: 16 * labelScale,
                  },
                ]}>
                Today
              </HoystText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  date: {fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 2},
  day: {alignItems: 'center', flex: 1},
  node: {
    alignItems: 'center',
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    height: NODE_SIZE,
    justifyContent: 'center',
    width: NODE_SIZE,
  },
  partialArc: {position: 'absolute'},
  path: {left: 0, position: 'absolute', top: 0},
  today: {fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 4},
  week: {flexDirection: 'row', minHeight: 112},
  weekday: {fontSize: 12, fontWeight: '500', lineHeight: 16},
});
