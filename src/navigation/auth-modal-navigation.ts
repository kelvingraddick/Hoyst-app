import type {NavigationProp, ParamListBase} from '@react-navigation/native';

type MaybeParentNavigation = NavigationProp<ParamListBase> & {
  getParent?: () => MaybeParentNavigation | undefined;
};

function hasAuthRoute(navigation: MaybeParentNavigation) {
  const state = navigation.getState();
  const routeNames = 'routeNames' in state ? state.routeNames : undefined;

  return Array.isArray(routeNames) && routeNames.includes('Auth');
}

export function navigateToAuthWelcome(
  navigation?: MaybeParentNavigation,
): boolean {
  return navigateToAuth(navigation, 'Welcome');
}

export function navigateToAuthSignIn(
  navigation?: MaybeParentNavigation,
): boolean {
  return navigateToAuth(navigation, 'SignIn');
}

function navigateToAuth(
  navigation: MaybeParentNavigation | undefined,
  screen: 'SignIn' | 'Welcome',
): boolean {
  let currentNavigation = navigation;

  while (currentNavigation) {
    if (hasAuthRoute(currentNavigation)) {
      currentNavigation.navigate('Auth', {screen});
      return true;
    }

    currentNavigation = currentNavigation.getParent?.();
  }

  return false;
}
