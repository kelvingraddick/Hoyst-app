import type {AuthSessionStatus} from '../store/session-store';
import type {OnboardingStep} from '../features/auth/services/onboarding-options';
import type {AuthStackParamList} from './types';

type AuthInitialRouteInput = {
  currentStep: OnboardingStep;
  status: AuthSessionStatus;
};

export function getAuthInitialRouteName({
  currentStep,
  status,
}: AuthInitialRouteInput): keyof AuthStackParamList {
  if (
    status === 'authenticatedIncompleteProfile' &&
    currentStep !== 'notifications' &&
    currentStep !== 'auth' &&
    currentStep !== 'finishProfile'
  ) {
    return 'CompleteProfile';
  }

  return 'Welcome';
}
