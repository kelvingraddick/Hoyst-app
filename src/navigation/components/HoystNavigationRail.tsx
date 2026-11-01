import React, {useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {CommonActions} from '@react-navigation/native';
import {ChevronDown, ChevronUp} from 'lucide-react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useHoystTheme} from '../../design/theme/useHoystTheme';
import {getAppTabBarColors} from '../tab-bar-colors';
import type {NavigationLayout} from '../navigation-layout';

export function HoystNavigationRail({
  layout,
  ...props
}: BottomTabBarProps & {layout: NavigationLayout}) {
  const theme = useHoystTheme();
  const colors = getAppTabBarColors(theme);
  const {fontScale} = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const [atEnd, setAtEnd] = useState(false);
  const focusedOptions =
    props.descriptors[props.state.routes[props.state.index].key].options;
  if (
    !layout.rail ||
    ((layout.keyboardInset ?? 0) > 0 && focusedOptions.tabBarHideOnKeyboard)
  ) {
    return null;
  }
  const {x, width, height} = layout.rail;
  const overflows = contentHeight > height;
  const ScrollIcon = atEnd ? ChevronUp : ChevronDown;
  return (
    <View
      testID="hoyst-navigation-rail"
      style={[
        styles.rail,
        {
          left: x,
          bottom: layout.contentInsets.bottom + 16,
          width,
          height: Math.min(height, contentHeight || height),
          backgroundColor: theme.tabBarSurface,
          borderColor: theme.border,
        },
      ]}>
      <ScrollView
        ref={scroll}
        testID="navigation-rail-scroll"
        bounces={false}
        style={styles.scroll}
        onContentSizeChange={(_width, nextHeight) =>
          setContentHeight(nextHeight)
        }
        onScroll={({nativeEvent}) =>
          setAtEnd(
            nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height >=
              nativeEvent.contentSize.height - 1,
          )
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={overflows}
        contentContainerStyle={styles.content}>
        {props.state.routes.map((route, index) => {
          const options = props.descriptors[route.key].options;
          const focused = props.state.index === index;
          const isAction = route.name === 'TapIn';
          const selected = focused && !isAction;
          const label = isAction ? 'Tap In' : options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              testID={`navigation-rail-${route.name}`}
              accessibilityRole={isAction ? 'button' : 'tab'}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={{selected}}
              onPress={() => {
                const event = props.navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  props.navigation.dispatch({
                    ...CommonActions.navigate(route.name, route.params),
                    target: props.state.key,
                  });
                }
              }}
              onLongPress={() =>
                props.navigation.emit({type: 'tabLongPress', target: route.key})
              }
              style={styles.item}>
              {options.tabBarIcon?.({
                focused: selected,
                color: selected ? colors.activeIcon : colors.inactiveIcon,
                size: isAction ? 56 : 28,
              })}
              {!isAction ? (
                <Text
                  key={`${route.key}-${fontScale}`}
                  style={[
                    styles.label,
                    {color: selected ? colors.activeIcon : colors.label},
                  ]}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {overflows ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            atEnd
              ? 'Show first navigation destinations'
              : 'Show remaining navigation destinations'
          }
          testID="navigation-rail-scroll-more"
          style={styles.scrollControl}
          onPress={() =>
            atEnd
              ? scroll.current?.scrollTo({y: 0, animated: true})
              : scroll.current?.scrollToEnd({animated: true})
          }>
          <ScrollIcon size={22} color={colors.label} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  scrollControl: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 34,
    overflow: 'hidden',
    elevation: 12,
  },
  content: {paddingVertical: 12, gap: 10},
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 4,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
});
