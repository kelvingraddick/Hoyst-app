import type {CircleManagementCard} from '../../../types/models';

export type HomeCircleActionVariant = 'check_in' | 'nudge' | 'share' | 'view';

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

  if (!circle.viewerHasCheckedIn && !circle.viewerHasTappedInToday) {
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
