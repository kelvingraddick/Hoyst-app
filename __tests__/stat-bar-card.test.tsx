import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {StatBarCard} from '../src/design/components/StatBarCard';

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

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

describe('StatBarCard', () => {
  it('renders metric subtitles with the inactive weekday label gray', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <StatBarCard
          accessibilityLabel="Momentum 29%, Building."
          barColor="#F97316"
          chipColor="#FFF3DF"
          label="Momentum"
          progress={0.29}
          trackColor="rgba(249,115,22,0.2)"
          value="Building">
          <View />
        </StatBarCard>,
      );
    });

    const labelText = tree!.root
      .findAllByType(Text)
      .find(node => node.props.children === 'Momentum');

    expect(StyleSheet.flatten(labelText?.props.style).color).toBe('#9A9ABC');
  });
});
