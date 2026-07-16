import type {OnboardingFocusArea, OnboardingPreferences} from './onboarding-options';

export type OnboardingIntentDraft = {
  categories?: string[];
  focusArea?: OnboardingFocusArea;
};

export function buildOnboardingPreferences(
  draft: OnboardingIntentDraft,
): OnboardingPreferences | undefined {
  const preferences: OnboardingPreferences = {
    categories: draft.categories?.filter(Boolean),
    focusArea: draft.focusArea,
  };

  return preferences.categories?.length || preferences.focusArea
    ? preferences
    : undefined;
}
