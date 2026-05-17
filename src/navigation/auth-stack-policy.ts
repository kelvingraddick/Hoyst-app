import type {AuthSessionStatus} from '../store/session-store';
import type {OnboardingStep} from '../features/auth/services/onboarding-options';
import type {AuthStackParamList} from './types';

type AuthInitialRouteInput = {
  currentStep: OnboardingStep;
  status: AuthSessionStatus;
};

export function getAuthInitialRouteName({
  currentStep: _currentStep,
  status: _status,
}: AuthInitialRouteInput): keyof AuthStackParamList {
  return 'Welcome';
}
