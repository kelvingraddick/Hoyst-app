import type {OnboardingFocusArea, OnboardingPreferences} from './onboarding-options';

export type OnboardingIntentDraft = {
  focusArea?: OnboardingFocusArea;
};

export function buildOnboardingPreferences(
  draft: OnboardingIntentDraft,
): OnboardingPreferences | undefined {
  const preferences: OnboardingPreferences = {
    focusArea: draft.focusArea,
  };

  return preferences.focusArea ? preferences : undefined;
}
