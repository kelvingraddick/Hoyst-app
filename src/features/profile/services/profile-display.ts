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
): ImageSourcePropType | undefined {
  if (profile?.avatarUrl) {
    return {uri: profile.avatarUrl};
  }

  return profile?.avatarImage;
}

export function formatActiveCircleCountLabel(activeCircleCount: number) {
  return `${activeCircleCount} ${
    activeCircleCount === 1 ? 'Circle' : 'Circles'
  }`;
}

export function formatPersonalStreakLabel({
  hasTappedInToday,
  personalStreakDays,
}: Pick<ProfileSummary, 'hasTappedInToday' | 'personalStreakDays'>) {
  if (personalStreakDays <= 0) {
    return 'No Streak Yet';
  }

  const dayLabel = personalStreakDays === 1 ? 'Day' : 'Days';
  const baseLabel = `${personalStreakDays} ${dayLabel} Streak`;

  return hasTappedInToday ? baseLabel : `${baseLabel}, Today Pending`;
}
