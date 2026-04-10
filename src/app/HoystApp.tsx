import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';

import {AppProviders} from './providers/AppProviders';
import {createNavigationTheme} from '../design/theme/navigationTheme';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {RootNavigator} from '../navigation/RootNavigator';

function HoystAppInner(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <NavigationContainer theme={createNavigationTheme(theme)}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export function HoystApp(): React.JSX.Element {
  return (
    <AppProviders>
      <HoystAppInner />
    </AppProviders>
  );
}
