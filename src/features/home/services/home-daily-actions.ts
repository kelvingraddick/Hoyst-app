import {DateTime} from 'luxon';
import type {CircleManagementCard} from '../../../types/models';
import {canTapInToday} from './home-circle-actions';

export type HomeDailyAction =
  | 'tap_in'
  | 'nudge'
  | 'complete'
  | 'pending'
  | 'view';

export function hasNudgedOnCircleDay(
  lastNudgedAt: Date | undefined,
  timezone = 'UTC',
  now = new Date(),
) {
  return Boolean(
    lastNudgedAt &&
      DateTime.fromJSDate(lastNudgedAt, {zone: timezone}).hasSame(
        DateTime.fromJSDate(now, {zone: timezone}),
        'day',
      ),
  );
}

/** Home measures the act of checking in, independently of goal coverage. */
export function getHomeDailyAction(
  circle: CircleManagementCard,
): HomeDailyAction {
  if (circle.lifecycleStatus === 'archived') {
    return 'view';
  }
  if (circle.viewerMembershipStatus === 'pending') {
    return 'pending';
  }
  if (circle.viewerMembershipStatus !== 'active') {
    return 'view';
  }
  if (!circle.viewerHasTappedInToday && canTapInToday(circle)) {
    return 'tap_in';
  }
  if (
    circle.circleMode !== 'personal' &&
    !circle.viewerHasNudgedToday &&
    (circle.nudgeTargetCount ?? 0) > 0
  ) {
    return 'nudge';
  }
  return circle.viewerHasTappedInToday || circle.viewerHasNudgedToday
    ? 'complete'
    : 'view';
}

export function getHomeDailyProgress(circles: readonly CircleManagementCard[]) {
  let completed = 0;
  let remainingTapIns = 0;
  let remainingNudges = 0;
  for (const circle of circles) {
    if (
      circle.lifecycleStatus === 'archived' ||
      circle.viewerMembershipStatus !== 'active'
    ) {
      continue;
    }
    completed += Number(Boolean(circle.viewerHasTappedInToday));
    completed += Number(
      circle.circleMode !== 'personal' && Boolean(circle.viewerHasNudgedToday),
    );
    const action = getHomeDailyAction(circle);
    remainingTapIns += Number(action === 'tap_in');
    remainingNudges += Number(action === 'nudge');
  }
  const remaining = remainingTapIns + remainingNudges;
  return {
    completed,
    remaining,
    remainingTapIns,
    remainingNudges,
    total: completed + remaining,
  };
}

export function getHomeDailyActionProgressLabel(
  progress: ReturnType<typeof getHomeDailyProgress>,
) {
  if (!progress.total) {
    return 'No actions needed today';
  }
  if (!progress.remaining) {
    return 'All actions complete';
  }
  return `${progress.remaining} action${
    progress.remaining === 1 ? '' : 's'
  } needed today`;
}
