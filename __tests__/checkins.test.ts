import {getRemoveTapInDecision} from '../functions/src/checkins/remove';

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
