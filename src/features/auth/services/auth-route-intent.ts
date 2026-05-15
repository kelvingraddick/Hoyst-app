import type {
  SignInEntryPoint,
  SignInMethod,
  SignInRouteParams,
} from '../../../navigation/types';

export type SignInRouteIntent = {
  entryPoint?: SignInEntryPoint;
  method?: SignInMethod;
};

export function resolveSignInRouteIntent(
  params?: SignInRouteParams,
): SignInRouteIntent {
  return {
    entryPoint: params?.entryPoint,
    method: params?.method,
  };
}

export function getWelcomeSignInParams(): SignInRouteParams {
  return {
    entryPoint: 'welcome',
  };
}

export function getProfileSignInParams(): SignInRouteParams {
  return {
    entryPoint: 'profile',
  };
}
