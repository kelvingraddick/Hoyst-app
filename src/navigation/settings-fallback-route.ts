import type {RootStackParamList} from './types';

type RootRouteName = keyof RootStackParamList;

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
