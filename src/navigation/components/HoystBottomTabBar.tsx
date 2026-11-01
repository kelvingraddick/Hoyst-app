import React from 'react';
import {Platform} from 'react-native';
import {
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {getTabBarLayout} from '../tab-bar-layout';
import {useNavigationLayout} from '../NavigationLayoutContext';
import {HoystNavigationRail} from './HoystNavigationRail';

// React Navigation invokes its tabBar prop as a function. Keep hooks in the
// mounted component rather than in that callback.
export function renderHoystTabBar(props: BottomTabBarProps) {
  return <HoystBottomTabBar {...props} />;
}

/** Use the bar's own live insets, which can differ from the presenting stack. */
export function HoystBottomTabBar(props: BottomTabBarProps) {
  const layout = useNavigationLayout();
  if (layout?.mode === 'rail') {
    return <HoystNavigationRail {...props} layout={layout} />;
  }
  const usesNativeKeyboard = layout?.keyboardInset !== undefined;
  if (
    usesNativeKeyboard &&
    (layout.keyboardInset ?? 0) > 0 &&
    props.descriptors[props.state.routes[props.state.index].key].options
      .tabBarHideOnKeyboard
  ) {
    return null;
  }
  const descriptors = Object.fromEntries(
    Object.entries(props.descriptors).map(([key, descriptor]) => [
      key,
      {
        ...descriptor,
        options: {
          ...descriptor.options,
          // Screen-coordinate keyboard events can stay "shown" across a fold.
          // The host's keyboardLayoutGuide supplies the actual local overlap.
          tabBarHideOnKeyboard: usesNativeKeyboard
            ? false
            : descriptor.options.tabBarHideOnKeyboard,
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
