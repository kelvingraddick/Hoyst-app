import React, {useState} from 'react';
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {FastForward, LockKeyhole, RotateCcw} from 'lucide-react-native';
import {DSText, useSystemTheme} from '../../../design/system';
import {brandColors} from '../../../design/tokens/colors';
import type {ProgressSummary} from '../services/progress-service';

type Point = {x: number; y: number};
function sparkle(size: number) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M8 0 10.2 5.8 16 8 10.2 10.2 8 16 5.8 10.2 0 8 5.8 5.8Z"
        fill="#FFC331"
      />
    </Svg>
  );
}

/** Measured anchors keep decoration attached to the native, scalable content. */
export function ProgressLadder({
  summary,
  onDetails,
}: {
  summary: ProgressSummary;
  onDetails: () => void;
}) {
  const theme = useSystemTheme();
  const {fontScale} = useWindowDimensions();
  const [anchors, setAnchors] = useState<Record<number, Point>>({});
  const largeText = fontScale >= 1.5;
  const nodeSize = 56 * Math.max(1, fontScale);
  const radius = nodeSize / 2;
  const first = anchors[0];
  const next = anchors[1];
  const last = anchors[2];
  const start = first && {x: first.x + 9, y: first.y + radius - 2};
  const end = next && {x: next.x - radius + 2, y: next.y - 8};
  const control1 = start && {x: start.x + 12, y: start.y + 22};
  const control2 = end && {x: end.x - 38, y: end.y - 12};
  const t = Math.max(0, Math.min(1, summary.levelXP / summary.requiredXP));
  const curvePoint = (axis: 'x' | 'y') =>
    start && end && control1 && control2
      ? (1 - t) ** 3 * start[axis] +
        3 * (1 - t) ** 2 * t * control1[axis] +
        3 * (1 - t) * t ** 2 * control2[axis] +
        t ** 3 * end[axis]
      : 0;
  return (
    <View style={styles.ladder}>
      {!largeText && start && end && control1 && control2 && next && last ? (
        <Svg
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}>
          <Path
            d={`M${start.x} ${start.y} C${control1.x} ${control1.y} ${
              control2.x
            } ${control2.y} ${end.x} ${end.y} M${next.x - 8} ${
              next.y + radius - 2
            } C${next.x - 20} ${next.y + radius + 22} ${last.x} ${
              last.y - radius - 25
            } ${last.x} ${last.y - radius + 2}`}
            stroke={theme.isDark ? '#777780' : '#9B9BA4'}
            strokeWidth={1.5}
            strokeDasharray="5 6"
            strokeLinecap="round"
            fill="none"
          />
          <Circle
            cx={curvePoint('x')}
            cy={curvePoint('y')}
            r={7}
            fill={theme.category.blue.surface}
          />
          <Circle
            cx={curvePoint('x')}
            cy={curvePoint('y')}
            r={4}
            fill="#18B9FF"
            stroke={theme.surface}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
      {[0, 1, 2].map(offset => {
        const level = summary.level + offset;
        const current = offset === 0;
        const locked = offset === 2;
        const restore = level > 1 && (level - 1) % 3 === 0;
        const tone = current ? 'green' : locked ? 'neutral' : 'blue';
        const category = theme.category[tone];
        const label =
          offset === 0
            ? level > 1
              ? 'Earned'
              : 'Your journey starts here'
            : offset === 1
            ? `${summary.remainingXP} XP away. 1 skip${
                restore ? ' and 1 restore' : ''
              }`
            : `Locked. 1 skip${restore ? ' and 1 restore' : ''}`;
        return (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityLabel={`Level ${level}. ${label}. View level details.`}
            onPress={onDetails}
            onLayout={({nativeEvent: {layout}}) => {
              const point = {
                x: layout.x + radius,
                y: layout.y + layout.height / 2,
              };
              setAnchors(previous =>
                previous[offset]?.x === point.x &&
                previous[offset]?.y === point.y
                  ? previous
                  : {...previous, [offset]: point},
              );
            }}
            style={[styles.row, offset === 1 && !largeText && styles.next]}>
            <View
              style={[
                styles.ring,
                {
                  width: nodeSize,
                  height: nodeSize,
                  borderRadius: radius,
                  borderColor: locked ? theme.border : category.surface,
                  backgroundColor: theme.surface,
                },
              ]}>
              <View
                style={[
                  styles.core,
                  {
                    borderRadius: radius,
                    backgroundColor: current
                      ? brandColors.green
                      : category.surface,
                  },
                ]}>
                <DSText
                  style={[
                    styles.number,
                    {
                      color: current ? brandColors.white : category.foreground,
                    },
                  ]}>
                  {level}
                </DSText>
              </View>
              {locked ? (
                <View
                  style={[
                    styles.lock,
                    {backgroundColor: theme.surface, borderColor: theme.border},
                  ]}>
                  <LockKeyhole size={12} color={theme.muted} />
                </View>
              ) : offset === 1 ? (
                <View
                  pointerEvents="none"
                  accessible={false}
                  style={styles.sparkles}>
                  <View style={styles.sparkleTop}>{sparkle(10)}</View>
                  <View style={styles.sparkleSide}>{sparkle(7)}</View>
                  <View style={styles.sparkleBottom}>{sparkle(9)}</View>
                </View>
              ) : null}
            </View>
            <View style={[styles.copy, offset !== 1 && styles.wideCopy]}>
              <DSText variant="title">Level {level}</DSText>
              {offset === 0 ? (
                level === 1 ? (
                  <DSText variant="secondary" tone="muted">
                    Your journey starts here
                  </DSText>
                ) : (
                  <View
                    style={[
                      styles.earned,
                      {backgroundColor: category.surface},
                    ]}>
                    <DSText
                      variant="category"
                      style={{color: category.foreground}}>
                      Earned
                    </DSText>
                  </View>
                )
              ) : (
                <>
                  {offset === 1 ? (
                    <DSText variant="secondary" tone="muted">
                      {summary.remainingXP} XP away
                    </DSText>
                  ) : null}
                  <View style={styles.rewards}>
                    <View style={styles.reward}>
                      <FastForward
                        size={18}
                        color={brandColors.green}
                        fill={brandColors.green}
                      />
                      <DSText variant="secondary">1 skip</DSText>
                    </View>
                    {restore ? (
                      <>
                        <DSText variant="secondary" tone="muted">
                          +
                        </DSText>
                        <View style={styles.reward}>
                          <RotateCcw size={18} color={theme.warning} />
                          <DSText variant="secondary">1 restore</DSText>
                        </View>
                      </>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  ladder: {gap: 12, paddingHorizontal: 20, paddingVertical: 8},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56},
  next: {alignSelf: 'flex-end', maxWidth: '78%'},
  ring: {borderWidth: 2, padding: 4, justifyContent: 'center', flexShrink: 0},
  core: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  number: {fontSize: 24, lineHeight: 28, fontWeight: '600'},
  copy: {flexShrink: 1, gap: 2},
  wideCopy: {flex: 1},
  earned: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  rewards: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  reward: {flexDirection: 'row', alignItems: 'center', gap: 5},
  lock: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkles: {...StyleSheet.absoluteFillObject, overflow: 'visible'},
  sparkleTop: {position: 'absolute', top: -13, left: 5},
  sparkleSide: {position: 'absolute', top: -3, left: -9},
  sparkleBottom: {position: 'absolute', bottom: -10, right: 1},
});
