import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {TapInActionButton} from '../src/design/components/TapInActionButton';
import {gradients} from '../src/design/tokens/gradients';

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(MockView, props, children);
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

describe('TapInActionButton', () => {
  it('renders the dark primary action treatment', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInActionButton
          label="Confirm Tap In"
          testID="confirm-action"
          variant="primary"
        />,
      );
    });

    const pressable = tree!.root.findByType(Pressable);
    const fill = tree!.root.findByProps({testID: 'confirm-action-fill'});
    const pressableStyle = StyleSheet.flatten(
      pressable.props.style({pressed: false}),
    );
    const fillStyle = StyleSheet.flatten(fill.props.style);

    expect(pressable.props.accessibilityState).toEqual({disabled: false});
    expect(pressableStyle).toEqual(
      expect.objectContaining({
        opacity: 1,
        shadowColor: 'rgba(15,23,42,0.22)',
      }),
    );
    expect(fillStyle).toEqual(
      expect.objectContaining({
        backgroundColor: '#15171D',
        borderColor: '#15171D',
        minHeight: 56,
      }),
    );
  });

  it('uses the warm outline palette and disables presses when unavailable', () => {
    const onPress = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInActionButton
          disabled
          label="Use Skip (1 left)"
          onPress={onPress}
          testID="skip-action"
          variant="warmOutline"
        />,
      );
    });

    const pressable = tree!.root.findByType(Pressable);
    const fill = tree!.root.findByProps({testID: 'skip-action-fill'});
    const pressableStyle = StyleSheet.flatten(
      pressable.props.style({pressed: false}),
    );
    const fillStyle = StyleSheet.flatten(fill.props.style);

    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
    expect(pressableStyle).toEqual(expect.objectContaining({opacity: 0.42}));
    expect(fillStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'rgba(255,138,61,0.08)',
        borderColor: 'rgba(255,138,61,0.42)',
      }),
    );
  });

  it('renders the white elevated surface treatment', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInActionButton
          label="Add Photo"
          testID="photo-action"
          variant="surface"
        />,
      );
    });

    const pressable = tree!.root.findByType(Pressable);
    const fill = tree!.root.findByProps({testID: 'photo-action-fill'});
    const pressableStyle = StyleSheet.flatten(
      pressable.props.style({pressed: false}),
    );
    const fillStyle = StyleSheet.flatten(fill.props.style);

    expect(pressableStyle).toEqual(
      expect.objectContaining({shadowOpacity: 0.12, shadowRadius: 14}),
    );
    expect(fillStyle).toEqual(
      expect.objectContaining({
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(16,24,40,0.12)',
      }),
    );
  });

  it('adds a reduced-motion spectrum glow without a spectrum border', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInActionButton
          emphasis="spectrumBreathing"
          label="Tap In"
          testID="tap-in-action"
          variant="primary"
        />,
      );
    });

    const halo = tree!.root.findByProps({
      testID: 'tap-in-action-spectrum-halo',
    });
    const haloGradient = tree!.root.findByProps({
      testID: 'tap-in-action-spectrum-halo-gradient',
    });
    const fill = tree!.root.findByProps({testID: 'tap-in-action-fill'});
    const label = tree!.root.findByProps({children: 'Tap In'});

    expect(
      tree!.root.findAllByProps({
        testID: 'tap-in-action-spectrum-edge',
      }),
    ).toHaveLength(0);
    expect(haloGradient.props.colors).toEqual([...gradients.spectrumGlow]);
    expect(StyleSheet.flatten(halo.props.style)).toEqual(
      expect.objectContaining({opacity: 0.34}),
    );
    expect(StyleSheet.flatten(fill.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#15171D',
        borderColor: '#15171D',
        minHeight: 56,
      }),
    );
    expect(StyleSheet.flatten(label.props.style)).toEqual(
      expect.objectContaining({fontSize: 18, lineHeight: 23}),
    );
    expect(tree!.root.findAllByType(View).length).toBeGreaterThan(0);
  });

  it('removes the spectrum halo when the action is disabled', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <TapInActionButton
          disabled
          emphasis="spectrumBreathing"
          label="Submitting..."
          testID="disabled-action"
          variant="primary"
        />,
      );
    });

    const halo = tree!.root.findByProps({
      testID: 'disabled-action-spectrum-halo',
    });

    expect(StyleSheet.flatten(halo.props.style)).toEqual(
      expect.objectContaining({opacity: 0}),
    );
  });
});
