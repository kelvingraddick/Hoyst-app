import {BetaMembershipAnalytics} from '../features/beta/components/BetaMembershipAnalytics';
import {
  initializeAnalytics,
  trackEvent,
  flushAnalytics,
} from '../lib/analytics';
import {initializeMonitoring} from '../lib/monitoring';
import {AcquisitionQuestion} from '../features/beta/components/AcquisitionQuestion';
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
  const [routeName, setRouteName] = useState<string>();
  const previousScreen = React.useRef<string | undefined>(undefined);
  const reportScreen = () => {
    const name = navigationRef.getCurrentRoute()?.name;
    setRouteName(name);
    if (name && name !== previousScreen.current) {
      previousScreen.current = name;
      trackEvent('screen_viewed', {screen: name});
    }
  };
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    initializeMonitoring();
    initializeAnalytics();
    trackEvent('app_opened', {entry: 'launch'});
    initializePushNotifications();
    setNotificationNavigationRef(navigationRef);

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') {
          trackEvent('app_opened', {entry: 'foreground'});
          syncPushSubscription().catch(() => undefined);
        } else {
          flushAnalytics();
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
        onReady={() => {
          setIsNavigationReady(true);
          reportScreen();
        }}
        onStateChange={reportScreen}
        ref={navigationRef}
        theme={createNavigationTheme(theme)}>
        <CircleInviteCoordinator
          isNavigationReady={isNavigationReady}
          navigationRef={navigationRef}
        />
        <RootNavigator />
        <BetaMembershipAnalytics />
        <AcquisitionQuestion
          canShow={isNavigationReady && routeName === 'Home'}
        />
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
