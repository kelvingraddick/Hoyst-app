import React, {useEffect} from 'react';
import {AppState, StatusBar} from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';

import {AppProviders} from './providers/AppProviders';
import {createNavigationTheme} from '../design/theme/navigationTheme';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {RootNavigator} from '../navigation/RootNavigator';
import type {RootStackParamList} from '../navigation/types';
import {
  initializePushNotifications,
  setNotificationNavigationRef,
  syncPushSubscription,
} from '../lib/notifications';

function HoystAppInner(): React.JSX.Element {
  const theme = useHoystTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    initializePushNotifications();
    setNotificationNavigationRef(navigationRef);

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          syncPushSubscription().catch(() => undefined);
        }
      },
    );

    return () => {
      setNotificationNavigationRef(null);
      appStateSubscription.remove();
    };
  }, [navigationRef]);

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <NavigationContainer
        ref={navigationRef}
        theme={createNavigationTheme(theme)}>
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
