export type OnboardingStep =
  | 'welcome'
  | 'coach'
  | 'goal'
  | 'categories'
  | 'reminders'
  | 'comfort'
  | 'pace'
  | 'profile'
  | 'preview'
  | 'auth';

export type OnboardingGoal =
  | 'fitness'
  | 'focus'
  | 'wellness'
  | 'sobriety'
  | 'learning'
  | 'creative';

export type OnboardingCategory =
  | 'fitness'
  | 'wellness'
  | 'deep_work'
  | 'sobriety'
  | 'learning'
  | 'creativity';

export type ReminderPreference =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'flexible';

export type SocialComfort =
  | 'trusted_circle'
  | 'public_circle'
  | 'invite_later';

export type OnboardingPace = 'daily' | 'weekdays' | 'three_weekly';

export type OnboardingOption<T extends string> = {
  accent: 'green' | 'orange' | 'purple' | 'blue';
  description: string;
  id: T;
  label: string;
};

export type OnboardingPreferences = {
  categories: OnboardingCategory[];
  goal?: OnboardingGoal;
  pace?: OnboardingPace;
  reminderPreference?: ReminderPreference;
  socialComfort?: SocialComfort;
};

export const onboardingSteps: OnboardingStep[] = [
  'welcome',
  'coach',
  'goal',
  'categories',
  'reminders',
  'comfort',
  'pace',
  'profile',
  'preview',
  'auth',
];

export const onboardingProgressSteps = onboardingSteps.filter(
  step => step !== 'welcome',
);

export const goalOptions: OnboardingOption<OnboardingGoal>[] = [
  {
    accent: 'green',
    description: 'Movement, training, recovery, and everyday strength.',
    id: 'fitness',
    label: 'Fitness and movement',
  },
  {
    accent: 'blue',
    description: 'Deep work, studying, building, or shipping consistently.',
    id: 'focus',
    label: 'Focus and work',
  },
  {
    accent: 'purple',
    description: 'Sleep, mindfulness, food, therapy, or self-care routines.',
    id: 'wellness',
    label: 'Wellness rhythm',
  },
  {
    accent: 'orange',
    description: 'Stay steady with support from people who get it.',
    id: 'sobriety',
    label: 'Sobriety or reset',
  },
  {
    accent: 'blue',
    description: 'Practice a language, skill, certification, or course.',
    id: 'learning',
    label: 'Learning something',
  },
  {
    accent: 'purple',
    description: 'Writing, music, content, art, or any creative practice.',
    id: 'creative',
    label: 'Creative streak',
  },
];

export const categoryOptions: OnboardingOption<OnboardingCategory>[] = [
  {
    accent: 'green',
    description: 'Training plans, walks, lifts, runs, and recovery.',
    id: 'fitness',
    label: 'Fitness',
  },
  {
    accent: 'purple',
    description: 'Sleep, mindfulness, nutrition, and care routines.',
    id: 'wellness',
    label: 'Wellness',
  },
  {
    accent: 'blue',
    description: 'Focused sessions, study blocks, and maker momentum.',
    id: 'deep_work',
    label: 'Deep work',
  },
  {
    accent: 'orange',
    description: 'Private, steady check-ins for staying grounded.',
    id: 'sobriety',
    label: 'Sobriety',
  },
  {
    accent: 'blue',
    description: 'Courses, skills, certifications, and practice loops.',
    id: 'learning',
    label: 'Learning',
  },
  {
    accent: 'purple',
    description: 'Writing, music, art, posting, or making something.',
    id: 'creativity',
    label: 'Creativity',
  },
];

export const reminderOptions: OnboardingOption<ReminderPreference>[] = [
  {
    accent: 'green',
    description: 'A small nudge before the day gets noisy.',
    id: 'morning',
    label: 'Morning reset',
  },
  {
    accent: 'blue',
    description: 'A midday prompt to keep the streak alive.',
    id: 'midday',
    label: 'Midday check',
  },
  {
    accent: 'orange',
    description: 'A quiet evening note before the day closes.',
    id: 'evening',
    label: 'Evening wrap',
  },
  {
    accent: 'purple',
    description: 'Let circles and streaks guide the timing.',
    id: 'flexible',
    label: 'Keep it flexible',
  },
];

export const comfortOptions: OnboardingOption<SocialComfort>[] = [
  {
    accent: 'green',
    description: 'A small group where everyone knows why they are there.',
    id: 'trusted_circle',
    label: 'A trusted small circle',
  },
  {
    accent: 'blue',
    description: 'Public circles that match your goal and pace.',
    id: 'public_circle',
    label: 'A public accountability group',
  },
  {
    accent: 'purple',
    description: 'Start solo, then bring people in when it feels right.',
    id: 'invite_later',
    label: 'Invite friends later',
  },
];

export const paceOptions: OnboardingOption<OnboardingPace>[] = [
  {
    accent: 'green',
    description: 'A short Tap In every day, even if it is imperfect.',
    id: 'daily',
    label: 'Daily',
  },
  {
    accent: 'blue',
    description: 'Consistency around workdays, rest on weekends.',
    id: 'weekdays',
    label: 'Weekdays',
  },
  {
    accent: 'orange',
    description: 'A steadier rhythm for busy seasons.',
    id: 'three_weekly',
    label: 'Three times a week',
  },
];

export function getOptionLabel<T extends string>(
  options: OnboardingOption<T>[],
  id?: T,
  fallback = 'Not set yet',
) {
  return options.find(option => option.id === id)?.label ?? fallback;
}
