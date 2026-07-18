import {
  calculateMomentumSummary,
  calculateMomentumStreaks,
  getMomentumStatus,
  getOpportunitySlots,
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
      cadence: 'monthly',
      opportunitiesPerPeriod: 4,
      slotPolicy: 'scheduled_slots',
      timezone: 'America/New_York',
    });
  });

  it('spreads weekly opportunities instead of making the full quota available at period start', () => {
    const slots = getOpportunitySlots(
      {
        cadence: 'weekly',
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
});
