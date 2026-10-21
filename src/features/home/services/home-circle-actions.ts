import type {CircleManagementCard} from '../../../types/models';
import {canShareCircleInvite} from '../../circle-invites/services/invite-eligibility';

export type HomeCircleActionVariant = 'check_in' | 'nudge' | 'share' | 'view';

type TapInTodayInput = Pick<
  CircleManagementCard,
  | 'lifecycleStatus'
  | 'viewerCanUpdateTapIn'
  | 'viewerHasTappedInToday'
  | 'viewerMembershipStatus'
  | 'viewerTodayStatus'
>;

export function canTapInToday(circle: TapInTodayInput) {
  if (
    circle.lifecycleStatus === 'archived' ||
    circle.viewerMembershipStatus !== 'active'
  ) {
    return false;
  }

  if (!circle.viewerHasTappedInToday) {
    return true;
  }

  return Boolean(
    circle.viewerCanUpdateTapIn &&
      (circle.viewerTodayStatus === 'partial' ||
        circle.viewerTodayStatus === 'failed'),
  );
}

export function getHomeCircleActionVariant(
  circle: CircleManagementCard,
): HomeCircleActionVariant {
  if (circle.viewerMembershipStatus === 'pending') {
    return 'view';
  }

  if (canTapInToday(circle)) {
    return 'check_in';
  }

  if (circle.circleMode === 'personal') {
    return 'view';
  }

  if ((circle.nudgeTargetCount ?? 0) > 0) {
    return 'nudge';
  }

  if (canShareCircleInvite(circle)) {
    return 'share';
  }

  return 'view';
}
