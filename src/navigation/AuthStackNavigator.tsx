import React, {useEffect} from 'react';
import {CommonActions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {SignInScreen} from '../features/auth/screens/SignInScreen';
import {WelcomeScreen} from '../features/auth/screens/WelcomeScreen';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';
import {getAuthInitialRouteName} from './auth-stack-policy';
import {getStateWithoutAuthModal} from './auth-modal-state';
import {shouldDismissAuthModal} from './root-mode';
import type {AuthStackParamList, RootStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthStackNavigator({navigation}: Props): React.JSX.Element {
  const status = useSessionStore(state => state.status);
  const currentStep = useOnboardingStore(state => state.currentStep);
  const hasPendingProfileCompletion = useOnboardingStore(
    state => state.hasPendingProfileCompletion,
  );
  const hasPendingStarterCircleSetup = useOnboardingStore(
    state => state.hasPendingStarterCircleSetup,
  );
  const hasSeenOnboarding = useOnboardingStore(
    state => state.hasSeenOnboarding,
  );
  const initialRouteName = getAuthInitialRouteName({currentStep, status});
  const navigatorKey =
    status === 'authenticatedIncompleteProfile'
      ? 'onboarding-profile-completion'
      : initialRouteName;

  useEffect(() => {
    if (
      !shouldDismissAuthModal({
        currentStep,
        hasPendingProfileCompletion,
        hasPendingStarterCircleSetup,
        hasSeenOnboarding,
        status,
      }) ||
      !getStateWithoutAuthModal(navigation.getState())
    ) {
      return;
    }

    navigation.dispatch(currentState =>
      CommonActions.reset(
        getStateWithoutAuthModal(currentState) ?? currentState,
      ),
    );
  }, [
    currentStep,
    hasPendingProfileCompletion,
    hasPendingStarterCircleSetup,
    hasSeenOnboarding,
    navigation,
    status,
  ]);

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      key={navigatorKey}
      screenOptions={{headerShown: false}}>
      <Stack.Screen component={WelcomeScreen} name="Welcome" />
      <Stack.Screen component={SignInScreen} name="SignIn" />
    </Stack.Navigator>
  );
}
