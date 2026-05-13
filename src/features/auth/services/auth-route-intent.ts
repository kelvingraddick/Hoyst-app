import type {
  SignInEntryPoint,
  SignInMethod,
  SignInMode,
  SignInRouteParams,
} from '../../../navigation/types';

export type SignInRouteIntent = {
  entryPoint?: SignInEntryPoint;
  method?: SignInMethod;
  mode: SignInMode;
};

export function resolveSignInRouteIntent(
  params?: SignInRouteParams,
): SignInRouteIntent {
  return {
    entryPoint: params?.entryPoint,
    method: params?.method,
    mode: params?.mode ?? 'signIn',
  };
}

export function getOnboardingSignInParams(
  method: SignInMethod,
  entryPoint: SignInEntryPoint = 'onboarding',
): SignInRouteParams {
  return {
    entryPoint,
    method,
    mode: 'register',
  };
}

export function getWelcomeSignInParams(): SignInRouteParams {
  return {
    entryPoint: 'welcome',
    mode: 'signIn',
  };
}

export function getProfileSignInParams(): SignInRouteParams {
  return {
    entryPoint: 'profile',
    mode: 'signIn',
  };
}

export function switchSignInMode(
  intent: SignInRouteIntent,
): SignInRouteIntent {
  return {
    ...intent,
    mode: intent.mode === 'signIn' ? 'register' : 'signIn',
  };
}
