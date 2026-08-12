import {
  calculateRollingMomentumSummary,
  calculateMomentumSummary,
  calculateMomentumStreaks,
  getMomentumStatus,
  getOpportunitySlots,
  isExpiredExpectedOpenOpportunity,
  normalizeCommitmentSchedule,
} from '../functions/src/momentum/schedule';

describe('Momentum opportunity scheduling', () => {
  it('normalizes monthly commitments into scheduled opportunities', () => {
    const schedule = normalizeCommitmentSchedule({
      commitmentCadence: 'monthly',
      commitmentFrequency: {
        opportunitiesPerPeriod: 4,
        tapInsPerWeek: 4,
      },
      timezone: 'America/New_York',
    });

    expect(schedule).toEqual({
      pace: 'monthly',
      opportunitiesPerPeriod: 4,
      slotPolicy: 'scheduled_slots',
      timezone: 'America/New_York',
    });
  });

  it('spreads weekly opportunities instead of making the full quota available at period start', () => {
    const slots = getOpportunitySlots(
      {
        pace: 'weekly',
        opportunitiesPerPeriod: 4,
        slotPolicy: 'scheduled_slots',
        timezone: 'America/New_York',
      },
      new Date('2026-05-25T12:00:00Z'),
    );

    expect(slots.map(slot => slot.availableDateKey)).toEqual([
      '2026-05-25',
      '2026-05-26',
      '2026-05-28',
      '2026-05-30',
    ]);
  });

  it('closes expected open opportunities only after expiration', () => {
    const now = new Date('2026-07-30T04:30:00Z');

    expect(
      isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expiresDateKey: '2026-07-29',
          status: 'available',
          timezone: 'America/New_York',
        },
      }),
    ).toBe(true);
    expect(
      isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expiresDateKey: '2026-07-30',
          status: 'available',
          timezone: 'America/New_York',
        },
      }),
    ).toBe(false);
    expect(
      isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expiresDateKey: '2026-07-31',
          status: 'upcoming',
          timezone: 'America/New_York',
        },
      }),
    ).toBe(false);
  });

  it('does not close covered or explicitly non-expected opportunities', () => {
    const now = new Date('2026-07-30T12:00:00Z');

    expect(
      isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expiresDateKey: '2026-07-29',
          status: 'completed',
          timezone: 'UTC',
        },
      }),
    ).toBe(false);
    expect(
      isExpiredExpectedOpenOpportunity({
        now,
        opportunity: {
          expectedForCircle: false,
          expiresDateKey: '2026-07-29',
          status: 'available',
          timezone: 'UTC',
        },
      }),
    ).toBe(false);
  });

  it('keeps upcoming opportunities out of the Momentum denominator', () => {
    const summary = calculateMomentumSummary({
      opportunities: [
        {
          availableDateKey: '2026-05-25',
          periodKey: 'current',
          slotIndex: 0,
          status: 'completed',
        },
        {
          availableDateKey: '2026-05-26',
          periodKey: 'current',
          slotIndex: 1,
          status: 'upcoming',
        },
      ],
      periodKey: 'current',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 1,
      completedOpportunities: 1,
      label: 'Peak',
      percentage: 100,
      status: 'peak_momentum',
    });
  });

  it('credits skips for Momentum and streaks while preserving their count', () => {
    const summary = calculateMomentumSummary({
      opportunities: [
        {
          availableDateKey: '2026-05-25',
          periodKey: 'current',
          slotIndex: 0,
          status: 'completed',
        },
        {
          availableDateKey: '2026-05-26',
          periodKey: 'current',
          slotIndex: 1,
          status: 'skipped',
        },
        {
          availableDateKey: '2026-05-27',
          periodKey: 'current',
          slotIndex: 2,
          status: 'completed',
        },
      ],
      periodKey: 'current',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 3,
      completedOpportunities: 3,
      creditedOpportunities: 3,
      currentStreak: 3,
      percentage: 100,
      skippedOpportunities: 1,
      status: 'peak_momentum',
      tapInOpportunities: 2,
    });
  });

  it('resets current streak on a missed available opportunity but keeps best streak', () => {
    const summary = calculateMomentumSummary({
      opportunities: [
        {
          availableDateKey: '2026-05-25',
          periodKey: 'current',
          slotIndex: 0,
          status: 'completed',
        },
        {
          availableDateKey: '2026-05-26',
          periodKey: 'current',
          slotIndex: 1,
          status: 'missed',
        },
      ],
      periodKey: 'current',
      priorBestStreak: 4,
    });

    expect(summary).toMatchObject({
      bestStreak: 4,
      currentStreak: 0,
      percentage: 50,
    });
  });

  it('rebuilds lifetime streaks from completed Tap Ins and Skips', () => {
    expect(
      calculateMomentumStreaks({
        opportunities: [
          {
            availableDateKey: '2026-04-30',
            periodKey: 'past',
            slotIndex: 0,
            status: 'completed',
          },
          {
            availableDateKey: '2026-05-01',
            periodKey: 'past',
            slotIndex: 0,
            status: 'skipped',
          },
          {
            availableDateKey: '2026-05-02',
            periodKey: 'current',
            slotIndex: 0,
            status: 'completed',
          },
        ],
      }),
    ).toEqual({bestStreak: 3, currentStreak: 3});

    expect(
      calculateMomentumStreaks({
        opportunities: [
          {
            availableDateKey: '2026-04-30',
            periodKey: 'past',
            slotIndex: 0,
            status: 'completed',
          },
          {
            availableDateKey: '2026-05-01',
            periodKey: 'past',
            slotIndex: 0,
            status: 'missed',
          },
          {
            availableDateKey: '2026-05-02',
            periodKey: 'current',
            slotIndex: 0,
            status: 'completed',
          },
        ],
      }),
    ).toEqual({bestStreak: 1, currentStreak: 1});
  });

  it('uses the planned status thresholds', () => {
    expect(getMomentumStatus(0)).toBe('getting_started');
    expect(getMomentumStatus(14)).toBe('building_momentum');
    expect(getMomentumStatus(55)).toBe('strong_momentum');
    expect(getMomentumStatus(90)).toBe('peak_momentum');
  });

  it('weights the latest seven days more heavily in rolling momentum', () => {
    const rollingMomentum = calculateRollingMomentumSummary({
      now: new Date('2026-07-29T16:00:00Z'),
      opportunities: [
        {
          availableDateKey: '2026-07-29',
          periodKey: '2026-07-29',
          resolvedAtMs: 300,
          resolvedDateKey: '2026-07-29',
          slotIndex: 0,
          status: 'completed',
          timezone: 'UTC',
        },
        {
          availableDateKey: '2026-07-28',
          periodKey: '2026-07-28',
          resolvedAtMs: 200,
          resolvedDateKey: '2026-07-28',
          slotIndex: 0,
          status: 'missed',
          timezone: 'UTC',
        },
        {
          availableDateKey: '2026-07-20',
          periodKey: '2026-07-20',
          resolvedAtMs: 100,
          resolvedDateKey: '2026-07-20',
          slotIndex: 0,
          status: 'skipped',
          timezone: 'UTC',
        },
      ],
    });

    expect(rollingMomentum).toEqual({
      hasUnrecoveredMiss: false,
      percentage: 60,
      resolvedOpportunityCount: 3,
      status: 'strong_momentum',
      windowDays: 14,
    });
  });

  it('marks a miss as recovered only after a later covered opportunity', () => {
    const missedOpportunity = {
      availableDateKey: '2026-07-28',
      periodKey: '2026-07-28',
      resolvedAtMs: 200,
      resolvedDateKey: '2026-07-28',
      slotIndex: 0,
      status: 'missed' as const,
      timezone: 'UTC',
    };
    const earlierCompletion = {
      availableDateKey: '2026-07-27',
      periodKey: '2026-07-27',
      resolvedAtMs: 100,
      resolvedDateKey: '2026-07-27',
      slotIndex: 0,
      status: 'completed' as const,
      timezone: 'UTC',
    };

    expect(
      calculateRollingMomentumSummary({
        now: new Date('2026-07-29T12:00:00Z'),
        opportunities: [earlierCompletion, missedOpportunity],
      }).hasUnrecoveredMiss,
    ).toBe(true);
    expect(
      calculateRollingMomentumSummary({
        now: new Date('2026-07-29T12:00:00Z'),
        opportunities: [
          earlierCompletion,
          missedOpportunity,
          {
            ...earlierCompletion,
            availableDateKey: '2026-07-29',
            periodKey: '2026-07-29',
            resolvedAtMs: 300,
            resolvedDateKey: '2026-07-29',
            status: 'skipped',
          },
        ],
      }).hasUnrecoveredMiss,
    ).toBe(false);
  });

  it('uses date and slot ordering when older opportunities lack timestamps', () => {
    const rollingMomentum = calculateRollingMomentumSummary({
      now: new Date('2026-07-29T12:00:00Z'),
      opportunities: [
        {
          availableDateKey: '2026-07-28',
          periodKey: '2026-07-28',
          resolvedDateKey: '2026-07-28',
          slotIndex: 0,
          status: 'completed',
          timezone: 'UTC',
        },
        {
          availableDateKey: '2026-07-29',
          periodKey: '2026-07-29',
          resolvedDateKey: '2026-07-29',
          slotIndex: 0,
          status: 'expired',
          timezone: 'UTC',
        },
      ],
    });

    expect(rollingMomentum.hasUnrecoveredMiss).toBe(true);
  });

  it('returns Getting Started without resolved 14-day history', () => {
    expect(
      calculateRollingMomentumSummary({
        now: new Date('2026-07-29T12:00:00Z'),
        opportunities: [
          {
            availableDateKey: '2026-07-29',
            periodKey: '2026-07-29',
            slotIndex: 0,
            status: 'available',
            timezone: 'UTC',
          },
        ],
      }),
    ).toEqual({
      hasUnrecoveredMiss: false,
      percentage: 0,
      resolvedOpportunityCount: 0,
      status: 'getting_started',
      windowDays: 14,
    });
  });

  it('stores provisional scores while holding status through two resolutions', () => {
    const opportunities = [
      {
        availableDateKey: '2026-07-29',
        periodKey: '2026-07-29',
        resolvedDateKey: '2026-07-29',
        slotIndex: 0,
        status: 'completed' as const,
        timezone: 'UTC',
      },
      {
        availableDateKey: '2026-07-28',
        periodKey: '2026-07-28',
        resolvedDateKey: '2026-07-28',
        slotIndex: 0,
        status: 'missed' as const,
        timezone: 'UTC',
      },
    ];

    expect(
      calculateRollingMomentumSummary({
        now: new Date('2026-07-29T12:00:00Z'),
        opportunities,
      }),
    ).toMatchObject({
      percentage: 50,
      resolvedOpportunityCount: 2,
      status: 'getting_started',
    });
  });

  it('reveals Building at zero percent once calibration completes', () => {
    const rollingMomentum = calculateRollingMomentumSummary({
      now: new Date('2026-07-29T12:00:00Z'),
      opportunities: [0, 1, 2].map(slotIndex => ({
        availableDateKey: '2026-07-29',
        periodKey: '2026-07-29',
        resolvedDateKey: '2026-07-29',
        slotIndex,
        status: 'missed' as const,
        timezone: 'UTC',
      })),
    });

    expect(rollingMomentum).toMatchObject({
      percentage: 0,
      resolvedOpportunityCount: 3,
      status: 'building_momentum',
    });
  });

  it('excludes uncovered non-expected opportunities but preserves coverage', () => {
    const rollingMomentum = calculateRollingMomentumSummary({
      now: new Date('2026-07-29T12:00:00Z'),
      opportunities: [
        {
          availableDateKey: '2026-07-29',
          expectedForCircle: false,
          periodKey: '2026-07-29',
          resolvedDateKey: '2026-07-29',
          slotIndex: 0,
          status: 'missed',
          timezone: 'UTC',
        },
        {
          availableDateKey: '2026-07-28',
          expectedForCircle: false,
          periodKey: '2026-07-28',
          resolvedDateKey: '2026-07-28',
          slotIndex: 0,
          status: 'completed',
          timezone: 'UTC',
        },
      ],
    });

    expect(rollingMomentum).toMatchObject({
      percentage: 100,
      resolvedOpportunityCount: 1,
      status: 'getting_started',
    });
  });
});
