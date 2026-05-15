import type {RootStackParamList} from './types';

type RootRouteName = keyof RootStackParamList;
type SettingsResetRoute =
  | {name: 'Auth'; params: {screen: 'Welcome'}}
  | {name: 'MainTabs'; params: {screen: 'Home'}};

export function getSettingsFallbackRoute(
  routeNames: readonly string[],
): Extract<RootRouteName, 'Auth' | 'MainTabs'> | undefined {
  if (routeNames.includes('MainTabs')) {
    return 'MainTabs';
  }

  if (routeNames.includes('Auth')) {
    return 'Auth';
  }

  return undefined;
}

export function getSettingsResetRoute(
  routeNames: readonly string[],
): SettingsResetRoute | undefined {
  const fallbackRoute = getSettingsFallbackRoute(routeNames);

  if (fallbackRoute === 'MainTabs') {
    return {name: 'MainTabs', params: {screen: 'Home'}};
  }

  if (fallbackRoute === 'Auth') {
    return {name: 'Auth', params: {screen: 'Welcome'}};
  }

  return undefined;
}
