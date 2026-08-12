jest.mock('@react-native-firebase/firestore', () => jest.fn());

import {
  buildMomentumSummaryFromHomeData,
  formatOpportunityCount,
  getMomentumDisplayModel,
  getMomentumLabel,
  mapMomentumSummarySnapshot,
} from '../src/features/momentum/services/momentum-service';
import type {CircleManagementCard} from '../src/types/models';

function circle(
  overrides: Partial<CircleManagementCard>,
): CircleManagementCard {
  return {
    category: 'Fitness',
    commitment: 'Show up',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    id: 'circle-1',
    inviteUrl: 'https://hoyst.app/join/circle-1',
    joinMode: 'invite_only',
    maxSize: 8,
    memberCount: 1,
    members: [],
    privacy: 'private',
    progressPercent: 0,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 0,
    streakLabel: 'Start today',
    title: 'Circle One',
    viewerHasCheckedIn: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    ...overrides,
  };
}

describe('momentum summary fallback', () => {
  it('formats momentum labels without redundant wording', () => {
    expect(getMomentumLabel('strong_momentum')).toBe('Strong');
  });

  it('formats opportunity progress as covered copy', () => {
    expect(
      formatOpportunityCount({
        availableOpportunities: 4,
        bestStreak: 0,
        creditedOpportunities: 2,
        completedOpportunities: 2,
        currentStreak: 0,
        label: 'Strong',
        percentage: 50,
        periodKey: 'current',
        skippedOpportunities: 1,
        status: 'strong_momentum',
        tapInOpportunities: 1,
      }),
    ).toBe('2 of 4 Opportunities covered');
  });

  it('counts partial weekly Tap Ins as completed scheduled opportunities', () => {
    const summary = buildMomentumSummaryFromHomeData({
      circles: [
        circle({
          commitmentCadence: 'weekly',
          commitmentFrequency: {tapInsPerWeek: 4},
          id: 'sleep',
          remainingCheckIns: 3,
          title: 'Sleep 8 Hours',
          viewerHasCheckedIn: false,
          viewerHasTappedInToday: true,
          viewerRemainingTapIns: 3,
          viewerTodayStatus: 'done',
        }),
        circle({
          id: 'building',
          remainingCheckIns: 0,
          title: 'Building Hoyst',
          viewerHasCheckedIn: true,
          viewerRemainingTapIns: 0,
          viewerTodayStatus: 'done',
        }),
        circle({
          id: 'workout',
          title: 'Workout Circle',
        }),
      ],
      todayDateKey: '2026-05-26',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 4,
      completedOpportunities: 2,
      currentStreak: 2,
      percentage: 50,
      status: 'strong_momentum',
    });
  });

  it('keeps upcoming weekly slots out of the fallback denominator', () => {
    const summary = buildMomentumSummaryFromHomeData({
      circles: [
        circle({
          commitmentCadence: 'weekly',
          commitmentFrequency: {tapInsPerWeek: 4},
          remainingCheckIns: 4,
          viewerRemainingTapIns: 4,
        }),
      ],
      todayDateKey: '2026-05-26',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 2,
      completedOpportunities: 0,
      percentage: 0,
    });
  });

  it('counts a skipped opportunity as credited coverage', () => {
    const summary = buildMomentumSummaryFromHomeData({
      circles: [
        circle({
          remainingCheckIns: 0,
          viewerHasCheckedIn: true,
          viewerRemainingTapIns: 0,
          viewerTodayStatus: 'skip',
        }),
      ],
      todayDateKey: '2026-05-26',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 1,
      completedOpportunities: 1,
      creditedOpportunities: 1,
      skippedOpportunities: 1,
      percentage: 100,
    });
  });

  it('does not treat missing remaining Tap In data as fully complete', () => {
    const summary = buildMomentumSummaryFromHomeData({
      circles: [
        circle({
          commitmentCadence: 'weekly',
          commitmentFrequency: {tapInsPerWeek: 4},
          viewerHasCheckedIn: false,
          viewerRemainingTapIns: undefined,
        }),
      ],
      todayDateKey: '2026-05-26',
    });

    expect(summary).toMatchObject({
      availableOpportunities: 2,
      completedOpportunities: 0,
      percentage: 0,
    });
  });
});

describe('momentum summary snapshot mapping', () => {
  it('maps the optional rolling momentum fields without changing card fields', () => {
    const summary = mapMomentumSummarySnapshot({
      data: () => ({
        availableOpportunities: 1,
        bestStreak: 4,
        creditedOpportunities: 1,
        currentStreak: 4,
        label: 'Peak',
        percentage: 100,
        periodKey: 'current',
        rollingMomentum: {
          hasUnrecoveredMiss: true,
          percentage: 75,
          resolvedOpportunityCount: 8,
          status: 'peak_momentum',
          windowDays: 14,
        },
        skippedOpportunities: 0,
        status: 'peak_momentum',
        tapInOpportunities: 1,
      }),
    } as never);

    expect(summary).toMatchObject({
      percentage: 100,
      rollingMomentum: {
        hasUnrecoveredMiss: true,
        percentage: 75,
        resolvedOpportunityCount: 8,
        status: 'peak_momentum',
        windowDays: 14,
      },
    });
  });

  it('keeps legacy summaries compatible when rolling momentum is absent', () => {
    const summary = mapMomentumSummarySnapshot({
      data: () => ({
        availableOpportunities: 1,
        creditedOpportunities: 0,
        percentage: 0,
        periodKey: 'current',
        status: 'getting_started',
      }),
    } as never);

    expect(summary?.rollingMomentum).toBeUndefined();
  });
});

describe('momentum display model', () => {
  const summary = {
    availableOpportunities: 3,
    bestStreak: 0,
    creditedOpportunities: 1,
    completedOpportunities: 1,
    currentStreak: 0,
    label: 'Building',
    percentage: 33,
    periodKey: 'current',
    skippedOpportunities: 0,
    status: 'building_momentum' as const,
    tapInOpportunities: 1,
  };

  it.each([
    [0, 0],
    [1, 33],
    [2, 67],
  ])(
    'uses calibration progress for %i resolved opportunities',
    (resolvedOpportunityCount, displayProgress) => {
      expect(
        getMomentumDisplayModel({
          ...summary,
          rollingMomentum: {
            hasUnrecoveredMiss: false,
            percentage: 100,
            resolvedOpportunityCount,
            status: 'peak_momentum',
            windowDays: 14,
          },
        }),
      ).toMatchObject({
        displayProgress,
        isCalibrating: true,
        label: 'Getting Started',
        rawRollingPercentage: 100,
        resolvedOpportunityCount,
        status: 'getting_started',
      });
    },
  );

  it('reveals the weighted score at the third resolution', () => {
    expect(
      getMomentumDisplayModel({
        ...summary,
        rollingMomentum: {
          hasUnrecoveredMiss: false,
          percentage: 33,
          resolvedOpportunityCount: 3,
          status: 'strong_momentum',
          windowDays: 14,
        },
      }),
    ).toMatchObject({
      displayProgress: 33,
      isCalibrating: false,
      label: 'Strong',
      rawRollingPercentage: 33,
      status: 'strong_momentum',
    });
  });

  it('does not fall back to current-period Momentum while loading', () => {
    expect(getMomentumDisplayModel()).toMatchObject({
      displayProgress: 0,
      isCalibrating: true,
      label: 'Getting Started',
      rawRollingPercentage: 0,
    });
  });
});
