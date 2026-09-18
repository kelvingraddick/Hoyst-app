import {
  getCircleCycleProgressPresentation,
  getCycleProgressPresentation,
} from '../src/features/commitments/cycle-progress-presentation';
import type {CircleMemberStatus} from '../src/types/models';

function member(
  id: string,
  overrides: Partial<CircleMemberStatus> = {},
): CircleMemberStatus {
  return {
    id,
    initials: id.slice(0, 2).toUpperCase(),
    name: id,
    state: 'pending',
    ...overrides,
  };
}

describe('getCycleProgressPresentation', () => {
  it.each([
    [
      'daily group progress',
      {
        cadence: 'daily' as const,
        eligibleMemberCount: 2,
        goalMetMemberCount: 0,
        isPersonal: false,
      },
      '0/2 members met goal today',
      0,
    ],
    [
      'weekly group progress',
      {
        cadence: 'weekly' as const,
        eligibleMemberCount: 2,
        goalMetMemberCount: 1,
        isPersonal: false,
      },
      '1/2 members met goal this week',
      50,
    ],
    [
      'monthly group progress',
      {
        cadence: 'monthly' as const,
        eligibleMemberCount: 3,
        goalMetMemberCount: 2,
        isPersonal: false,
      },
      '2/3 members met goal this month',
      67,
    ],
    [
      'one-member group progress',
      {
        cadence: 'daily' as const,
        eligibleMemberCount: 1,
        goalMetMemberCount: 0,
        isPersonal: false,
      },
      '0/1 member met goal today',
      0,
    ],
    [
      'incomplete personal progress',
      {
        cadence: 'daily' as const,
        eligibleMemberCount: 1,
        goalMetMemberCount: 0,
        isPersonal: true,
      },
      'Goal not met today',
      0,
    ],
    [
      'complete personal progress',
      {
        cadence: 'weekly' as const,
        eligibleMemberCount: 1,
        goalMetMemberCount: 1,
        isPersonal: true,
      },
      'Goal met this week',
      100,
    ],
  ])('formats %s', (_name, options, expectedLabel, expectedPercent) => {
    const presentation = getCycleProgressPresentation(options);
    expect(presentation.detailLabel).toBe(expectedLabel);
    expect(presentation.listLabel).toBe(expectedLabel);
    expect(presentation.percent).toBe(expectedPercent);
  });

  it('caps completed members and handles an empty denominator', () => {
    expect(
      getCycleProgressPresentation({
        cadence: 'weekly',
        eligibleMemberCount: 2,
        goalMetMemberCount: 4,
        isPersonal: false,
      }),
    ).toEqual({
      detailLabel: '2/2 members met goal this week',
      eligibleMemberCount: 2,
      goalMetMemberCount: 2,
      listLabel: '2/2 members met goal this week',
      percent: 100,
    });
    expect(
      getCycleProgressPresentation({
        cadence: 'monthly',
        eligibleMemberCount: 0,
        goalMetMemberCount: 0,
        isPersonal: false,
      }),
    ).toEqual({
      detailLabel: '0/0 members met goal this month',
      eligibleMemberCount: 0,
      goalMetMemberCount: 0,
      listLabel: '0/0 members met goal this month',
      percent: 0,
    });
  });
});

describe('getCircleCycleProgressPresentation', () => {
  it('counts completed active members once and excludes pending members', () => {
    expect(
      getCircleCycleProgressPresentation({
        circleMode: 'group',
        commitmentCadence: 'weekly',
        members: [
          member('complete', {
            cycleCoveredCount: 5,
            cycleGoalMet: true,
            cycleRequiredCount: 3,
            state: 'done',
          }),
          member('partial', {
            cycleCoveredCount: 2,
            cycleGoalMet: false,
            cycleRequiredCount: 3,
          }),
          member('covered-by-skip', {
            cycleGoalMet: true,
            state: 'skipped',
            todayStatus: 'skip',
          }),
          member('pending', {
            cycleGoalMet: true,
            membershipStatus: 'pending',
            state: 'done',
          }),
        ],
      }),
    ).toEqual({
      detailLabel: '2/3 members met goal this week',
      eligibleMemberCount: 3,
      goalMetMemberCount: 2,
      listLabel: '2/3 members met goal this week',
      percent: 67,
    });
  });

  it('uses legacy cycle counts and daily Skip state only when goal state is absent', () => {
    const progress = getCircleCycleProgressPresentation({
      circleMode: 'group',
      commitmentCadence: 'daily',
      members: [
        member('covered', {
          cycleCoveredCount: 1,
          cycleRequiredCount: 1,
          state: 'pending',
        }),
        member('skipped', {state: 'skipped'}),
        member('partial', {state: 'pending', todayStatus: 'partial'}),
        member('failed', {state: 'pending', todayStatus: 'failed'}),
      ],
    });

    expect(progress.detailLabel).toBe('2/4 members met goal today');
    expect(progress.percent).toBe(50);
  });
});
