export type OnboardingStep =
  | 'welcome'
  | 'coach'
  | 'circleCommitment'
  | 'circleMode'
  | 'circleCategory'
  | 'circleTitle'
  | 'circleRules'
  | 'circleGrace'
  | 'circlePrivacy'
  | 'circleCapacity'
  | 'circleTimezone'
  | 'circleReview'
  | 'notifications'
  | 'auth'
  | 'finishProfile';

export type OnboardingFocusArea =
  | 'fitness'
  | 'focus'
  | 'wellness'
  | 'sobriety'
  | 'learning'
  | 'creative';

export type OnboardingOption<T extends string> = {
  accent: 'green' | 'orange' | 'purple' | 'blue';
  description: string;
  id: T;
  label: string;
};

export type OnboardingPreferences = {
  categories?: string[];
  focusArea?: OnboardingFocusArea;
};

export const onboardingSteps: OnboardingStep[] = [
  'welcome',
  'coach',
  'circleCommitment',
  'circleMode',
  'circleCategory',
  'circleTitle',
  'circleRules',
  'circleGrace',
  'circlePrivacy',
  'circleCapacity',
  'circleTimezone',
  'circleReview',
  'notifications',
  'auth',
  'finishProfile',
];

export const onboardingProgressSteps = onboardingSteps.filter(
  step => step !== 'welcome',
);

export function getOnboardingSteps(
  circleMode: 'personal' | 'group',
): OnboardingStep[] {
  return onboardingSteps.filter(step =>
    circleMode === 'personal'
      ? step !== 'circleTitle' &&
        step !== 'circlePrivacy' &&
        step !== 'circleCapacity'
      : true,
  );
}

export function getOnboardingProgressSteps(
  circleMode: 'personal' | 'group',
) {
  return getOnboardingSteps(circleMode).filter(step => step !== 'welcome');
}

export const focusAreaOptions: OnboardingOption<OnboardingFocusArea>[] = [
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

export function getOptionLabel<T extends string>(
  options: OnboardingOption<T>[],
  id?: T,
  fallback = 'Not set yet',
) {
  return options.find(option => option.id === id)?.label ?? fallback;
}

export function getLegacyFocusAreaCategory(
  focusArea?: OnboardingFocusArea,
) {
  if (focusArea === 'fitness') {
    return 'Fitness';
  }
  if (focusArea === 'focus') {
    return 'Deep Work';
  }
  if (focusArea === 'wellness') {
    return 'Wellness';
  }
  if (focusArea === 'sobriety') {
    return 'Sobriety';
  }
  return 'Custom';
}
