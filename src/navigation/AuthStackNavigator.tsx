import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {CompleteProfileScreen} from '../features/auth/screens/CompleteProfileScreen';
import {SignInScreen} from '../features/auth/screens/SignInScreen';
import {WelcomeScreen} from '../features/auth/screens/WelcomeScreen';
import {useSessionStore} from '../store/session-store';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator(): React.JSX.Element {
  const status = useSessionStore(state => state.status);
  const initialRouteName =
    status === 'authenticatedIncompleteProfile' ? 'CompleteProfile' : 'Welcome';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      key={initialRouteName}
      screenOptions={{headerShown: false}}>
      <Stack.Screen component={WelcomeScreen} name="Welcome" />
      <Stack.Screen component={SignInScreen} name="SignIn" />
      <Stack.Screen component={CompleteProfileScreen} name="CompleteProfile" />
    </Stack.Navigator>
  );
}
