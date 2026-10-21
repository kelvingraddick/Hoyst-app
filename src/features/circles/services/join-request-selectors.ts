import type {CircleSummary} from '../../../types/models';

export function canReviewCircleJoinRequests(circle?: CircleSummary) {
  return Boolean(
    circle &&
      circle.circleMode !== 'personal' &&
      circle.lifecycleStatus !== 'archived' &&
      circle.viewerMembershipStatus === 'active' &&
      circle.viewerRole === 'owner',
  );
}

export function getPendingCircleJoinRequests(circle?: CircleSummary) {
  if (!canReviewCircleJoinRequests(circle)) {
    return [];
  }
  return (circle?.members ?? [])
    .filter(member => member.membershipStatus === 'pending')
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );
}

export function joinRequestCountLabel(count: number) {
  return `${count} join request${count === 1 ? '' : 's'}`;
}
