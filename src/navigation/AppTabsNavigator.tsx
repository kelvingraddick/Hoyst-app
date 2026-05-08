import React, {useEffect} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {
  Bell,
  Compass,
  Home,
  type LucideIcon,
  UserRound,
} from 'lucide-react-native';

import {ExploreScreen} from '../features/explore/screens/ExploreScreen';
import {HomeScreen} from '../features/home/screens/HomeScreen';
import {InboxScreen} from '../features/inbox/screens/InboxScreen';
import {ProfileScreen} from '../features/profile/screens/ProfileScreen';
import {TapInRingMark} from '../design/components/TapInRingMark';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {HoystTabBarBackground} from './components/HoystTabBarBackground';
import type {AppTabsParamList, RootStackParamList} from './types';
import {useOnboardingStore} from '../store/onboarding-store';
import {useSessionStore} from '../store/session-store';

const Tab = createBottomTabNavigator<AppTabsParamList>();

type StandardTabName = Exclude<keyof AppTabsParamList, 'TapIn'>;

const routeIcons: Record<StandardTabName, LucideIcon> = {
  Home,
  Explore: Compass,
  Inbox: Bell,
  Profile: UserRound,
};

function TapInPlaceholder(): React.JSX.Element {
  return <View />;
}

export function AppTabsNavigator(): React.JSX.Element {
  const theme = useHoystTheme();
  const status = useSessionStore(state => state.status);
  const beginAuthFlow = useSessionStore(state => state.beginAuthFlow);
  const consumePendingAction = useSessionStore(state => state.consumePendingAction);
  const startForProtectedAction = useOnboardingStore(
    state => state.startForProtectedAction,
  );
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (status !== 'authenticatedReady') {
      return;
    }

    const pendingAction = consumePendingAction();

    if (!pendingAction) {
      return;
    }

    if (pendingAction.type === 'createCircle') {
      rootNavigation.navigate('CreateCircle');
    } else if (pendingAction.type === 'joinCircle') {
      rootNavigation.navigate('CircleDetail', {
        circleId: pendingAction.circleId,
        resumeAction: 'join',
      });
    } else if (pendingAction.type === 'tapIn') {
      rootNavigation.navigate('TapInComposer', {
        circleId: pendingAction.circleId,
        source: pendingAction.source,
      });
    } else if (pendingAction.type === 'tapInPicker') {
      rootNavigation.navigate('TapInPicker');
    } else if (pendingAction.type === 'settings') {
      rootNavigation.navigate('Settings');
    }
  }, [consumePendingAction, rootNavigation, status]);

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
        tabBarIconStyle: styles.tabBarIcon,
        tabBarInactiveTintColor: theme.textSubtle,
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
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
        tabBarIcon: ({color, focused, size}) => {
          if (route.name === 'TapIn') {
            return <TapInRingMark style={styles.tapInOffset} />;
          }

          const Icon = routeIcons[route.name as StandardTabName];
          return (
            <View
              style={[
                styles.iconWrap,
                focused
                  ? [
                      styles.iconWrapFocused,
                      {
                        backgroundColor: theme.tabActiveBackground,
                        shadowColor: theme.tabActiveShadowColor,
                        shadowOpacity: theme.tabActiveShadowOpacity,
                      },
                    ]
                  : undefined,
              ]}>
              <Icon color={color} size={size} strokeWidth={2.25} />
            </View>
          );
        },
      })}>
      <Tab.Screen component={HomeScreen} name="Home" />
      <Tab.Screen component={ExploreScreen} name="Explore" />
      <Tab.Screen
        component={TapInPlaceholder}
        listeners={({navigation}) => ({
          tabPress: event => {
            event.preventDefault();

            const parentNavigation =
              navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

            if (status === 'authenticatedReady') {
              parentNavigation?.navigate('TapInPicker');
              return;
            }

            beginAuthFlow({type: 'tapInPicker'});
            startForProtectedAction();
            parentNavigation?.navigate('Auth', {screen: 'Welcome'});
          },
        })}
        name="TapIn"
        options={{tabBarAccessibilityLabel: 'Tap In'}}
      />
      <Tab.Screen component={InboxScreen} name="Inbox" />
      <Tab.Screen component={ProfileScreen} name="Profile" />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    elevation: 0,
    height: 66,
    left: 18,
    paddingBottom: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 18,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarIcon: {
    height: 38,
    width: 38,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconWrapFocused: {
    elevation: 8,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowRadius: 12,
  },
  tapInOffset: {
    marginTop: -24,
  },
});
