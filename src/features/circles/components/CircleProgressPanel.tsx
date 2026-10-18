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
import {Flame, Info, UserRound, UsersRound, X} from 'lucide-react-native';
import {DateTime} from 'luxon';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {
  DSSectionHeading,
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
  const {fontScale} = useWindowDimensions();
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
    const Icon = isGroup ? UsersRound : UserRound;
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
        style={[styles.tile, {backgroundColor: systemTheme.surface}]}
        testID={
          isGroup
            ? 'circle-group-period-progress'
            : 'circle-viewer-period-progress'
        }>
        <View style={styles.tileHeading}>
          <Icon size={20} color={theme.textMuted} accessible={false} />
          <HoystText tone="muted" style={styles.tileTitle}>
            {isGroup ? 'Group' : 'You'}
          </HoystText>
        </View>
        <HoystText style={styles.progressValue}>
          {!known || required === 0
            ? copy
            : `${covered} of ${required} `}
          {known && required > 0 ? (
            <HoystText style={styles.progressEmphasis}>
              {isGroup ? 'met goal' : `Tap In${required === 1 ? '' : 's'}`}
            </HoystText>
          ) : null}
        </HoystText>
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
        <View
          style={[styles.streakFooter, {borderTopColor: systemTheme.track}]}>
          {streak(summary, isGroup)}
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
      style={styles.streak}
      testID={isGroup ? 'circle-group-streak' : 'circle-your-streak'}>
      <View style={styles.streakLabel}>
        <HoystText style={styles.label} tone="muted">
          {isGroup ? 'Group streak' : 'Your streak'}
        </HoystText>
        <Info size={12} color={theme.textMuted} accessible={false} />
      </View>
      <View style={styles.streakMetric}>
        <Flame size={14} color={theme.streakForeground} accessible={false} />
        <HoystText
          style={[styles.streakValue, {color: theme.streakForeground}]}>
          {formatCircleStreak(summary?.streak)}
        </HoystText>
      </View>
    </Pressable>
  );
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
        <View style={styles.row}>
          {member ? progress(viewer, false) : null}
          {!personal ? progress(group, true) : null}
        </View>
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
  row: {flexDirection: 'row', gap: 12},
  tile: {flex: 1, minWidth: 0, gap: 6, padding: 12, borderRadius: 20},
  tileHeading: {flexDirection: 'row', alignItems: 'center', gap: 6},
  tileTitle: {fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1},
  label: {fontSize: 12, lineHeight: 17, flexShrink: 1},
  progressValue: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
  progressEmphasis: {fontSize: 14, lineHeight: 20, fontWeight: '600'},
  track: {height: 5, borderRadius: 5, overflow: 'hidden'},
  streakFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    paddingTop: 4,
  },
  streak: {
    minHeight: minimumTarget(),
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
  },
  streakValue: {fontSize: 16, lineHeight: 21, fontWeight: '600', flexShrink: 1},
  streakLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  streakMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 0,
    gap: 2,
    maxWidth: '100%',
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
