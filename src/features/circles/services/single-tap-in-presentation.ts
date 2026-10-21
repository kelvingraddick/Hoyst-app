import type {CircleDetailModel} from '../../../types/models';
import type {
  CircleDayCoverage,
  CircleProgressSummary,
} from '../../../shared/circle-progress';
import {shiftCircleDate} from '../../../shared/circle-progress';
import {
  formatQuantityValue,
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
  isSingleTapInCommitment,
} from '../../commitments/commitment-logic';
import {
  formatCommitmentQuantity,
  getCommitmentGoalPresentation,
} from '../../commitments/commitment-goal-label';

type SingleTapInPresentation = {
  status:
    | 'Needs Tap In'
    | 'In progress'
    | 'Goal met'
    | 'Goal not met'
    | 'Skipped'
    | 'Protected'
    | 'Progress unavailable';
  supportingText?: string;
};

/** Retain the activity strip and include earlier single-goal period protection. */
export function getSingleTapInCoverageDates(
  summary: CircleProgressSummary | undefined,
  timeline: readonly string[],
) {
  const dates = new Set(timeline);
  if (
    summary?.progress.required === 1 &&
    summary.progress.outcome !== 'unknown'
  ) {
    for (
      let day = summary.period.start;
      day <= summary.period.end && day <= summary.asOfDateKey;
      day = shiftCircleDate(day, 1)
    ) {
      dates.add(day);
    }
  }
  return [...dates];
}

/** Present one period goal without confusing saved activity with goal coverage. */
export function getSingleTapInPresentation({
  detail,
  summary,
  coverage,
}: {
  detail: CircleDetailModel;
  summary?: CircleProgressSummary;
  coverage: ReadonlyMap<string, CircleDayCoverage>;
}): SingleTapInPresentation | undefined {
  if (
    !summary ||
    summary.progress.outcome === 'unknown' ||
    summary.progress.required !== 1
  ) {
    return undefined;
  }

  const inPeriod = (date: string) =>
    date >= summary.period.start &&
    date <= summary.period.end &&
    date <= summary.asOfDateKey;
  const todayEntry = detail.viewerTodayCheckIn;
  // Older Today records can omit dateKey; their date is the summary's as-of day.
  const saved =
    todayEntry && inPeriod(todayEntry.dateKey ?? summary.asOfDateKey)
      ? todayEntry
      : undefined;
  const goal = {...detail, ...saved};
  const type = getCommitmentType(goal);
  const tracksAmount =
    type === 'limit' || (type === 'build' && !isSingleTapInCommitment(goal));
  const config = getQuantityConfig(goal);
  const value = saved?.currentValue;
  const hasValue =
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const savedCoverage =
    saved?.status === 'skip'
      ? 'skipped'
      : saved?.status === 'partial' || saved?.status === 'failed'
      ? saved.status
      : saved?.status === 'done'
      ? saved.coverageStatus ??
        (tracksAmount && hasValue
          ? getCoverageStatusForValue({circle: goal, currentValue: value})
          : tracksAmount
          ? undefined
          : 'covered')
      : undefined;

  // Quantity copy describes one Tap In, not the cadence's Tap In count.
  const target = tracksAmount
    ? getCommitmentGoalPresentation({...goal, commitmentFrequency: undefined})
    : undefined;
  const targetCopy = target ? `${target.label}: ${target.value}` : undefined;
  const amountCopy =
    tracksAmount && hasValue
      ? type === 'build'
        ? `${formatQuantityValue(value)} of ${formatCommitmentQuantity(
            config.targetValue ?? 1,
            config.unitLabel,
          )}`
        : `${formatCommitmentQuantity(value, config.unitLabel)} · ${targetCopy}`
      : undefined;
  const periodDays = [...coverage.entries()]
    .filter(
      ([date, day]) =>
        inPeriod(date) &&
        day.known &&
        Boolean(
          detail.viewerUid && day.expectedUids.includes(detail.viewerUid),
        ),
    )
    .map(([, day]) => day);
  const uid = detail.viewerUid ?? '';

  if (summary.progress.covered > 0 || savedCoverage === 'covered') {
    if (savedCoverage === 'covered') {
      return {status: 'Goal met', supportingText: amountCopy};
    }
    if (periodDays.some(day => day.completedUids.includes(uid))) {
      return {status: 'Goal met'};
    }
    if (periodDays.some(day => day.restoredUids.includes(uid))) {
      return {status: 'Protected'};
    }
    if (
      savedCoverage === 'skipped' ||
      periodDays.some(day => day.skippedUids.includes(uid))
    ) {
      return {status: 'Skipped'};
    }
    // Covered includes protection, so the aggregate alone cannot claim completion.
    return {status: 'Progress unavailable'};
  }
  if (savedCoverage === 'skipped') {
    return {status: 'Skipped'};
  }
  if (savedCoverage === 'failed' || summary.progress.outcome === 'broken') {
    return {status: 'Goal not met', supportingText: amountCopy ?? targetCopy};
  }
  if (savedCoverage === 'partial') {
    return {status: 'In progress', supportingText: amountCopy ?? targetCopy};
  }
  return {status: 'Needs Tap In', supportingText: targetCopy};
}
