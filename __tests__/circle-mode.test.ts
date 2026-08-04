import {
  ensureGroupCircle,
  getCircleMode,
} from '../functions/src/shared/circle-mode';
import {
  ensureActiveCircle,
  getCircleLifecycleStatus,
  isCircleSlotAfterResumeBoundary,
} from '../functions/src/shared/circle-lifecycle';

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

describe('circle lifecycle compatibility', () => {
  it('treats missing and invalid lifecycle values as active', () => {
    expect(getCircleLifecycleStatus({})).toBe('active');
    expect(getCircleLifecycleStatus({lifecycleStatus: 'unknown'})).toBe(
      'active',
    );
    expect(getCircleLifecycleStatus({lifecycleStatus: 'archived'})).toBe(
      'archived',
    );
  });

  it('blocks active-only behavior while archived', () => {
    expect(() =>
      ensureActiveCircle({lifecycleStatus: 'archived'}, 'tapping in'),
    ).toThrow('Restore this commitment');
    expect(() => ensureActiveCircle({}, 'tapping in')).not.toThrow();
  });

  it('resumes only for openings after the restore date', () => {
    const circle = {opportunitiesResumeAfterDateKey: '2026-08-04'};

    expect(isCircleSlotAfterResumeBoundary(circle, '2026-08-04')).toBe(false);
    expect(isCircleSlotAfterResumeBoundary(circle, '2026-08-05')).toBe(true);
    expect(isCircleSlotAfterResumeBoundary({}, '2026-08-04')).toBe(true);
  });
});
