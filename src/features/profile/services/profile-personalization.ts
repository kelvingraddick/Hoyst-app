import type {ProfileTint} from '../../../types/models';
import type {ProgressSummary} from '../../progress/services/progress-service';

export const profileTints: ReadonlyArray<{
  value: ProfileTint;
  label: string;
  color: string;
}> = [
  {value: 'green', label: 'Green', color: '#10B967'},
  {value: 'blue', label: 'Blue', color: '#18B9FF'},
  {value: 'purple', label: 'Purple', color: '#5A1CFF'},
  {value: 'orange', label: 'Orange', color: '#FF6D00'},
  {value: 'gold', label: 'Gold', color: '#FFC400'},
];
export function normalizeProfileTint(value: unknown): ProfileTint {
  return profileTints.some(tint => tint.value === value)
    ? (value as ProfileTint)
    : 'green';
}
export function getProfileTintColor(value?: ProfileTint) {
  return profileTints.find(tint => tint.value === normalizeProfileTint(value))!
    .color;
}
export const profileMilestones = [
  {
    id: 'streak_3',
    label: '3-day streak',
    detail: 'Reached a 3-day personal streak.',
  },
  {
    id: 'streak_7',
    label: '7-day streak',
    detail: 'Reached a 7-day personal streak.',
  },
  {
    id: 'streak_14',
    label: '14-day streak',
    detail: 'Reached a 14-day personal streak.',
  },
  {
    id: 'streak_30',
    label: '30-day streak',
    detail: 'Reached a 30-day personal streak.',
  },
  {
    id: 'momentum_strong',
    label: 'Strong momentum',
    detail: 'Reached Strong momentum.',
  },
  {
    id: 'momentum_peak',
    label: 'Peak momentum',
    detail: 'Reached Peak momentum.',
  },
  {
    id: 'tap_ins_50',
    label: '50 Tap Ins',
    detail: 'Completed 50 successful Tap Ins.',
  },
] as const;
export function getEarnedProfileMilestones(
  summary?: Pick<ProgressSummary, 'milestones'>,
) {
  return profileMilestones.filter(
    milestone => summary?.milestones[milestone.id] === true,
  );
}
export const profileInviteUrl = 'https://hoyst.app/';
export const profileShareMessage = `Join me on Hoyst\n${profileInviteUrl}`;
