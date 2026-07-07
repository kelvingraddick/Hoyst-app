import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {TapInActionButton} from '../src/design/components/TapInActionButton';

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
});
