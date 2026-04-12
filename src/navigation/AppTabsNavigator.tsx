import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Compass,
  Home,
  type LucideIcon,
  UserRound,
  UsersRound,
} from 'lucide-react-native';

import {CirclesScreen} from '../features/circles/screens/CirclesScreen';
import {ExploreScreen} from '../features/explore/screens/ExploreScreen';
import {HomeScreen} from '../features/home/screens/HomeScreen';
import {ProfileScreen} from '../features/profile/screens/ProfileScreen';
import {TapInRingMark} from '../design/components/TapInRingMark';
import {useHoystTheme} from '../design/theme/useHoystTheme';
import {HoystTabBarBackground} from './components/HoystTabBarBackground';
import type {AppTabsParamList, RootStackParamList} from './types';

const Tab = createBottomTabNavigator<AppTabsParamList>();

type StandardTabName = Exclude<keyof AppTabsParamList, 'TapIn'>;

const routeIcons: Record<StandardTabName, LucideIcon> = {
  Home,
  Circles: UsersRound,
  Explore: Compass,
  Profile: UserRound,
};

function TapInPlaceholder(): React.JSX.Element {
  return <View />;
}

export function AppTabsNavigator(): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: '#FFFFFF',
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
                focused ? styles.iconWrapFocused : undefined,
              ]}>
              <Icon color={color} size={size} strokeWidth={2.25} />
            </View>
          );
        },
      })}>
      <Tab.Screen component={HomeScreen} name="Home" />
      <Tab.Screen component={CirclesScreen} name="Circles" />
      <Tab.Screen
        component={TapInPlaceholder}
        listeners={({navigation}) => ({
          tabPress: event => {
            event.preventDefault();

            const rootNavigation =
              navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

            rootNavigation?.navigate('TapInPicker');
          },
        })}
        name="TapIn"
        options={{tabBarAccessibilityLabel: 'Tap In'}}
      />
      <Tab.Screen component={ExploreScreen} name="Explore" />
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    elevation: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.62,
    shadowRadius: 12,
  },
  tapInOffset: {
    marginTop: -24,
  },
});
