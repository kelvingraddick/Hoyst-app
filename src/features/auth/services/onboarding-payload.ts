import type {OnboardingGoal, OnboardingPreferences} from './onboarding-options';

export type OnboardingIntentDraft = {
  goal?: OnboardingGoal;
};

export function buildOnboardingPreferences(
  draft: OnboardingIntentDraft,
): OnboardingPreferences | undefined {
  const preferences: OnboardingPreferences = {
    goal: draft.goal,
  };

  return preferences.goal ? preferences : undefined;
}
