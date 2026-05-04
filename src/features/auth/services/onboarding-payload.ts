import type {
  OnboardingCategory,
  OnboardingGoal,
  OnboardingPace,
  OnboardingPreferences,
  ReminderPreference,
  SocialComfort,
} from './onboarding-options';

export type OnboardingIntentDraft = {
  categories: OnboardingCategory[];
  goal?: OnboardingGoal;
  pace?: OnboardingPace;
  reminderPreference?: ReminderPreference;
  socialComfort?: SocialComfort;
};

export function buildOnboardingPreferences(
  draft: OnboardingIntentDraft,
): OnboardingPreferences | undefined {
  const preferences: OnboardingPreferences = {
    categories: draft.categories,
    goal: draft.goal,
    pace: draft.pace,
    reminderPreference: draft.reminderPreference,
    socialComfort: draft.socialComfort,
  };

  const hasPreferences =
    preferences.categories.length > 0 ||
    Boolean(
      preferences.goal ||
        preferences.pace ||
        preferences.reminderPreference ||
        preferences.socialComfort,
    );

  return hasPreferences ? preferences : undefined;
}
