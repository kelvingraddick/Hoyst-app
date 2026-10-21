import type {CircleSummary} from '../../../types/models';

type InviteEligibilityInput = Pick<
  CircleSummary,
  'circleMode' | 'lifecycleStatus' | 'viewerMembershipStatus' | 'inviteUrl'
>;

export function canShareCircleInvite(circle: InviteEligibilityInput) {
  return Boolean(
    circle.circleMode !== 'personal' &&
      circle.lifecycleStatus !== 'archived' &&
      circle.viewerMembershipStatus === 'active' &&
      circle.inviteUrl,
  );
}
