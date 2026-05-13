import React, {useEffect} from 'react';
import {CommonActions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {CompleteProfileScreen} from '../features/auth/screens/CompleteProfileScreen';
import {SignInScreen} from '../features/auth/screens/SignInScreen';
import {WelcomeScreen} from '../features/auth/screens/WelcomeScreen';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';
import {getAuthInitialRouteName} from './auth-stack-policy';
import {getStateWithoutAuthModal} from './auth-modal-state';
import type {AuthStackParamList, RootStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthStackNavigator({navigation}: Props): React.JSX.Element {
  const status = useSessionStore(state => state.status);
  const currentStep = useOnboardingStore(state => state.currentStep);
  const initialRouteName = getAuthInitialRouteName({currentStep, status});
  const isStandaloneProfileCompletion = initialRouteName === 'CompleteProfile';
  const navigatorKey =
    status === 'authenticatedIncompleteProfile'
      ? isStandaloneProfileCompletion
        ? 'profile-completion'
        : 'onboarding-profile-completion'
      : initialRouteName;

  useEffect(() => {
    if (
      status !== 'authenticatedReady' ||
      !getStateWithoutAuthModal(navigation.getState())
    ) {
      return;
    }

    navigation.dispatch(currentState =>
      CommonActions.reset(
        getStateWithoutAuthModal(currentState) ?? currentState,
      ),
    );
  }, [navigation, status]);

  if (isStandaloneProfileCompletion) {
    return (
      <Stack.Navigator
        initialRouteName="CompleteProfile"
        key={navigatorKey}
        screenOptions={{headerShown: false}}>
        <Stack.Screen component={CompleteProfileScreen} name="CompleteProfile" />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      key={navigatorKey}
      screenOptions={{headerShown: false}}>
      <Stack.Screen component={WelcomeScreen} name="Welcome" />
      <Stack.Screen component={SignInScreen} name="SignIn" />
      <Stack.Screen component={CompleteProfileScreen} name="CompleteProfile" />
    </Stack.Navigator>
  );
}
