import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {Check, Minus} from 'lucide-react-native';
import {DateTime} from 'luxon';

import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {ProgressDayState} from '../../../types/models';

export type CircleWeekCell = {
  known?: boolean;
  viewerCovered?: boolean;
  viewerEligible?: boolean;
  coveredCount?: number;
  skippedCount?: number;
  restoredCount?: number;
  dateKey: string;
  quantityLabel?: string;
  quantityValue?: number;
  state: ProgressDayState;
  totalCount?: number;
};

const OFFSETS = [0, 4, 0, 14, 0, 10, 3];
// Match HomeWeekPath's marker and connector geometry without changing Home.
const NODE_SIZE = 22;
const PARTIAL_STROKE_WIDTH = 3;

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
  onDayPress,
}: {
  days: readonly CircleWeekCell[];
  onDayPress?: (day: CircleWeekCell) => void;
}): React.JSX.Element {
  const theme = useHoystTheme();
  const {fontScale, width} = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(width - 44);
  const labelScale = fontScale;
  const innerWidth = Math.max(availableWidth, days.length * 40 * fontScale);
  const columnWidth = innerWidth / Math.max(1, days.length);
  const centers = days.map((_, index) => ({
    x: columnWidth * (index + 0.5),
    y: NODE_SIZE / 2 + 6 + OFFSETS[index % OFFSETS.length],
  }));

  return (
    <ScrollView
      horizontal
      onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
      showsHorizontalScrollIndicator={false}>
      <View
        style={[styles.week, {width: innerWidth, minHeight: 112 * labelScale}]}
        testID="circle-group-week-path">
        <Svg
          height={55}
          pointerEvents="none"
          style={styles.path}
          width={innerWidth}>
          <Path
            d={centers
              .map(
                (point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`,
              )
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
          // Keep today's outline visible around the member contribution ring.
          const partialRadius =
            (NODE_SIZE - PARTIAL_STROKE_WIDTH) / 2 - (today ? 1.5 : 0);
          const partialCircumference = 2 * Math.PI * partialRadius;
          const known = day.known !== false;
          const coverage = known ? getCoverage(day) : undefined;
          const selfFraction =
            day.viewerCovered && day.totalCount ? 1 / day.totalCount : 0;
          const othersFraction = Math.max(0, (coverage ?? 0) - selfFraction);
          const othersOffset =
            day.viewerEligible && day.totalCount ? 1 / day.totalCount : 0;
          const partial =
            day.state !== 'done' &&
            (coverage !== undefined
              ? coverage > 0
              : (day.quantityValue ?? 0) > 0);
          const complete = known && day.state === 'done';
          const todayLabelColor =
            today && complete
              ? theme.successForeground
              : theme.accentForeground;
          const statusLabel = known
            ? getStatusLabel(day, partial)
            : 'history unavailable';
          const coverageLabel =
            known && day.totalCount !== undefined
              ? `, ${day.coveredCount ?? 0} of ${day.totalCount} covered${
                  day.skippedCount
                    ? `, ${day.skippedCount} protected by skip or restore`
                    : ''
                }${day.restoredCount ? `, ${day.restoredCount} restored` : ''}`
              : day.quantityLabel
              ? `, ${day.quantityLabel} logged`
              : '';
          const nodeBorderColor = complete
            ? theme.success
            : today
            ? theme.accentForeground
            : day.state === 'missed'
            ? theme.dangerForeground
            : theme.isDark
            ? '#41414A'
            : '#E1E1E7';

          return (
            <Pressable
              accessible
              accessibilityRole={onDayPress ? 'button' : undefined}
              accessibilityHint={
                onDayPress
                  ? 'View completion, skip, and restore details for this day'
                  : undefined
              }
              onPress={() => onDayPress?.(day)}
              accessibilityLabel={`${date.toFormat(
                'cccc, LLLL d',
              )}: ${statusLabel}${coverageLabel}${
                known
                  ? day.viewerCovered
                    ? ', you covered'
                    : ', you have no covered Tap In'
                  : ''
              }${today ? ', today' : ''}`}
              key={day.dateKey}
              style={[styles.day, {minWidth: columnWidth}]}>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: complete
                      ? theme.success
                      : theme.isDark
                      ? '#121212'
                      : '#FAFAF7',
                    borderColor:
                      partial && !today ? 'transparent' : nodeBorderColor,
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
                      r={partialRadius}
                      stroke={theme.isDark ? '#41414A' : '#E1E1E7'}
                      strokeWidth={PARTIAL_STROKE_WIDTH}
                    />
                    {selfFraction > 0 ? (
                      <Circle
                        testID={`circle-day-you-${day.dateKey}`}
                        cx={NODE_SIZE / 2}
                        cy={NODE_SIZE / 2}
                        fill="none"
                        r={partialRadius}
                        stroke={theme.success}
                        strokeDasharray={`${
                          partialCircumference * selfFraction
                        } ${partialCircumference}`}
                        strokeWidth={PARTIAL_STROKE_WIDTH}
                        transform={`rotate(-90 ${NODE_SIZE / 2} ${
                          NODE_SIZE / 2
                        })`}
                      />
                    ) : null}
                    {othersFraction > 0 ? (
                      <Circle
                        testID={`circle-day-others-${day.dateKey}`}
                        cx={NODE_SIZE / 2}
                        cy={NODE_SIZE / 2}
                        fill="none"
                        r={partialRadius}
                        stroke={theme.isDark ? '#A2ADC0' : '#7C879A'}
                        strokeDasharray={`${
                          partialCircumference * othersFraction
                        } ${partialCircumference}`}
                        strokeDashoffset={-partialCircumference * othersOffset}
                        strokeWidth={PARTIAL_STROKE_WIDTH}
                        transform={`rotate(-90 ${NODE_SIZE / 2} ${
                          NODE_SIZE / 2
                        })`}
                      />
                    ) : null}
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
              <HoystText style={[styles.count, {color: theme.textMuted}]}>
                {known && day.totalCount !== undefined
                  ? `${day.coveredCount ?? 0}/${day.totalCount}`
                  : '—'}
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
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  count: {fontSize: 11, lineHeight: 16, marginTop: 3},
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
