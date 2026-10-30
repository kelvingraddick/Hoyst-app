import React from 'react';
import {Platform} from 'react-native';
import {
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {getTabBarLayout} from '../tab-bar-layout';

/** Use the bar's own live insets, which can differ from the presenting stack. */
export function HoystBottomTabBar(props: BottomTabBarProps) {
  const descriptors = Object.fromEntries(
    Object.entries(props.descriptors).map(([key, descriptor]) => [
      key,
      {
        ...descriptor,
        options: {
          ...descriptor.options,
          tabBarStyle: [
            descriptor.options.tabBarStyle,
            getTabBarLayout(props.insets, Platform.OS === 'ios'),
          ],
        },
      },
    ]),
  );
  return <BottomTabBar {...props} descriptors={descriptors} />;
}
