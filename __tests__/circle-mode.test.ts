import {
  ensureGroupCircle,
  getCircleMode,
} from '../functions/src/shared/circle-mode';

describe('circle mode compatibility', () => {
  it('treats missing and invalid modes as group', () => {
    expect(getCircleMode({})).toBe('group');
    expect(getCircleMode({circleMode: 'unknown'})).toBe('group');
    expect(getCircleMode({circleMode: 'personal'})).toBe('personal');
  });

  it('rejects group-only operations for personal commitments', () => {
    expect(() =>
      ensureGroupCircle({circleMode: 'personal'}, 'sending messages'),
    ).toThrow('Convert this personal commitment to a Circle');
    expect(() => ensureGroupCircle({}, 'sending messages')).not.toThrow();
  });
});
