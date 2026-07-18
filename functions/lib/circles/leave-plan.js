"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaveCirclePlan = getLeaveCirclePlan;
function getLeaveCirclePlan({ activityBackfillStatus, historyStatus, joinRequestStatus, memberStatus, }) {
    const isActiveMember = memberStatus === 'active';
    const isPendingMember = memberStatus === 'pending' || joinRequestStatus === 'pending';
    const hasPastMembership = historyStatus === 'past';
    const isDepartureRetry = !isActiveMember && !isPendingMember && hasPastMembership;
    const shouldBackfillActivity = (isActiveMember || isDepartureRetry) &&
        activityBackfillStatus !== 'complete';
    return {
        isActiveMember,
        isDepartureRetry,
        isPendingMember,
        shouldBackfillActivity,
        shouldRemoveOpenOpportunities: isActiveMember || isDepartureRetry,
        status: isActiveMember || isDepartureRetry
            ? 'left'
            : 'cancelled',
    };
}
