export function getLeaveCirclePlan({
  activityBackfillStatus,
  historyStatus,
  joinRequestStatus,
  memberStatus,
}: {
  activityBackfillStatus?: unknown;
  historyStatus?: unknown;
  joinRequestStatus?: unknown;
  memberStatus?: unknown;
}) {
  const isActiveMember = memberStatus === 'active';
  const isPendingMember =
    memberStatus === 'pending' || joinRequestStatus === 'pending';
  const hasPastMembership = historyStatus === 'past';
  const isDepartureRetry =
    !isActiveMember && !isPendingMember && hasPastMembership;
  const shouldBackfillActivity =
    (isActiveMember || isDepartureRetry) &&
    activityBackfillStatus !== 'complete';

  return {
    isActiveMember,
    isDepartureRetry,
    isPendingMember,
    shouldBackfillActivity,
    shouldRemoveOpenOpportunities: isActiveMember || isDepartureRetry,
    status:
      isActiveMember || isDepartureRetry
        ? ('left' as const)
        : ('cancelled' as const),
  };
}
