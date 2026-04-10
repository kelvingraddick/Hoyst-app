import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {SignInScreen} from '../features/auth/screens/SignInScreen';
import {WelcomeScreen} from '../features/auth/screens/WelcomeScreen';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen component={WelcomeScreen} name="Welcome" />
      <Stack.Screen component={SignInScreen} name="SignIn" />
    </Stack.Navigator>
  );
}
