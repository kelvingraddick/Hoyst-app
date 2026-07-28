import type {CircleManagementCard} from '../../../types/models';

export type HomeCircleActionVariant = 'check_in' | 'nudge' | 'share' | 'view';

type TapInTodayInput = Pick<
  CircleManagementCard,
  | 'viewerCanUpdateTapIn'
  | 'viewerHasTappedInToday'
  | 'viewerMembershipStatus'
  | 'viewerTodayStatus'
>;

export function canTapInToday(circle: TapInTodayInput) {
  if (circle.viewerMembershipStatus !== 'active') {
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
  const canShareInvite = Boolean(
    circle.inviteUrl &&
      (circle.viewerRole === 'owner' || circle.viewerRole === 'admin'),
  );

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

  if (canShareInvite) {
    return 'share';
  }

  return 'view';
}
