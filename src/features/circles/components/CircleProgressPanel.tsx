import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Info, X} from 'lucide-react-native';
import {DateTime} from 'luxon';
import {CircularEmoji} from '../../../design/components/CircularEmoji';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {
  DSSectionHeading,
  DSText,
  minimumTarget,
  useSystemTheme,
} from '../../../design/system';
import {
  formatCircleStreak,
  type CircleDayCoverage,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';
import type {CircleDetailModel} from '../../../types/models';
import {CircleGroupWeekPath} from './CircleGroupWeekPath';
import {loadCircleDayDetails} from '../services/circle-progress-service';
import {ProgressStatBadge} from '../../progress/components/ProgressStatBadge';

export function CircleProgressPanel({
  detail,
  viewer,
  group,
  days,
  coverage,
  loadDay = loadCircleDayDetails,
}: {
  detail: CircleDetailModel;
  viewer?: CircleProgressSummary;
  group?: CircleProgressSummary;
  days: readonly {dateKey: string}[];
  coverage: ReadonlyMap<string, CircleDayCoverage>;
  loadDay?: typeof loadCircleDayDetails;
}) {
  const theme = useHoystTheme();
  const systemTheme = useSystemTheme();
  const {width, fontScale} = useWindowDimensions();
  const stackMetrics = width < 390 || fontScale > 1.15;
  const personal = detail.circleMode === 'personal';
  const member = detail.viewerMembershipStatus === 'active';
  const [sheet, setSheet] = useState<{title: string; lines: string[]}>();
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const sheetHeading = useRef<View>(null);
  const caption =
    detail.commitmentCadence === 'daily'
      ? 'Today'
      : detail.commitmentCadence === 'monthly'
      ? 'This month'
      : 'This week';
  const showStreak = (kind: 'viewer' | 'group') =>
    setSheet({
      title: kind === 'viewer' ? 'Your streak' : 'Group streak',
      lines: [
        kind === 'viewer'
          ? 'Your streak counts consecutive periods in which you cover your eligible goal for this Circle.'
          : 'The group streak counts consecutive periods in which every eligible member covers their goal.',
        `This Circle counts ${
          detail.commitmentCadence === 'daily'
            ? 'days'
            : detail.commitmentCadence === 'monthly'
            ? 'months'
            : 'weeks'
        }. Weekly and monthly Tap Ins can happen on any eligible days within the period.`,
        'Completed goals and valid skips or restores count as covered. Partial and failed entries do not. An unfinished period keeps the previous streak while its goal remains achievable.',
        'Daily activity shows participation on each date. An empty day does not by itself break a weekly or monthly streak.',
        'A dash means supported history is unavailable or progress is updating.',
      ],
    });
  const showDay = async (day: string) => {
    const token = ++request.current;
    const value = coverage.get(day);
    const title = DateTime.fromISO(day).toFormat('cccc, LLLL d');
    if (!value?.known) {
      setSheet({
        title,
        lines: [
          'Historical membership or activity is unavailable for this date.',
        ],
      });
      return;
    }
    setSheet({title, lines: ['Loading activity…']});
    try {
      const entries = await loadDay(detail.id, day);
      if (request.current !== token) {
        return;
      }
      const lines = value.expectedUids.map(uid => {
        const entry = entries.find(item => item.id === uid);
        const name =
          detail.members.find(item => item.id === uid)?.name ??
          entry?.displayName ??
          'Former member';
        const status = value.restoredUids.includes(uid)
          ? 'Restored · Protected'
          : value.skippedUids.includes(uid)
          ? 'Skipped · Protected'
          : value.completedUids.includes(uid)
          ? 'Completed'
          : entry?.status === 'partial'
          ? 'Partial · Goal not met'
          : entry?.status === 'failed'
          ? 'Goal not met'
          : 'No covered Tap In';
        return `${name}: ${status}`;
      });
      setSheet({
        title,
        lines: [
          `${value.completedUids.length + value.skippedUids.length} of ${
            value.expectedUids.length
          } members covered. Membership reflects this date.`,
          ...lines,
        ],
      });
    } catch {
      if (request.current === token) {
        setSheet({
          title,
          lines: [
            'Could not load day details. Close and tap the day to retry.',
          ],
        });
      }
    }
  };
  const progress = (
    summary: CircleProgressSummary | undefined,
    isGroup: boolean,
  ) => {
    const known = summary && summary.progress.outcome !== 'unknown';
    const {covered = 0, required = 0} = summary?.progress ?? {};
    const copy = !known
      ? 'Progress unavailable'
      : required === 0
      ? 'No eligible goal this period'
      : isGroup
      ? `${covered} of ${required} met goal`
      : `${covered} of ${required} Tap In${required === 1 ? '' : 's'}`;
    const accessibleCopy =
      isGroup && known && required > 0
        ? `${covered} of ${required} member${
            required === 1 ? '' : 's'
          } met goal`
        : copy;
    return (
      <View
        style={[styles.metric, stackMetrics && styles.stackedMetric]}
        testID={
          isGroup
            ? 'circle-group-period-progress'
            : 'circle-viewer-period-progress'
        }>
        <View style={styles.metricRow}>
          <CircularEmoji
            kind={isGroup ? 'members' : 'personal'}
            size={36}
            emojiSize={22}
            backgroundColor={
              systemTheme.category[isGroup ? 'neutral' : 'green'].surface
            }
          />
          <View style={styles.metricCopy}>
            <DSText variant="statCaption" tone="muted">
              {isGroup ? 'Group' : 'You'}
            </DSText>
            <DSText variant={known && required > 0 ? 'title' : 'secondary'}>
              {known && required > 0 ? `${covered} of ${required}` : copy}
            </DSText>
            {known && required > 0 ? (
              <DSText variant="statCaption" tone="muted">
                {isGroup ? 'met goal' : `Tap In${required === 1 ? '' : 's'}`}
              </DSText>
            ) : null}
          </View>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${
            isGroup ? 'Group' : 'Your'
          } progress: ${accessibleCopy}`}
          accessibilityValue={
            known && required
              ? {min: 0, max: required, now: covered}
              : undefined
          }
          style={[styles.track, {backgroundColor: systemTheme.track}]}>
          <View
            style={{
              height: 5,
              width: `${
                known && required
                  ? Math.min(100, (covered / required) * 100)
                  : 0
              }%`,
              backgroundColor: isGroup
                ? theme.isDark
                  ? '#A2ADC0'
                  : '#7C879A'
                : theme.success,
              borderRadius: 5,
            }}
          />
        </View>
      </View>
    );
  };
  const streak = (
    summary: CircleProgressSummary | undefined,
    isGroup: boolean,
  ) => (
    <Pressable
      onPress={() => showStreak(isGroup ? 'group' : 'viewer')}
      accessibilityRole="button"
      accessibilityLabel={`${
        isGroup ? 'Group streak' : 'Your streak'
      }: ${formatCircleStreak(summary?.streak)}. Learn how it works.`}
      style={[
        styles.metric,
        styles.streak,
        stackMetrics && styles.stackedMetric,
      ]}
      testID={isGroup ? 'circle-group-streak' : 'circle-your-streak'}>
      <View style={styles.metricRow}>
        <ProgressStatBadge tone="orange" />
        <View style={styles.metricCopy}>
          <View style={styles.streakLabel}>
            <DSText
              variant="statCaption"
              tone="muted"
              style={styles.metricLabel}>
              {isGroup ? 'Group streak' : 'Your streak'}
            </DSText>
            <Info size={12} color={theme.textMuted} accessible={false} />
          </View>
          <DSText variant="title" style={{color: theme.streakForeground}}>
            {formatCircleStreak(summary?.streak)}
          </DSText>
        </View>
      </View>
    </Pressable>
  );
  const divider = () => (
    <View
      style={[
        styles.metricDivider,
        stackMetrics && styles.stackedDivider,
        {backgroundColor: systemTheme.track},
      ]}
    />
  );
  const tileStyle = [
    styles.tile,
    stackMetrics && styles.stackedTile,
    {backgroundColor: systemTheme.surface},
  ];
  return (
    <View
      key={fontScale}
      style={styles.section}
      testID="circle-detail-stats-content">
      {member ? (
        <View style={styles.activity}>
          <DSSectionHeading
            title="Daily activity"
            action={
              <View style={styles.legend}>
                <View style={[styles.dot, {backgroundColor: theme.success}]} />
                <HoystText style={styles.label} tone="muted">
                  You
                </HoystText>
                {!personal ? (
                  <>
                    <View style={[styles.dot, {backgroundColor: '#7C879A'}]} />
                    <HoystText style={styles.label} tone="muted">
                      Others
                    </HoystText>
                  </>
                ) : null}
              </View>
            }
          />
          <CircleGroupWeekPath
            days={days.map(day => {
              const value = coverage.get(day.dateKey);
              const viewerUid = detail.viewerUid;
              const covered = value
                ? [...value.completedUids, ...value.skippedUids]
                : [];
              return {
                ...day,
                known: value?.known ?? false,
                totalCount: value?.expectedUids.length,
                coveredCount: covered.length,
                skippedCount: value?.skippedUids.length,
                restoredCount: value?.restoredUids.length,
                viewerCovered: Boolean(
                  viewerUid && covered.includes(viewerUid),
                ),
                viewerEligible: Boolean(
                  viewerUid && value?.expectedUids.includes(viewerUid),
                ),
                state:
                  value?.known &&
                  value.expectedUids.length > 0 &&
                  covered.length >= value.expectedUids.length
                    ? ('done' as const)
                    : ('future' as const),
              };
            })}
            onDayPress={day => {
              showDay(day.dateKey).catch(() => undefined);
            }}
          />
        </View>
      ) : null}
      <View style={styles.period}>
        <DSSectionHeading title={caption} />
        {member || !personal ? (
          <View style={styles.row}>
            <View style={tileStyle} testID="circle-period-goals">
              {member ? progress(viewer, false) : null}
              {member && !personal ? divider() : null}
              {!personal ? progress(group, true) : null}
            </View>
            <View style={tileStyle} testID="circle-period-streaks">
              {member ? streak(viewer, false) : null}
              {member && !personal ? divider() : null}
              {!personal ? streak(group, true) : null}
            </View>
          </View>
        ) : null}
      </View>
      <Modal
        visible={Boolean(sheet)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          request.current++;
          setSheet(undefined);
        }}
        onShow={() => {
          const target = findNodeHandle(sheetHeading.current);
          if (target) {
            AccessibilityInfo.setAccessibilityFocus(target);
          }
        }}>
        <View style={styles.modalBackdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, {backgroundColor: theme.backgroundElevated}]}>
            <View style={styles.activityHeading}>
              <View ref={sheetHeading} accessible accessibilityRole="header">
                <HoystText variant="subtitle">{sheet?.title}</HoystText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close details"
                onPress={() => {
                  request.current++;
                  setSheet(undefined);
                }}
                style={styles.close}>
                <X color={theme.text} size={20} />
              </Pressable>
            </View>
            <ScrollView>
              {sheet?.lines.map((line, index) => (
                <HoystText key={index} style={styles.sheetLine}>
                  {line}
                </HoystText>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {gap: 12},
  period: {gap: 12},
  row: {gap: 12},
  tile: {flexDirection: 'row', padding: 12, borderRadius: 20},
  stackedTile: {flexDirection: 'column'},
  metric: {flex: 1, minWidth: 0},
  stackedMetric: {flex: 0},
  metricRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  metricCopy: {flex: 1, minWidth: 0},
  metricLabel: {flexShrink: 1},
  label: {fontSize: 12, lineHeight: 17, flexShrink: 1},
  track: {height: 5, borderRadius: 5, overflow: 'hidden', marginTop: 8},
  metricDivider: {width: StyleSheet.hairlineWidth, marginHorizontal: 12},
  stackedDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
    marginVertical: 12,
  },
  streak: {
    minHeight: minimumTarget(),
    minWidth: 0,
    justifyContent: 'center',
  },
  streakLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  activity: {gap: 8},
  activityHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  legend: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dot: {width: 9, height: 9, borderRadius: 5},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    padding: 22,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  close: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLine: {fontSize: 15, lineHeight: 22, marginBottom: 14},
});
