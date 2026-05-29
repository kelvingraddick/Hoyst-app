import {getRemoveTapInDecision} from '../functions/src/checkins/remove';
import {
  getCircleCompleteNotificationTargets,
  getCompanionTapInNotificationTargets,
} from '../functions/src/checkins/notification-plan';

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
