import React, {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import {useColorScheme} from 'react-native';
import {getSystemTheme, type SystemScheme, type SystemTheme} from './tokens';

const ThemeContext = createContext<SystemTheme | null>(null);

/** Pass the existing account appearance preference at each migrated screen boundary.
 * Gallery overrides remain local and never write application settings. */
export function DesignSystemProvider({
  scheme = 'system',
  children,
}: PropsWithChildren<{scheme?: SystemScheme | 'system'}>) {
  const nativeScheme = useColorScheme();
  const resolved =
    scheme === 'system' ? (nativeScheme === 'dark' ? 'dark' : 'light') : scheme;
  const theme = useMemo(() => getSystemTheme(resolved), [resolved]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useSystemTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('Design system components require DesignSystemProvider.');
  }
  return theme;
}
