import {getLeaveCirclePlan} from '../functions/src/circles/leave-plan';

describe('Circle leave retry planning', () => {
  it('marks a new active departure for cleanup and backfill', () => {
    expect(
      getLeaveCirclePlan({
        activityBackfillStatus: undefined,
        historyStatus: 'active',
        memberStatus: 'active',
      }),
    ).toEqual({
      isActiveMember: true,
      isDepartureRetry: false,
      isPendingMember: false,
      shouldBackfillActivity: true,
      shouldRemoveOpenOpportunities: true,
      status: 'left',
    });
  });

  it('retries an incomplete backfill after membership removal committed', () => {
    expect(
      getLeaveCirclePlan({
        activityBackfillStatus: 'pending',
        historyStatus: 'past',
      }),
    ).toEqual({
      isActiveMember: false,
      isDepartureRetry: true,
      isPendingMember: false,
      shouldBackfillActivity: true,
      shouldRemoveOpenOpportunities: true,
      status: 'left',
    });
  });

  it('does not repeat a completed departure backfill', () => {
    expect(
      getLeaveCirclePlan({
        activityBackfillStatus: 'complete',
        historyStatus: 'past',
      }),
    ).toEqual({
      isActiveMember: false,
      isDepartureRetry: true,
      isPendingMember: false,
      shouldBackfillActivity: false,
      shouldRemoveOpenOpportunities: true,
      status: 'left',
    });
  });

  it('keeps pending-request cancellation destructive and separate', () => {
    expect(
      getLeaveCirclePlan({
        historyStatus: 'past',
        joinRequestStatus: 'pending',
        memberStatus: 'pending',
      }),
    ).toEqual({
      isActiveMember: false,
      isDepartureRetry: false,
      isPendingMember: true,
      shouldBackfillActivity: false,
      shouldRemoveOpenOpportunities: false,
      status: 'cancelled',
    });
  });
});
