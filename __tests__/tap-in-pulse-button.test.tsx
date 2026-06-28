import React from 'react';
import {Image, Pressable, StyleSheet} from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import {Ellipse} from 'react-native-svg';
import renderer, {act} from 'react-test-renderer';

import {getBrandIcon} from '../src/design/brand/usage';
import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {TapInPulseButton} from '../src/design/components/TapInPulseButton';

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

describe('TapInPulseButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Hoyst mark and advances the interaction key on press', () => {
    const onPress = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInPulseButton
          label="Tap In"
          onPress={onPress}
          ringState="atRisk"
        />,
      );
    });

    const pressable = tree!.root.findByType(Pressable);
    const frame = tree!.root.findByProps({
      testID: 'tap-in-pulse-button-frame',
    });
    let mark = tree!.root.findByType(HoystTapInMark);

    expect(mark.props.size).toBe(30);
    expect(mark.props.interactionKey).toBe(0);
    expect(mark.props.isPressed).toBe(false);
    expect(
      tree!.root.findByProps({testID: 'hoyst-tap-in-mark-shadow-core'}).type,
    ).toBe(Ellipse);
    expect(StyleSheet.flatten(frame.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: 'rgba(16,24,40,0.12)',
      }),
    );
    expect(
      tree!.root.findAll(node => Array.isArray(node.props.colors)),
    ).toHaveLength(0);

    act(() => {
      pressable.props.onPressIn();
    });

    mark = tree!.root.findByType(HoystTapInMark);

    expect(mark.props.interactionKey).toBe(1);
    expect(mark.props.isPressed).toBe(true);
    expect(RNHapticFeedback.trigger).toHaveBeenCalledWith('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    act(() => {
      pressable.props.onPress({stopPropagation: jest.fn()});
    });

    expect(onPress).toHaveBeenCalled();

    act(() => {
      pressable.props.onPressOut();
    });

    mark = tree!.root.findByType(HoystTapInMark);
    expect(mark.props.isPressed).toBe(false);
  });

  it('does not trigger haptics or interaction animation while disabled', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInPulseButton disabled label="Tap In" ringState="active" />,
      );
    });

    const pressable = tree!.root.findByType(Pressable);

    act(() => {
      pressable.props.onPressIn();
    });

    const mark = tree!.root.findByType(HoystTapInMark);

    expect(pressable.props.disabled).toBe(true);
    expect(mark.props.animated).toBe(false);
    expect(mark.props.interactionKey).toBe(0);
    expect(RNHapticFeedback.trigger).not.toHaveBeenCalled();
  });

  it('renders a larger Hoyst mark for the hero variant', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInPulseButton
          label="Tap In"
          supportingText="Log your progress this week"
          variant="hero"
        />,
      );
    });

    const frame = tree!.root.findByProps({
      testID: 'tap-in-pulse-button-frame',
    });
    const markWrap = tree!.root.findByProps({
      testID: 'tap-in-pulse-button-mark-wrap',
    });
    const logo = tree!.root.findByProps({
      testID: 'tap-in-pulse-button-hero-logo',
    });
    const frameStyle = StyleSheet.flatten(frame.props.style);
    const markWrapStyle = StyleSheet.flatten(markWrap.props.style);
    const logoStyle = StyleSheet.flatten(logo.props.style);

    expect(logo.type).toBe(Image);
    expect(logo.props.source).toBe(getBrandIcon(true));
    expect(logoStyle.height).toBe(58);
    expect(logoStyle.width).toBe(58);
    expect(frameStyle.height).toBe(70);
    expect(frameStyle.borderRadius).toBe(20);
    expect(frameStyle.backgroundColor).toBe('#15171D');
    expect(markWrapStyle.transform).toEqual([{translateY: 0}]);
  });
});
