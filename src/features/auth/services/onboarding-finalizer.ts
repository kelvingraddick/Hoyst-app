import type {UserProfile, CreateCircleDraft} from '../../../types/models';
import type {
  CompleteProfileInput,
  CompleteProfileResult,
} from './account-service';
import type {OnboardingPreferences} from './onboarding-options';
import {completeOnboardingSetup} from './onboarding-completion';

type ReadyProfileOnboardingSetupInput = {
  firstCircleSkipped: boolean;
  onboardingPreferences?: OnboardingPreferences;
  profile: UserProfile;
  starterCircleDraft: CreateCircleDraft;
  starterCircleSetupId: string;
  timezone: string;
};

type ReadyProfileOnboardingSetupDeps = {
  completeProfile: (input: CompleteProfileInput) => Promise<CompleteProfileResult>;
};

export async function finalizeReadyProfileOnboardingSetup(
  input: ReadyProfileOnboardingSetupInput,
  deps: ReadyProfileOnboardingSetupDeps,
) {
  const result = await completeOnboardingSetup(
    {
      firstCircleSkipped: input.firstCircleSkipped,
      profile: {
        ...(input.profile.avatarUrl ? {avatarUrl: input.profile.avatarUrl} : {}),
        displayName: input.profile.name,
        handle: input.profile.handle,
        ...(input.onboardingPreferences
          ? {onboardingPreferences: input.onboardingPreferences}
          : {}),
        timezone: input.timezone.trim() || input.profile.timezone || 'UTC',
      },
      starterCircleDraft: {
        ...input.starterCircleDraft,
        timezone:
          input.timezone.trim() ||
          input.starterCircleDraft.timezone ||
          input.profile.timezone,
      },
      starterCircleSetupId: input.starterCircleSetupId,
    },
    deps,
  );

  if (!result.circleCreated) {
    throw new Error('Starter circle was not created.');
  }

  return result;
}
