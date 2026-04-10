import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Compass,
  Home,
  Inbox,
  type LucideIcon,
  UserRound,
  UsersRound,
} from 'lucide-react-native';

import {CirclesScreen} from '../features/circles/screens/CirclesScreen';
import {ExploreScreen} from '../features/explore/screens/ExploreScreen';
import {HomeScreen} from '../features/home/screens/HomeScreen';
import {InboxScreen} from '../features/inbox/screens/InboxScreen';
import {ProfileScreen} from '../features/profile/screens/ProfileScreen';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {HoystTabBarBackground} from './components/HoystTabBarBackground';
import type {AppTabsParamList} from './types';

const Tab = createBottomTabNavigator<AppTabsParamList>();

const routeIcons: Record<keyof AppTabsParamList, LucideIcon> = {
  Home,
  Circles: UsersRound,
  Explore: Compass,
  Inbox,
  Profile: UserRound,
};

export function AppTabsNavigator(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: theme.success,
        tabBarBackground: HoystTabBarBackground,
        tabBarHideOnKeyboard: true,
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
          const Icon = routeIcons[route.name];
          return (
            <View
              style={[
                styles.iconWrap,
                focused
                  ? route.name === 'Explore'
                    ? styles.iconWrapExploreFocused
                    : styles.iconWrapFocused
                  : undefined,
              ]}>
              <Icon color={color} size={size} strokeWidth={2.25} />
            </View>
          );
        },
      })}>
      <Tab.Screen component={HomeScreen} name="Home" />
      <Tab.Screen component={CirclesScreen} name="Circles" />
      <Tab.Screen component={ExploreScreen} name="Explore" />
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
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconWrapFocused: {
    backgroundColor: 'rgba(68,216,92,0.14)',
  },
  iconWrapExploreFocused: {
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
});
