import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {CreateCircleScreen} from '../features/create-circle/screens/CreateCircleScreen';
import {CheckInModalScreen} from '../features/check-in/screens/CheckInModalScreen';
import {CircleDetailScreen} from '../features/circles/screens/CircleDetailScreen';
import {useSessionStore} from '../store/session-store';
import {AppTabsNavigator} from './AppTabsNavigator';
import {AuthStackNavigator} from './AuthStackNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const isAuthenticated = useSessionStore(state => state.isAuthenticated);
  const previewMode = useSessionStore(state => state.previewMode);
  const shouldShowAppShell = previewMode || isAuthenticated;

  return (
    <Stack.Navigator>
      {shouldShowAppShell ? (
        <Stack.Screen
          component={AppTabsNavigator}
          name="MainTabs"
          options={{headerShown: false}}
        />
      ) : (
        <Stack.Screen
          component={AuthStackNavigator}
          name="Auth"
          options={{headerShown: false}}
        />
      )}
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
        component={CheckInModalScreen}
        name="CheckInModal"
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
}
