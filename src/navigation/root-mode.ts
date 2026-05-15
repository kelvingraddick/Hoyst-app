import type {AuthSessionStatus} from '../store/session-store';
import type {OnboardingStep} from '../features/auth/services/onboarding-options';

export type RootNavigatorMode = 'loading' | 'authFirst' | 'main';

type RootNavigatorModeInput = {
  currentStep?: OnboardingStep;
  hasHydratedOnboarding: boolean;
  hasPendingStarterCircleSetup?: boolean;
  hasSeenOnboarding: boolean;
  status: AuthSessionStatus;
};

type AccountRouteRegistrationInput = {
  mode: RootNavigatorMode;
  status: AuthSessionStatus;
};

export function getRootNavigatorMode({
  currentStep,
  hasHydratedOnboarding,
  hasPendingStarterCircleSetup,
  hasSeenOnboarding,
  status,
}: RootNavigatorModeInput): RootNavigatorMode {
  if (status === 'initializing' || !hasHydratedOnboarding) {
    return 'loading';
  }

  if (
    status === 'authenticatedIncompleteProfile' ||
    (status === 'authenticatedReady' &&
      !hasSeenOnboarding &&
      (hasPendingStarterCircleSetup ||
        currentStep === 'notifications' ||
        currentStep === 'auth' ||
        currentStep === 'finishProfile')) ||
    (status === 'guest' && !hasSeenOnboarding)
  ) {
    return 'authFirst';
  }

  return 'main';
}

export function shouldRegisterAccountRoutes({
  mode,
  status,
}: AccountRouteRegistrationInput): boolean {
  return mode === 'main' && status === 'authenticatedReady';
}
