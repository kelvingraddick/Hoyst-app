import React, {useEffect, useState} from 'react';
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
import {CircleInviteCoordinator} from '../features/circle-invites/providers/CircleInviteCoordinator';

function HoystAppInner(): React.JSX.Element {
  const theme = useHoystTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

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
        onReady={() => setIsNavigationReady(true)}
        ref={navigationRef}
        theme={createNavigationTheme(theme)}>
        <CircleInviteCoordinator
          isNavigationReady={isNavigationReady}
          navigationRef={navigationRef}
        />
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
