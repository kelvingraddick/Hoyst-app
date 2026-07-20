import {getRemoveTapInDecision} from '../functions/src/checkins/remove';
import {getTapInDetailsPatch} from '../functions/src/checkins/details';
import {
  getCreditedOutcomeStatus,
  getNextCoverageRevision,
  isCoveredOutcomeChange,
  shouldRetainCorrectedMetricEffect,
} from '../functions/src/checkins/reconciliation';
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

describe('Tap In details update decision', () => {
  it('returns metadata only for an existing non-skip Tap In', () => {
    expect(
      getTapInDetailsPatch({
        checkInExists: true,
        checkInStatus: 'done',
        memberStatus: 'active',
        note: '  Proof saved.  ',
        photoUrl: 'https://example.com/proof.jpg',
      }),
    ).toEqual({
      note: '  Proof saved.  ',
      photoUrl: 'https://example.com/proof.jpg',
    });
  });

  it('supports clearing details without changing the Tap In outcome', () => {
    expect(
      getTapInDetailsPatch({
        checkInExists: true,
        checkInStatus: 'partial',
        memberStatus: 'active',
        note: '',
        photoUrl: null,
      }),
    ).toEqual({note: null, photoUrl: null});
  });

  it('rejects inactive members, missing Tap Ins, and skips', () => {
    expect(() =>
      getTapInDetailsPatch({
        checkInExists: true,
        checkInStatus: 'done',
        memberStatus: 'pending',
        note: null,
        photoUrl: null,
      }),
    ).toThrow('Join this circle first.');
    expect(() =>
      getTapInDetailsPatch({
        checkInExists: false,
        memberStatus: 'active',
        note: null,
        photoUrl: null,
      }),
    ).toThrow("Today's Tap In was not found.");
    expect(() =>
      getTapInDetailsPatch({
        checkInExists: true,
        checkInStatus: 'skip',
        memberStatus: 'active',
        note: null,
        photoUrl: null,
      }),
    ).toThrow('Details can only be added to a Tap In.');
  });
});

describe('Tap In reconciliation revisions', () => {
  it('detects covered Tap In and Skip outcome replacements', () => {
    expect(getCreditedOutcomeStatus({status: 'done'})).toBe('done');
    expect(getCreditedOutcomeStatus({coverageStatus: 'skipped'})).toBe('skip');
    expect(
      isCoveredOutcomeChange({
        existingCheckIn: {coverageStatus: 'covered', status: 'done'},
        nextStatus: 'skip',
      }),
    ).toBe(true);
    expect(
      isCoveredOutcomeChange({
        existingCheckIn: {coverageStatus: 'skipped', status: 'skip'},
        nextStatus: 'done',
      }),
    ).toBe(true);
    expect(
      isCoveredOutcomeChange({
        existingCheckIn: {coverageStatus: 'covered', status: 'done'},
        nextStatus: 'done',
      }),
    ).toBe(false);
  });

  it('increments only when coverage is newly earned', () => {
    expect(
      getNextCoverageRevision({
        existingCovered: false,
        existingRevision: 0,
        nextCovered: true,
      }),
    ).toBe(1);
    expect(
      getNextCoverageRevision({
        existingCovered: true,
        existingRevision: 1,
        nextCovered: true,
      }),
    ).toBe(1);
  });

  it('continues from the private ledger after a covered Tap In is deleted', () => {
    expect(
      getNextCoverageRevision({
        existingCovered: false,
        ledgerRevision: 2,
        nextCovered: true,
      }),
    ).toBe(3);
    expect(
      getNextCoverageRevision({
        existingCovered: false,
        ledgerRevision: 2,
        nextCovered: false,
      }),
    ).toBe(2);
  });

  it('retains only milestone effects that still qualify after correction', () => {
    expect(
      shouldRetainCorrectedMetricEffect({
        bestStreak: 8,
        currentStreak: 7,
        effectId: 'companion_streak_milestone_7-day-streak_user-1',
        type: 'companion_streak_milestone',
      }),
    ).toBe(true);
    expect(
      shouldRetainCorrectedMetricEffect({
        bestStreak: 8,
        currentStreak: 6,
        effectId: 'companion_streak_milestone_7-day-streak_user-1',
        type: 'companion_streak_milestone',
      }),
    ).toBe(false);
    expect(
      shouldRetainCorrectedMetricEffect({
        bestStreak: 10,
        currentStreak: 2,
        effectId: 'companion_achievement_unlocked_10-day-streak_user-1',
        type: 'companion_achievement_unlocked',
      }),
    ).toBe(true);
    expect(
      shouldRetainCorrectedMetricEffect({
        bestStreak: 4,
        currentStreak: 1,
        effectId: 'companion_momentum_level_up_strong_momentum_user-1',
        momentumStatus: 'building_momentum',
        type: 'companion_momentum_level_up',
      }),
    ).toBe(false);
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
