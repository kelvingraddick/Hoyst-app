import type {
  AuthSessionStatus,
  PendingProtectedAction,
} from '../store/session-store';
import type {OnboardingStep} from '../features/auth/services/onboarding-options';

export type RootNavigatorMode = 'loading' | 'main';
export type RootAuthPresentation = 'onboarding' | 'finishProfile';

type RootNavigatorModeInput = {
  currentStep?: OnboardingStep;
  hasHydratedOnboarding: boolean;
  hasPendingStarterCircleSetup?: boolean;
  hasSeenOnboarding?: boolean;
  status: AuthSessionStatus;
};

type AccountRouteRegistrationInput = {
  mode: RootNavigatorMode;
  status: AuthSessionStatus;
};

type ReadyOnboardingInput = {
  currentStep?: OnboardingStep;
  hasPendingProfileCompletion?: boolean;
  hasPendingStarterCircleSetup?: boolean;
  hasSeenOnboarding: boolean;
  status: AuthSessionStatus;
};

type AuthModalRegistrationInput = ReadyOnboardingInput & {
  mode: RootNavigatorMode;
};

type RootAuthPresentationInput = {
  currentStep?: OnboardingStep;
  hasHydratedOnboarding: boolean;
  hasPendingProfileCompletion?: boolean;
  hasSeenOnboarding: boolean;
  pendingAction?: PendingProtectedAction;
  hasPendingInvite?: boolean;
  status: AuthSessionStatus;
};

export function getRootNavigatorMode({
  hasHydratedOnboarding,
  status,
}: RootNavigatorModeInput): RootNavigatorMode {
  if (status === 'initializing' || !hasHydratedOnboarding) {
    return 'loading';
  }

  return 'main';
}

export function hasActiveReadyOnboarding({
  currentStep,
  hasPendingProfileCompletion,
  hasPendingStarterCircleSetup,
  hasSeenOnboarding,
  status,
}: ReadyOnboardingInput): boolean {
  return (
    status === 'authenticatedReady' &&
    !hasSeenOnboarding &&
    (hasPendingProfileCompletion ||
      hasPendingStarterCircleSetup ||
      currentStep === 'notifications' ||
      currentStep === 'auth')
  );
}

export function shouldRegisterAuthModal({
  mode,
  status: _status,
  ..._readyOnboardingInput
}: AuthModalRegistrationInput): boolean {
  return mode === 'main';
}

export function shouldDismissAuthModal({
  status,
  ...readyOnboardingInput
}: ReadyOnboardingInput): boolean {
  return (
    status === 'authenticatedReady' &&
    !hasActiveReadyOnboarding({status, ...readyOnboardingInput})
  );
}

export function getRootAuthPresentation({
  currentStep,
  hasHydratedOnboarding,
  hasPendingProfileCompletion,
  hasSeenOnboarding,
  pendingAction,
  hasPendingInvite,
  status,
}: RootAuthPresentationInput): RootAuthPresentation | undefined {
  if (!hasHydratedOnboarding) {
    return undefined;
  }

  if (status === 'authenticatedIncompleteProfile') {
    return 'finishProfile';
  }

  if (
    status === 'authenticatedReady' &&
    !hasSeenOnboarding &&
    hasPendingProfileCompletion &&
    currentStep === 'finishProfile'
  ) {
    return 'finishProfile';
  }

  if (
    status === 'guest' &&
    !hasSeenOnboarding &&
    !pendingAction &&
    !hasPendingInvite
  ) {
    return 'onboarding';
  }

  return undefined;
}

export function shouldRegisterAccountRoutes({
  mode,
  status,
}: AccountRouteRegistrationInput): boolean {
  return mode === 'main' && status === 'authenticatedReady';
}
