import {
  formatActiveCircleCountLabel,
  formatLongestStreakLabel,
  formatPersonalStreakLabel,
  formatProfileStatValue,
  formatTapInCountLabel,
  getProfileAvatarSource,
  getProfileInitials,
  loggedOutProfileBenefits,
  loggedOutProfileStatLabels,
} from '../src/features/profile/services/profile-display';
import {useUserProfileStore} from '../src/store/profile-store';
import type {UserProfile} from '../src/types/models';
import {
  calculateLongestPersonalDailyStreak,
  calculatePersonalDailyStreak,
  getDateKey,
} from '../functions/src/profile/streak';
import {summarizeProfileCheckIns} from '../functions/src/profile';
import {
  canUseSkipGrace,
  getRollingDateKeys,
} from '../functions/src/checkins/grace';

const profile: UserProfile = {
  avatarUrl: 'https://example.com/avatar.png',
  bio: 'Keeping steady.',
  handle: 'kelvin',
  id: 'user-1',
  name: 'Kelvin North',
  onboardingStatus: 'complete',
  timezone: 'America/New_York',
};

type ProfileCheckInSnapshot =
  Parameters<typeof summarizeProfileCheckIns>[0]['checkInSnapshots'][number];

function profileCheckInSnapshot({
  circleId,
  createdAt,
  dateKey,
  status,
}: {
  circleId: string;
  createdAt?: string;
  dateKey?: string;
  status: string;
}) {
  const resolvedDateKey = dateKey ?? createdAt?.slice(0, 10) ?? '2026-05-07';

  return {
    data: () => ({
      createdAt: createdAt
        ? {
            toDate: () => new Date(createdAt),
          }
        : undefined,
      status,
    }),
    ref: {
      parent: {
        parent: {
          id: resolvedDateKey,
          parent: {
            parent: {
              id: circleId,
            },
          },
        },
      },
    },
  } as unknown as ProfileCheckInSnapshot;
}

describe('profile store', () => {
  beforeEach(() => {
    useUserProfileStore.setState({profile: undefined});
  });

  it('does not provide a mock fallback profile', () => {
    expect(useUserProfileStore.getState().profile).toBeUndefined();
  });

  it('keeps undefined profile unchanged when updating without real data', () => {
    useUserProfileStore.getState().updateProfile({
      bio: 'No account yet',
      name: 'Guest Person',
    });

    expect(useUserProfileStore.getState().profile).toBeUndefined();
  });

  it('updates only a real profile', () => {
    useUserProfileStore.setState({profile});

    useUserProfileStore.getState().updateProfile({
      bio: '  Back at it.  ',
      name: '  Kelvin North  ',
    });

    expect(useUserProfileStore.getState().profile).toMatchObject({
      bio: 'Back at it.',
      name: 'Kelvin North',
    });
  });

  it('updates the saved avatar URL on a real profile', () => {
    useUserProfileStore.setState({profile});

    useUserProfileStore.getState().updateProfile({
      avatarUrl: 'https://example.com/new-avatar.png',
      name: profile.name,
    });

    expect(useUserProfileStore.getState().profile?.avatarUrl).toBe(
      'https://example.com/new-avatar.png',
    );
  });
});

describe('profile display helpers', () => {
  it('formats initials from a real profile and a generic fallback', () => {
    expect(getProfileInitials(profile)).toBe('KN');
    expect(getProfileInitials()).toBe('YO');
  });

  it('prefers remote avatar URLs over local avatar images', () => {
    expect(getProfileAvatarSource(profile)).toEqual({
      uri: 'https://example.com/avatar.png',
    });
  });

  it('uses the auth photo when the saved profile has no avatar URL', () => {
    expect(
      getProfileAvatarSource(
        {...profile, avatarUrl: undefined},
        'https://example.com/auth-photo.png',
      ),
    ).toEqual({
      uri: 'https://example.com/auth-photo.png',
    });
  });

  it('formats real profile stats labels', () => {
    expect(formatActiveCircleCountLabel(1)).toBe('1 Circle');
    expect(formatActiveCircleCountLabel(3)).toBe('3 Circles');
    expect(formatProfileStatValue(1234)).toBe('1,234');
    expect(formatTapInCountLabel(1)).toBe('1 Tap In');
    expect(formatTapInCountLabel(12)).toBe('12 Tap Ins');
    expect(formatLongestStreakLabel(0)).toBe('No Streak Yet');
    expect(formatLongestStreakLabel(1)).toBe('1 Day Best');
    expect(formatLongestStreakLabel(3)).toBe('3 Days Best');
    expect(
      formatPersonalStreakLabel({
        hasTappedInToday: true,
        personalStreakDays: 2,
      }),
    ).toBe('2 Days Streak');
    expect(
      formatPersonalStreakLabel({
        hasTappedInToday: false,
        personalStreakDays: 2,
      }),
    ).toBe('2 Days Streak, Today Pending');
  });

  it('defines logged-out profile content without fake account numbers', () => {
    expect(loggedOutProfileBenefits.map(benefit => benefit.title)).toEqual([
      'Join your circles',
      'Tap In from anywhere',
      'Build your profile',
    ]);
    expect([...loggedOutProfileStatLabels]).toEqual([
      'Streaks',
      'Circles',
      'Tap Ins',
    ]);
  });
});

describe('personal daily streak calculation', () => {
  const now = new Date('2026-05-07T12:00:00.000Z');

  it('counts today when the user has tapped in today', () => {
    expect(
      calculatePersonalDailyStreak({
        checkInDateKeys: ['2026-05-07', '2026-05-06'],
        now,
        timezone: 'UTC',
      }),
    ).toEqual({
      hasTappedInToday: true,
      personalStreakDays: 2,
    });
  });

  it('keeps yesterday streak pending when today is incomplete', () => {
    expect(
      calculatePersonalDailyStreak({
        checkInDateKeys: ['2026-05-06', '2026-05-05'],
        now,
        timezone: 'UTC',
      }),
    ).toEqual({
      hasTappedInToday: false,
      personalStreakDays: 2,
    });
  });

  it('returns zero when there are no consecutive local days', () => {
    expect(
      calculatePersonalDailyStreak({
        checkInDateKeys: ['2026-05-04'],
        now,
        timezone: 'UTC',
      }),
    ).toEqual({
      hasTappedInToday: false,
      personalStreakDays: 0,
    });
  });

  it('deduplicates multiple active circle tap ins on the same day', () => {
    expect(
      calculatePersonalDailyStreak({
        checkInDateKeys: [
          '2026-05-07',
          '2026-05-07',
          '2026-05-06',
          '2026-05-04',
        ],
        now,
        timezone: 'UTC',
      }),
    ).toEqual({
      hasTappedInToday: true,
      personalStreakDays: 2,
    });
  });

  it('preserves streaks when skipped days are included as covered dates', () => {
    expect(
      calculatePersonalDailyStreak({
        checkInDateKeys: ['2026-05-07', '2026-05-06', '2026-05-05'],
        now,
        timezone: 'UTC',
      }),
    ).toEqual({
      hasTappedInToday: true,
      personalStreakDays: 3,
    });
  });

  it('uses the requested timezone for date keys', () => {
    expect(
      getDateKey(new Date('2026-05-07T03:00:00.000Z'), 'America/New_York'),
    ).toBe('2026-05-06');
  });
});

describe('longest personal daily streak calculation', () => {
  it('returns zero when there are no covered dates', () => {
    expect(
      calculateLongestPersonalDailyStreak({
        checkInDateKeys: [],
      }),
    ).toBe(0);
  });

  it('deduplicates multiple tap ins on the same day', () => {
    expect(
      calculateLongestPersonalDailyStreak({
        checkInDateKeys: [
          '2026-05-07',
          '2026-05-07',
          '2026-05-06',
          '2026-05-04',
        ],
      }),
    ).toBe(2);
  });

  it('finds the longest run across gaps', () => {
    expect(
      calculateLongestPersonalDailyStreak({
        checkInDateKeys: [
          '2026-05-01',
          '2026-05-03',
          '2026-05-04',
          '2026-05-05',
          '2026-05-07',
        ],
      }),
    ).toBe(3);
  });

  it('counts covered skip dates as streak continuity', () => {
    expect(
      calculateLongestPersonalDailyStreak({
        checkInDateKeys: ['2026-05-05', '2026-05-06', '2026-05-07'],
      }),
    ).toBe(3);
  });
});

describe('profile check-in summary helpers', () => {
  it('keeps all-time totals while limiting current streak coverage to active circles', () => {
    const summary = summarizeProfileCheckIns({
      activeCircleIds: new Set(['active-circle']),
      checkInSnapshots: [
        profileCheckInSnapshot({
          circleId: 'active-circle',
          createdAt: '2026-05-07T12:00:00.000Z',
          status: 'done',
        }),
        profileCheckInSnapshot({
          circleId: 'old-circle',
          createdAt: '2026-05-06T12:00:00.000Z',
          status: 'done',
        }),
        profileCheckInSnapshot({
          circleId: 'old-circle',
          createdAt: '2026-05-05T12:00:00.000Z',
          status: 'skip',
        }),
      ],
      timezone: 'UTC',
    });

    expect(summary).toEqual({
      activeCoveredCheckInDateKeys: ['2026-05-07'],
      coveredCheckInDateKeys: ['2026-05-07', '2026-05-06', '2026-05-05'],
      totalTapIns: 2,
    });
  });

  it('falls back to the stored day key when createdAt is missing', () => {
    const summary = summarizeProfileCheckIns({
      activeCircleIds: new Set(['active-circle']),
      checkInSnapshots: [
        profileCheckInSnapshot({
          circleId: 'active-circle',
          dateKey: '2026-05-03',
          status: 'done',
        }),
      ],
      timezone: 'UTC',
    });

    expect(summary.coveredCheckInDateKeys).toEqual(['2026-05-03']);
    expect(summary.activeCoveredCheckInDateKeys).toEqual(['2026-05-03']);
    expect(summary.totalTapIns).toBe(1);
  });
});

describe('skip grace helpers', () => {
  it('allows the first skip inside a grace window', () => {
    expect(
      canUseSkipGrace({
        graceRule: {
          allowance: 1,
          windowDays: 7,
        },
        priorSkipCount: 0,
      }),
    ).toBe(true);
  });

  it('blocks skips when allowance is exhausted or off', () => {
    expect(
      canUseSkipGrace({
        graceRule: {
          allowance: 1,
          windowDays: 7,
        },
        priorSkipCount: 1,
      }),
    ).toBe(false);
    expect(
      canUseSkipGrace({
        graceRule: {
          allowance: 0,
          windowDays: 7,
        },
        priorSkipCount: 0,
      }),
    ).toBe(false);
  });

  it('builds rolling date windows from today backward', () => {
    expect(getRollingDateKeys('2026-05-07', 4)).toEqual([
      '2026-05-07',
      '2026-05-06',
      '2026-05-05',
      '2026-05-04',
    ]);
  });
});
