import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {HoystScreen} from '../design/components/HoystScreen';
import {HoystText} from '../design/components/HoystText';
import {CreateCircleScreen} from '../features/create-circle/screens/CreateCircleScreen';
import {CircleDetailScreen} from '../features/circles/screens/CircleDetailScreen';
import {InboxScreen} from '../features/inbox/screens/InboxScreen';
import {EditProfileScreen} from '../features/settings/screens/EditProfileScreen';
import {SettingsScreen} from '../features/settings/screens/SettingsScreen';
import {TapInCompleteScreen} from '../features/check-in/screens/TapInCompleteScreen';
import {TapInComposerScreen} from '../features/check-in/screens/TapInComposerScreen';
import {TapInPickerScreen} from '../features/check-in/screens/TapInPickerScreen';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';
import {AppTabsNavigator} from './AppTabsNavigator';
import {AuthStackNavigator} from './AuthStackNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen(): React.JSX.Element {
  return (
    <HoystScreen>
      <HoystText variant="headline">Loading Hoyst</HoystText>
    </HoystScreen>
  );
}

export function RootNavigator(): React.JSX.Element {
  const status = useSessionStore(state => state.status);
  const hasHydratedOnboarding = useOnboardingStore(state => state.hasHydrated);
  const hasSeenOnboarding = useOnboardingStore(state => state.hasSeenOnboarding);
  const shouldShowAuthFirst =
    status === 'authenticating' ||
    status === 'authenticatedIncompleteProfile' ||
    (status === 'guest' && !hasSeenOnboarding);
  const isLoading = status === 'initializing' || !hasHydratedOnboarding;

  return (
    <Stack.Navigator>
      {isLoading ? (
        <Stack.Screen
          component={LoadingScreen}
          name="MainTabs"
          options={{headerShown: false}}
        />
      ) : shouldShowAuthFirst ? (
        <Stack.Screen
          component={AuthStackNavigator}
          name="Auth"
          options={{headerShown: false}}
        />
      ) : (
        <Stack.Screen
          component={AppTabsNavigator}
          name="MainTabs"
          options={{headerShown: false}}
        />
      )}
      {shouldShowAuthFirst ? (
        <Stack.Screen
          component={AppTabsNavigator}
          name="MainTabs"
          options={{headerShown: false}}
        />
      ) : !isLoading ? (
        <Stack.Screen
          component={AuthStackNavigator}
          name="Auth"
          options={{
            animation: 'slide_from_bottom',
            headerShown: false,
            presentation: 'modal',
          }}
        />
      ) : null}
      <Stack.Screen
        component={InboxScreen}
        name="Inbox"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={SettingsScreen}
        name="Settings"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={EditProfileScreen}
        name="EditProfile"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={TapInPickerScreen}
        name="TapInPicker"
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        component={CircleDetailScreen}
        name="CircleDetail"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={CreateCircleScreen}
        name="CreateCircle"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={TapInComposerScreen}
        name="TapInComposer"
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        component={TapInCompleteScreen}
        name="TapInComplete"
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
}
