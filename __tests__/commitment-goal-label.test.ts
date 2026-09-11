import {getCommitmentGoalLabel} from '../src/features/commitments/commitment-goal-label';

describe('commitment description goal line', () => {
  it.each([
    [{}, undefined],
    [{commitmentType: 'avoid', targetValue: 5}, undefined],
    [{commitmentType: 'build', targetValue: 1}, undefined],
    [
      {commitmentType: 'build', targetValue: 20, unitLabel: 'minutes'},
      'Goal: 20 minutes',
    ],
    [
      {commitmentType: 'build', targetValue: 7, unitLabel: 'Hours of sleep'},
      'Goal: 7 Hours of sleep',
    ],
    [
      {commitmentType: 'build', targetValue: 123456789, unitLabel: 'steps'},
      'Goal: 123456789 steps',
    ],
    [
      {commitmentType: 'limit', maximumValue: 0, unitLabel: 'servings'},
      'Maximum: 0 servings',
    ],
    [
      {commitmentType: 'limit', maximumValue: 2, unitLabel: 'hours'},
      'Maximum: 2 hours',
    ],
    [
      {
        commitmentType: 'limit',
        minimumValue: 0,
        maximumValue: 6,
        unitLabel: 'cups',
      },
      'Allowed range: 0 to 6 cups',
    ],
    [
      {
        commitmentType: 'limit',
        minimumValue: 2,
        maximumValue: 6,
        unitLabel: 'servings',
      },
      'Allowed range: 2 to 6 servings',
    ],
  ] as const)('formats %p as %p', (circle, expected) => {
    expect(getCommitmentGoalLabel(circle)).toBe(expected);
  });
});
