import {
  calculateGroupDailyStreak,
  isMemberExpectedForGroupDate,
} from '../functions/src/circles/group-streak';

const timestamp = (value: string) => ({toDate: () => new Date(value)});

describe('group daily streaks', () => {
  it('counts only consecutive fully completed group days', () => {
    expect(
      calculateGroupDailyStreak({
        completedDateKeys: ['2026-09-09', '2026-09-08', '2026-09-06'],
        now: new Date('2026-09-09T17:00:00.000Z'),
        timezone: 'America/New_York',
      }),
    ).toBe(2);
  });

  it('keeps a completed yesterday run while today remains open', () => {
    expect(
      calculateGroupDailyStreak({
        completedDateKeys: ['2026-09-08', '2026-09-07'],
        now: new Date('2026-09-09T17:00:00.000Z'),
        timezone: 'UTC',
      }),
    ).toBe(2);
  });

  it('does not restore a personal run from before a Circle conversion', () => {
    expect(
      calculateGroupDailyStreak({
        completedDateKeys: ['2026-09-09', '2026-09-08', '2026-09-07'],
        now: new Date('2026-09-09T17:00:00.000Z'),
        startDateKey: '2026-09-09',
        timezone: 'UTC',
      }),
    ).toBe(1);
  });

  it('uses date-level membership eligibility for cohorts', () => {
    expect(
      isMemberExpectedForGroupDate({
        dateKey: '2026-09-09',
        period: {
          joinedAt: timestamp('2026-09-09T10:00:00.000Z'),
          opportunityEligibility: 'next_opening',
          uid: 'new-member',
        },
        timezone: 'UTC',
      }),
    ).toBe(false);
    expect(
      isMemberExpectedForGroupDate({
        dateKey: '2026-09-09',
        period: {
          joinedAt: timestamp('2026-09-09T10:00:00.000Z'),
          opportunityEligibility: 'include_current',
          uid: 'owner',
        },
        timezone: 'UTC',
      }),
    ).toBe(true);
    expect(
      isMemberExpectedForGroupDate({
        dateKey: '2026-09-09',
        period: {
          joinedAt: timestamp('2026-09-01T10:00:00.000Z'),
          leftAt: timestamp('2026-09-09T10:00:00.000Z'),
          uid: 'departed-member',
        },
        timezone: 'UTC',
      }),
    ).toBe(false);
  });
});
