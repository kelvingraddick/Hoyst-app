import type {CreateCircleDraft} from '../../../types/models';
import {
  buildStarterCirclePayload,
  isStarterCircleDraftReady,
} from './onboarding-circle';
import type {CompleteProfileInput, CompleteProfileResult} from './account-service';

type CreatedCircle = {
  circleId: string;
  inviteCode?: string;
};

type CompleteOnboardingSetupInput = {
  firstCircleSkipped: boolean;
  profile: CompleteProfileInput;
  starterCircleDraft: CreateCircleDraft;
  starterCircleSetupId?: string;
};

type CompleteOnboardingSetupDeps = {
  completeProfile: (input: CompleteProfileInput) => Promise<CompleteProfileResult>;
  onProfileCompleted?: () => void;
};

export type CompleteOnboardingSetupResult = {
  circle?: CreatedCircle;
  circleCreated: boolean;
};

export function shouldCreateStarterCircle({
  firstCircleSkipped,
  starterCircleDraft,
}: Pick<CompleteOnboardingSetupInput, 'firstCircleSkipped' | 'starterCircleDraft'>) {
  return !firstCircleSkipped && isStarterCircleDraftReady(starterCircleDraft);
}

export async function completeOnboardingSetup(
  input: CompleteOnboardingSetupInput,
  deps: CompleteOnboardingSetupDeps,
): Promise<CompleteOnboardingSetupResult> {
  const shouldCreateCircle = shouldCreateStarterCircle(input);
  const starterCircleSetupId = input.starterCircleSetupId;

  if (shouldCreateCircle && !starterCircleSetupId) {
    throw new Error('Starter circle setup is missing.');
  }

  const starterCircle = shouldCreateCircle
    ? {
        ...buildStarterCirclePayload(input.starterCircleDraft),
        setupId: starterCircleSetupId as string,
      }
    : undefined;

  const result = await deps.completeProfile({
    ...input.profile,
    ...(starterCircle ? {starterCircle} : {}),
  });
  deps.onProfileCompleted?.();

  if (!shouldCreateCircle) {
    return {circleCreated: false};
  }

  if (!result.starterCircle) {
    throw new Error('Starter circle was not created.');
  }

  return {circle: result.starterCircle, circleCreated: Boolean(result.starterCircle)};
}
