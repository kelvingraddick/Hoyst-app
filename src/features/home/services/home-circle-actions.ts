import type {CircleManagementCard} from '../../../types/models';

export type HomeCircleActionVariant = 'check_in' | 'nudge' | 'share' | 'view';

type TapInTodayInput = Pick<
  CircleManagementCard,
  'viewerHasTappedInToday' | 'viewerMembershipStatus'
>;

export function canTapInToday(circle: TapInTodayInput) {
  return (
    circle.viewerMembershipStatus === 'active' && !circle.viewerHasTappedInToday
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

  if ((circle.nudgeTargetCount ?? 0) > 0) {
    return 'nudge';
  }

  if (canShareInvite) {
    return 'share';
  }

  return 'view';
}
