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
      {
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'build',
        targetValue: 20,
        unitLabel: 'minutes',
      },
      'Goal: 4 Tap Ins per week · 20 minutes per Tap In',
    ],
    [
      {
        commitmentCadence: 'monthly',
        commitmentFrequency: {
          opportunitiesPerPeriod: 1,
          tapInsPerWeek: 1,
        },
        commitmentType: 'build',
        targetValue: 1,
      },
      'Goal: 1 Tap In per month',
    ],
    [
      {
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'avoid',
      },
      'Goal: 4 Tap Ins per week',
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
        commitmentCadence: 'monthly',
        commitmentFrequency: {
          opportunitiesPerPeriod: 6,
          tapInsPerWeek: 6,
        },
        commitmentType: 'limit',
        maximumValue: 2,
        unitLabel: 'hours',
      },
      'Goal: 6 Tap Ins per month · Maximum 2 hours per Tap In',
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
    [
      {
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 4},
        commitmentType: 'limit',
        minimumValue: 2,
        maximumValue: 6,
        unitLabel: 'cups',
      },
      'Goal: 4 Tap Ins per week · Allowed range 2 to 6 cups per Tap In',
    ],
    [
      {
        commitmentCadence: 'weekly',
        commitmentFrequency: {tapInsPerWeek: 0},
        commitmentType: 'build',
        targetValue: 7,
        unitLabel: 'Hours of sleep',
      },
      'Goal: 7 Hours of sleep',
    ],
    [
      {
        commitmentCadence: 'monthly',
        commitmentType: 'avoid',
      },
      undefined,
    ],
  ] as const)('formats %p as %p', (circle, expected) => {
    expect(getCommitmentGoalLabel(circle)).toBe(expected);
  });
});
