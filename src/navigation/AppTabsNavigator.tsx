import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  CirclesTabIcon,
  HomeTabIcon,
  MomentumTabIcon,
  ProfileTabIcon,
  type TabBarIconProps,
} from '../design/components/TabBarIcons';

import {TapInRingMark} from '../design/components/TapInRingMark';
import {getPulseRingStateForCircles} from '../design/components/pulse-ring-state';
import {CirclesScreen} from '../features/circles/screens/CirclesScreen';
import {HomeScreen} from '../features/home/screens/HomeScreen';
import {
  createEmptyHomeData,
  subscribeToHomeData,
  type HomeData,
} from '../features/home/services/home-data-service';
import {MomentumScreen} from '../features/momentum/screens/MomentumScreen';
import {ProfileScreen} from '../features/profile/screens/ProfileScreen';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {HoystTabBarBackground} from './components/HoystTabBarBackground';
import {canResumePendingAction} from './pending-action-resume';
import {navigateToAuthWelcome} from './auth-modal-navigation';
import {getRootAuthPresentation} from './root-mode';
import type {AppTabsParamList, RootStackParamList} from './types';
import {useOnboardingStore} from '../store/onboarding-store';
import {useUserProfileStore} from '../store/profile-store';
import {useSessionStore} from '../store/session-store';

const Tab = createBottomTabNavigator<AppTabsParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;
type StandardTabName = Exclude<keyof AppTabsParamList, 'TapIn'>;
type TabBarIconComponent = (props: TabBarIconProps) => React.JSX.Element;

const routeIcons: Record<StandardTabName, TabBarIconComponent> = {
  Home: HomeTabIcon,
  Circles: CirclesTabIcon,
  Momentum: MomentumTabIcon,
  Profile: ProfileTabIcon,
};

function TapInPlaceholder(): React.JSX.Element {
  return <View />;
}

export function AppTabsNavigator({
  navigation: rootNavigation,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const consumePendingAction = useSessionStore(
    state => state.consumePendingAction,
  );
  const pendingAction = useSessionStore(state => state.pendingAction);
  const currentStep = useOnboardingStore(state => state.currentStep);
  const hasHydratedOnboarding = useOnboardingStore(state => state.hasHydrated);
  const hasSeenOnboarding = useOnboardingStore(
    state => state.hasSeenOnboarding,
  );
  const hasPendingProfileCompletion = useOnboardingStore(
    state => state.hasPendingProfileCompletion,
  );
  const hasPendingStarterCircleSetup = useOnboardingStore(
    state => state.hasPendingStarterCircleSetup,
  );
  const startOnboardingWizard = useOnboardingStore(
    state => state.startOnboardingWizard,
  );
  const setCurrentStep = useOnboardingStore(state => state.setCurrentStep);
  const profile = useUserProfileStore(state => state.profile);
  const timezone = profile?.timezone ?? 'UTC';
  const [tabHomeData, setTabHomeData] = useState<HomeData>(() =>
    createEmptyHomeData(),
  );
  const didAutoPresentOnboardingRef = useRef(false);
  const tabPulseRingState = getPulseRingStateForCircles(tabHomeData.circles);

  useEffect(() => {
    if (status !== 'authenticatedReady' || !user?.uid) {
      setTabHomeData(createEmptyHomeData(timezone));
      return undefined;
    }

    return subscribeToHomeData({
      onData: setTabHomeData,
      onError: () => setTabHomeData(createEmptyHomeData(timezone)),
      timezone,
      uid: user.uid,
    });
  }, [status, timezone, user?.uid]);

  useEffect(() => {
    if (
      !canResumePendingAction({
        hasPendingStarterCircleSetup,
        status,
      })
    ) {
      return;
    }

    const consumedPendingAction = consumePendingAction();

    if (!consumedPendingAction) {
      return;
    }

    if (consumedPendingAction.type === 'createCircle') {
      rootNavigation.navigate('CreateCircle');
    } else if (consumedPendingAction.type === 'joinCircle') {
      rootNavigation.navigate('CircleDetail', {
        circleId: consumedPendingAction.circleId,
        resumeAction: 'join',
      });
    } else if (consumedPendingAction.type === 'tapIn') {
      rootNavigation.navigate('TapInComposer', {
        circleId: consumedPendingAction.circleId,
        source: consumedPendingAction.source,
      });
    } else if (consumedPendingAction.type === 'tapInPicker') {
      rootNavigation.navigate('TapInPicker');
    }
  }, [
    consumePendingAction,
    hasPendingStarterCircleSetup,
    rootNavigation,
    status,
  ]);

  useEffect(() => {
    const presentation = getRootAuthPresentation({
      currentStep,
      hasHydratedOnboarding,
      hasPendingProfileCompletion,
      hasSeenOnboarding,
      pendingAction,
      status,
    });

    if (presentation === 'onboarding' && !didAutoPresentOnboardingRef.current) {
      startOnboardingWizard();
      didAutoPresentOnboardingRef.current =
        navigateToAuthWelcome(rootNavigation);
      return;
    }

    if (presentation === 'finishProfile') {
      const rootState = rootNavigation.getState();
      const isAuthActive = rootState.routes.some(
        route => route.name === 'Auth',
      );
      const shouldForceFinishProfile =
        currentStep === 'welcome' || currentStep === 'auth';

      if (shouldForceFinishProfile) {
        setCurrentStep('finishProfile');
      }

      if (!isAuthActive) {
        navigateToAuthWelcome(rootNavigation);
      }
    }
  }, [
    currentStep,
    hasHydratedOnboarding,
    hasPendingProfileCompletion,
    hasSeenOnboarding,
    pendingAction,
    rootNavigation,
    setCurrentStep,
    startOnboardingWizard,
    status,
  ]);

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: theme.tabActiveForeground,
        tabBarBackground: HoystTabBarBackground,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle:
          route.name === 'TapIn' ? styles.tapInIconSlot : styles.tabBarIcon,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            bottom: Platform.OS === 'ios' ? 18 : 12,
            shadowColor: theme.shadow,
          },
        ],
        // React Navigation expects a render prop here, so the usual nested
        // component warning is noise for this specific API shape.
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: ({color, focused}) => {
          if (route.name === 'TapIn') {
            return (
              <TapInRingMark
                centerTreatment="state"
                innerSize={46}
                outerSize={78}
                state={tabPulseRingState}
                style={styles.tapInOffset}
              />
            );
          }

          const Icon = routeIcons[route.name as StandardTabName];
          const iconSize = 26;

          return (
            <Icon
              color={color}
              fill={focused ? color : 'none'}
              size={iconSize}
              strokeWidth={focused ? 2.1 : 1.9}
            />
          );
        },
      })}>
      <Tab.Screen component={HomeScreen} name="Home" />
      <Tab.Screen component={CirclesScreen} name="Circles" />
      <Tab.Screen
        component={TapInPlaceholder}
        listeners={() => ({
          tabPress: event => {
            event.preventDefault();

            if (status === 'authenticatedReady') {
              rootNavigation.navigate('TapInPicker');
              return;
            }

            beginAuthFlow({type: 'tapInPicker'});
            startOnboardingWizard();
            navigateToAuthWelcome(rootNavigation);
          },
        })}
        name="TapIn"
        options={{
          tabBarAccessibilityLabel: 'Tap In',
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen component={MomentumScreen} name="Momentum" />
      <Tab.Screen component={ProfileScreen} name="Profile" />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderRadius: 34,
    elevation: 12,
    height: 72,
    left: 18,
    overflow: 'visible',
    paddingBottom: 7,
    paddingTop: 7,
    position: 'absolute',
    right: 18,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  tabBarIcon: {
    height: 28,
    marginTop: 2,
    width: 32,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 14,
    marginTop: 2,
  },
  tapInIconSlot: {
    height: 88,
    marginTop: -32,
    width: 88,
  },
  tapInOffset: {
    marginTop: 0,
  },
});
