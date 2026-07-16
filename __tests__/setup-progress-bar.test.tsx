import React from 'react';
import {StyleSheet, View} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-linear-gradient', () => {
  const ReactRuntime = require('react');
  const {View: NativeView} = require('react-native');

  return (props: object) => ReactRuntime.createElement(NativeView, props);
});

import {
  getSetupProgress,
  SetupProgressBar,
} from '../src/design/components/SetupProgressBar';
import {gradients} from '../src/design/tokens/gradients';

describe('SetupProgressBar', () => {
  it('calculates percentages and clamps values to the available range', () => {
    expect(getSetupProgress(1, 10)).toEqual({
      current: 1,
      percent: 10,
      total: 10,
    });
    expect(getSetupProgress(14, 10)).toEqual({
      current: 10,
      percent: 100,
      total: 10,
    });
    expect(getSetupProgress(-3, 0)).toEqual({
      current: 0,
      percent: 0,
      total: 1,
    });
    expect(getSetupProgress(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      current: 0,
      percent: 0,
      total: 1,
    });
  });

  it('exposes readable progress semantics and uses the violet brand fill', () => {
    let tree: ReactTestRenderer;

    act(() => {
      tree = create(
        <SetupProgressBar current={3} testID="test-progress" total={10} />,
      );
    });

    const progress = tree!.root
      .findAllByProps({testID: 'test-progress'})
      .find(node => node.type === View)!;
    const fill = tree!.root
      .findAllByProps({testID: 'test-progress-fill'})
      .find(node => node.type === View)!;

    expect(progress.props.accessibilityRole).toBe('progressbar');
    expect(progress.props.accessible).toBe(true);
    expect(progress.props.accessibilityLabel).toBe('Step 3 of 10');
    expect(progress.props.accessibilityValue).toEqual({
      max: 10,
      min: 0,
      now: 3,
      text: 'Step 3 of 10',
    });
    expect(fill.props.colors).toEqual([...gradients.purpleButton]);
    expect(StyleSheet.flatten(fill.props.style).width).toBe('30%');
  });
});
