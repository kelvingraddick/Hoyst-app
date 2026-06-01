import type {ImageSourcePropType} from 'react-native';

import type {UserProfile} from '../../../types/models';
import type {ProfileSummary} from './profile-summary-service';

export const loggedOutProfileBenefits = [
  {
    detail: 'Unlock public and invite circle membership.',
    title: 'Join your circles',
  },
  {
    detail: 'Keep accountability tied to your account.',
    title: 'Tap In from anywhere',
  },
  {
    detail: 'Save your handle, avatar, settings, and circle history.',
    title: 'Build your profile',
  },
] as const;

export const loggedOutProfileStatLabels = [
  'Streaks',
  'Circles',
  'Tap Ins',
] as const;

function getSafeStatCount(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function formatProfileStatValue(value?: number) {
  return getSafeStatCount(value).toLocaleString('en-US');
}

export function getProfileInitials(profile?: Pick<UserProfile, 'name'>) {
  const initials = profile?.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'YO';
}

export function getProfileAvatarSource(
  profile?: Pick<UserProfile, 'avatarImage' | 'avatarUrl'>,
  fallbackAvatarUrl?: string,
): ImageSourcePropType | undefined {
  const avatarUrl = profile?.avatarUrl?.trim() || fallbackAvatarUrl?.trim();

  if (avatarUrl) {
    return {uri: avatarUrl};
  }

  return profile?.avatarImage;
}

export function formatActiveCircleCountLabel(activeCircleCount: number) {
  const count = getSafeStatCount(activeCircleCount);

  return `${formatProfileStatValue(count)} ${
    count === 1 ? 'Circle' : 'Circles'
  }`;
}

export function formatLongestStreakLabel(longestStreakDays?: number) {
  const count = getSafeStatCount(longestStreakDays);

  if (count <= 0) {
    return 'No Streak Yet';
  }

  return `${formatProfileStatValue(count)} ${
    count === 1 ? 'Day' : 'Days'
  } Best`;
}

export function formatTapInCountLabel(totalTapIns?: number) {
  const count = getSafeStatCount(totalTapIns);

  return `${formatProfileStatValue(count)} ${
    count === 1 ? 'Tap In' : 'Tap Ins'
  }`;
}

export function formatPersonalStreakLabel({
  hasTappedInToday,
  personalStreakDays,
}: Pick<ProfileSummary, 'hasTappedInToday' | 'personalStreakDays'>) {
  const count = getSafeStatCount(personalStreakDays);

  if (count <= 0) {
    return 'No Streak Yet';
  }

  const dayLabel = count === 1 ? 'Day' : 'Days';
  const baseLabel = `${formatProfileStatValue(count)} ${dayLabel} Streak`;

  return hasTappedInToday ? baseLabel : `${baseLabel}, Today Pending`;
}
