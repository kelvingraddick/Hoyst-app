import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import renderer, {act} from 'react-test-renderer';

import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {TapInRingMark} from '../src/design/components/TapInRingMark';

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

  it('passes ring state through and advances the interaction key on press', () => {
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
    let ring = tree!.root.findByType(TapInRingMark);

    expect(ring.props.state).toBe('atRisk');
    expect(ring.props.interactionKey).toBe(0);
    expect(ring.props.isPressed).toBe(false);
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

    ring = tree!.root.findByType(TapInRingMark);

    expect(ring.props.interactionKey).toBe(1);
    expect(ring.props.isPressed).toBe(true);
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

    ring = tree!.root.findByType(TapInRingMark);
    expect(ring.props.isPressed).toBe(false);
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

    const ring = tree!.root.findByType(TapInRingMark);

    expect(pressable.props.disabled).toBe(true);
    expect(ring.props.animated).toBe(false);
    expect(ring.props.interactionKey).toBe(0);
    expect(RNHapticFeedback.trigger).not.toHaveBeenCalled();
  });
});
