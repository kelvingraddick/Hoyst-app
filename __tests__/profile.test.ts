import {
  formatActiveCircleCountLabel,
  formatPersonalStreakLabel,
  getProfileAvatarSource,
  getProfileInitials,
  loggedOutProfileBenefits,
  loggedOutProfileStatLabels,
} from '../src/features/profile/services/profile-display';
import {useUserProfileStore} from '../src/store/profile-store';
import type {UserProfile} from '../src/types/models';
import {
  calculatePersonalDailyStreak,
  getDateKey,
} from '../functions/src/profile/streak';

const profile: UserProfile = {
  avatarUrl: 'https://example.com/avatar.png',
  bio: 'Keeping steady.',
  handle: 'kelvin',
  id: 'user-1',
  name: 'Kelvin North',
  onboardingStatus: 'complete',
  timezone: 'America/New_York',
};

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

  it('formats real profile stats labels', () => {
    expect(formatActiveCircleCountLabel(1)).toBe('1 Circle');
    expect(formatActiveCircleCountLabel(3)).toBe('3 Circles');
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

  it('uses the requested timezone for date keys', () => {
    expect(
      getDateKey(
        new Date('2026-05-07T03:00:00.000Z'),
        'America/New_York',
      ),
    ).toBe('2026-05-06');
  });
});
