import React from 'react';
import {ScrollView, View} from 'react-native';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/blur', () => {
  const ReactRuntime = require('react');
  const {View: NativeView} = require('react-native');

  return {
    BlurView: (props: object) =>
      ReactRuntime.createElement(NativeView, props),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const ReactRuntime = require('react');
  const {View: NativeView} = require('react-native');

  return (props: object) => ReactRuntime.createElement(NativeView, props);
});

jest.mock('react-native-safe-area-context', () => {
  const ReactRuntime = require('react');
  const {View: NativeView} = require('react-native');

  return {
    SafeAreaView: (props: object) =>
      ReactRuntime.createElement(NativeView, props),
  };
});

import {HoystButton} from '../src/design/components/HoystButton';
import {CommitmentSetupScaffold} from '../src/features/create-circle/components/CommitmentSetupScaffold';

function renderScaffold(stepKey = 'commitment') {
  const scrollTo = jest
    .spyOn(ScrollView.prototype, 'scrollTo')
    .mockImplementation(() => undefined);
  let tree: ReactTestRenderer;

  act(() => {
    tree = create(
      <CommitmentSetupScaffold
        body="Choose what counts."
        onBack={jest.fn()}
        primaryAction={{label: 'Continue', onPress: jest.fn()}}
        progress={{current: 1, total: 3}}
        stepKey={stepKey}
        title="Set the Goal and Pace">
        <View testID="setup-fields" />
      </CommitmentSetupScaffold>,
    );
  });

  return {scrollTo, tree: tree!};
}

describe('CommitmentSetupScaffold', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the primary action outside the scrolling content', () => {
    const {tree} = renderScaffold();
    const scrollView = tree.root.findByType(ScrollView);
    const progress = tree.root
      .findAllByProps({testID: 'commitment-setup-progress'})
      .find(node => node.type === View)!;
    const primaryAction = tree.root
      .findAllByType(HoystButton)
      .find(button => button.props.label === 'Continue');

    expect(primaryAction).toBeDefined();
    expect(scrollView.findAllByType(HoystButton)).toHaveLength(0);
    expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scrollView.props.keyboardDismissMode).toBe('interactive');
    expect(progress.props.accessibilityLabel).toBe('Step 1 of 3');
    expect(progress.props.accessibilityValue).toEqual({
      max: 3,
      min: 0,
      now: 1,
      text: 'Step 1 of 3',
    });
  });

  it('resets the scroll position whenever the setup step changes', () => {
    const {scrollTo, tree} = renderScaffold();
    scrollTo.mockClear();

    act(() => {
      tree.update(
        <CommitmentSetupScaffold
          body="Choose your setup."
          onBack={jest.fn()}
          primaryAction={{label: 'Continue', onPress: jest.fn()}}
          progress={{current: 2, total: 3}}
          stepKey="mode"
          title="How do you want to commit?">
          <View testID="setup-fields" />
        </CommitmentSetupScaffold>,
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({animated: false, y: 0});
  });
});
