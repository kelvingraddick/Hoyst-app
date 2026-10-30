import React from 'react';
import {StyleSheet, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {useLayoutWidth} from '../src/design/hooks/useLayoutWidth';
import {getTabBarLayout} from '../src/navigation/tab-bar-layout';
import {HoystBottomTabBar} from '../src/navigation/components/HoystBottomTabBar';

jest.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBar: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'native-tab-bar',
    }),
}));

it('positions navigation from the bar local insets instead of the parent stack', () => {
  let tree!: renderer.ReactTestRenderer;
  const props = {
    insets: {top: 0, left: 0, right: 74, bottom: 0},
    descriptors: {
      home: {options: {tabBarStyle: {left: 18, right: 18, height: 72}}},
    },
  };
  act(() => {
    tree = renderer.create(
      <HoystBottomTabBar
        {...(props as unknown as React.ComponentProps<
          typeof HoystBottomTabBar
        >)}
      />,
    );
  });
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({testID: 'native-tab-bar'}).props.descriptors.home
        .options.tabBarStyle,
    ),
  ).toMatchObject({left: 18, right: 92, height: 72, paddingHorizontal: 0});
  act(() => tree.unmount());
});

it('keeps bottom navigation inside each changing safe-area edge', () => {
  expect(
    getTabBarLayout({top: 0, bottom: 34, left: 0, right: 74}, true),
  ).toEqual({left: 18, right: 92, bottom: 34, paddingHorizontal: 0});
  expect(
    getTabBarLayout({top: 0, bottom: 0, left: 74, right: 0}, true),
  ).toEqual({left: 92, right: 18, bottom: 18, paddingHorizontal: 0});
  expect(
    getTabBarLayout({top: 20, bottom: 24, left: 0, right: 0}, false),
  ).toEqual({left: 18, right: 18, bottom: 24, paddingHorizontal: 0});
});

it('follows the offered container width while retaining mounted content', () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  function Content() {
    const {width, onLayout} = useLayoutWidth(350);
    React.useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return <View onLayout={onLayout} accessibilityValue={{now: width}} />;
  }
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Content />);
  });
  for (const width of [282, 780, 410, 282]) {
    act(() => {
      tree.root
        .findByType(View)
        .props.onLayout({nativeEvent: {layout: {width}}});
    });
    expect(tree.root.findByType(View).props.accessibilityValue.now).toBe(width);
  }
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
