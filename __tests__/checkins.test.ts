import {getRemoveTapInDecision} from '../functions/src/checkins/remove';
import {
  getCircleCompleteNotificationTargets,
  getCompanionTapInNotificationTargets,
} from '../functions/src/checkins/notification-plan';
import {
  getCheckInStatusForCoverage,
  getCoverageStatusForTapIn,
  isCoveredCheckInData,
} from '../functions/src/shared/commitments';

describe('Tap In notification targeting', () => {
  it('notifies every other active member for companion Tap Ins', () => {
    expect(
      getCompanionTapInNotificationTargets({
        activeMemberUids: ['user-1', 'user-2', 'user-3'],
        actorUid: 'user-1',
      }),
    ).toEqual(['user-2', 'user-3']);
  });

  it('notifies all active members only when the circle is complete', () => {
    expect(
      getCircleCompleteNotificationTargets({
        activeMemberUids: ['user-1', 'user-2'],
        remainingTapIns: 1,
      }),
    ).toEqual([]);

    expect(
      getCircleCompleteNotificationTargets({
        activeMemberUids: ['user-1', 'user-2'],
        remainingTapIns: 0,
      }),
    ).toEqual(['user-1', 'user-2']);
  });
});

describe('remove Tap In decision', () => {
  it('removes a done check-in for an active member', () => {
    expect(
      getRemoveTapInDecision({
        checkInStatus: 'done',
        memberStatus: 'active',
      }),
    ).toEqual({
      checkInCountDelta: -1,
      removed: true,
    });
  });

  it('removes a skip for an active member', () => {
    expect(
      getRemoveTapInDecision({
        checkInStatus: 'skip',
        memberStatus: 'active',
      }),
    ).toEqual({
      checkInCountDelta: -1,
      removed: true,
    });
  });

  it('removes partial and failed quantity check-ins without decrementing coverage', () => {
    expect(
      getRemoveTapInDecision({
        checkInStatus: 'partial',
        memberStatus: 'active',
      }),
    ).toEqual({
      checkInCountDelta: 0,
      removed: true,
    });

    expect(
      getRemoveTapInDecision({
        checkInStatus: 'failed',
        memberStatus: 'active',
      }),
    ).toEqual({
      checkInCountDelta: 0,
      removed: true,
    });
  });

  it('leaves a missing check-in alone without decrementing', () => {
    expect(
      getRemoveTapInDecision({
        memberStatus: 'active',
      }),
    ).toEqual({
      checkInCountDelta: 0,
      removed: false,
    });
  });

  it('rejects inactive and missing memberships', () => {
    expect(() =>
      getRemoveTapInDecision({
        checkInStatus: 'done',
        memberStatus: 'pending',
      }),
    ).toThrow('Join this circle first.');

    expect(() =>
      getRemoveTapInDecision({
        checkInStatus: 'done',
      }),
    ).toThrow('Join this circle first.');
  });
});

describe('commitment quantity scoring', () => {
  it('defaults legacy circles to covered Build target 1', () => {
    const coverageStatus = getCoverageStatusForTapIn({
      circle: {},
      status: 'done',
    });

    expect(coverageStatus).toBe('covered');
    expect(getCheckInStatusForCoverage(coverageStatus)).toBe('done');
    expect(isCoveredCheckInData({status: 'done'})).toBe(true);
  });

  it('scores Build partial, covered, and above goal', () => {
    const circle = {commitmentType: 'build', targetValue: 5};

    expect(
      getCoverageStatusForTapIn({circle, currentValue: 3, status: 'done'}),
    ).toBe('partial');
    expect(
      getCoverageStatusForTapIn({circle, currentValue: 5, status: 'done'}),
    ).toBe('covered');
    expect(
      getCoverageStatusForTapIn({circle, currentValue: 8, status: 'done'}),
    ).toBe('covered');
    expect(
      isCoveredCheckInData({coverageStatus: 'partial', status: 'partial'}),
    ).toBe(false);
  });

  it('scores Limit under minimum, in range, and over maximum', () => {
    const circle = {
      commitmentType: 'limit',
      maximumValue: 6,
      minimumValue: 2,
    };

    expect(
      getCoverageStatusForTapIn({circle, currentValue: 1, status: 'done'}),
    ).toBe('failed');
    expect(
      getCoverageStatusForTapIn({circle, currentValue: 4, status: 'done'}),
    ).toBe('covered');
    expect(
      getCoverageStatusForTapIn({circle, currentValue: 7, status: 'done'}),
    ).toBe('failed');
    expect(
      isCoveredCheckInData({coverageStatus: 'failed', status: 'failed'}),
    ).toBe(false);
  });

  it('scores Avoid and Skip as covered binary outcomes', () => {
    expect(
      getCoverageStatusForTapIn({
        circle: {commitmentType: 'avoid'},
        currentValue: 0,
        status: 'done',
      }),
    ).toBe('covered');
    expect(
      getCoverageStatusForTapIn({
        circle: {commitmentType: 'build', targetValue: 10},
        currentValue: 0,
        status: 'skip',
      }),
    ).toBe('skipped');
    expect(
      isCoveredCheckInData({coverageStatus: 'skipped', status: 'skip'}),
    ).toBe(true);
  });
});
