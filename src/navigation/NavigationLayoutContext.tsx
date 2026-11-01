import {createContext, useContext} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NavigationLayout} from './navigation-layout';

export const NavigationLayoutContext = createContext<NavigationLayout | null>(
  null,
);

export function useNavigationLayout() {
  return useContext(NavigationLayoutContext);
}

export function useTabContentInsets() {
  const safe = useSafeAreaInsets();
  return useNavigationLayout()?.contentInsets ?? safe;
}
