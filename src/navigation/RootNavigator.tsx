import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {HoystScreen} from '../design/components/HoystScreen';
import {HoystText} from '../design/components/HoystText';
import {CreateCircleScreen} from '../features/create-circle/screens/CreateCircleScreen';
import {CircleDetailScreen} from '../features/circles/screens/CircleDetailScreen';
import {CircleToolsScreen} from '../features/circles/screens/CircleToolsScreen';
import {CirclesScreen} from '../features/circles/screens/CirclesScreen';
import {PastCircleScreen} from '../features/circles/screens/PastCircleScreen';
import {ArchivedCirclesScreen} from '../features/circles/screens/ArchivedCirclesScreen';
import {EditCircleScreen} from '../features/circles/screens/EditCircleScreen';
import {ConvertPersonalCircleScreen} from '../features/circles/screens/ConvertPersonalCircleScreen';
import {EditProfileScreen} from '../features/settings/screens/EditProfileScreen';
import {TapInCompleteScreen} from '../features/check-in/screens/TapInCompleteScreen';
import {TapInComposerScreen} from '../features/check-in/screens/TapInComposerScreen';
import {TapInPickerScreen} from '../features/check-in/screens/TapInPickerScreen';
import {TapInStoryShareScreen} from '../features/check-in/screens/TapInStoryShareScreen';
import {InboxScreen} from '../features/inbox/screens/InboxScreen';
import {CircleInviteScreen} from '../features/circle-invites/screens/CircleInviteScreen';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';
import {AppTabsNavigator} from './AppTabsNavigator';
import {AuthStackNavigator} from './AuthStackNavigator';
import {getRootNavigatorMode, shouldRegisterAccountRoutes} from './root-mode';
import type {RootStackParamList} from './types';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {getTapInComposerScreenOptions} from './tap-in-sheet-options';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen(): React.JSX.Element {
  return (
    <HoystScreen>
      <HoystText variant="headline">Loading Hoyst</HoystText>
    </HoystScreen>
  );
}

export function RootNavigator(): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const hasHydratedOnboarding = useOnboardingStore(state => state.hasHydrated);
  const mode = getRootNavigatorMode({
    hasHydratedOnboarding,
    status,
  });
  const canRegisterAccountRoutes = shouldRegisterAccountRoutes({mode, status});

  return (
    <Stack.Navigator key={mode}>
      {mode === 'loading' ? (
        <Stack.Screen
          component={LoadingScreen}
          name="Loading"
          options={{headerShown: false}}
        />
      ) : (
        <Stack.Screen
          component={AppTabsNavigator}
          name="MainTabs"
          options={{headerShown: false}}
        />
      )}
      {mode === 'main' ? (
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
      {canRegisterAccountRoutes ? (
        <Stack.Screen
          component={EditProfileScreen}
          name="EditProfile"
          options={{
            animation: 'slide_from_right',
            headerShown: false,
          }}
        />
      ) : null}
      <Stack.Screen
        component={CircleInviteScreen}
        name="CircleInvite"
        options={{
          animation: 'fade',
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
        component={InboxScreen}
        name="Inbox"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={CirclesScreen}
        name="Circles"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
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
        component={ArchivedCirclesScreen}
        name="ArchivedCircles"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={PastCircleScreen}
        name="PastCircle"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={EditCircleScreen}
        name="EditCircle"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={CircleToolsScreen}
        name="CircleTools"
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={ConvertPersonalCircleScreen}
        name="ConvertPersonalCircle"
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
        options={getTapInComposerScreenOptions(theme.background)}
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
      <Stack.Screen
        component={TapInStoryShareScreen}
        name="TapInStoryShare"
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
}
