import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {HoystScreen} from '../design/components/HoystScreen';
import {HoystText} from '../design/components/HoystText';
import {CreateCircleScreen} from '../features/create-circle/screens/CreateCircleScreen';
import {CircleDetailScreen} from '../features/circles/screens/CircleDetailScreen';
import {EditProfileScreen} from '../features/settings/screens/EditProfileScreen';
import {SettingsScreen} from '../features/settings/screens/SettingsScreen';
import {TapInCompleteScreen} from '../features/check-in/screens/TapInCompleteScreen';
import {TapInComposerScreen} from '../features/check-in/screens/TapInComposerScreen';
import {TapInPickerScreen} from '../features/check-in/screens/TapInPickerScreen';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';
import {AppTabsNavigator} from './AppTabsNavigator';
import {AuthStackNavigator} from './AuthStackNavigator';
import {getRootNavigatorMode} from './root-mode';
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
  const currentStep = useOnboardingStore(state => state.currentStep);
  const hasHydratedOnboarding = useOnboardingStore(state => state.hasHydrated);
  const hasPendingStarterCircleSetup = useOnboardingStore(
    state => state.hasPendingStarterCircleSetup,
  );
  const hasSeenOnboarding = useOnboardingStore(
    state => state.hasSeenOnboarding,
  );
  const mode = getRootNavigatorMode({
    currentStep,
    hasHydratedOnboarding,
    hasPendingStarterCircleSetup,
    hasSeenOnboarding,
    status,
  });
  const canPresentAuthModal =
    mode === 'main' && status !== 'authenticatedReady';

  return (
    <Stack.Navigator key={mode}>
      {mode === 'loading' ? (
        <Stack.Screen
          component={LoadingScreen}
          name="Loading"
          options={{headerShown: false}}
        />
      ) : mode === 'authFirst' ? (
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
      {canPresentAuthModal ? (
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
