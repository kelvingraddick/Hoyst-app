import React from 'react';
import {StyleSheet, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {GlassPanel} from '../src/design/components/GlassPanel';
import {glass} from '../src/design/tokens/glass';

let mockAppearance: 'dark' | 'light';

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(View, props, children);
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: typeof mockAppearance}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

function renderGlassPanel(
  props: Partial<React.ComponentProps<typeof GlassPanel>> = {},
) {
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <GlassPanel {...props}>
        <Text>Panel content</Text>
      </GlassPanel>,
    );
  });

  return tree!;
}

describe('GlassPanel', () => {
  beforeEach(() => {
    mockAppearance = 'light';
  });

  it('matches the tab bar dark-mode highlight treatment', () => {
    mockAppearance = 'dark';
    const tree = renderGlassPanel();
    const gradient = tree.root.findByProps({
      testID: 'glass-panel-highlight-gradient',
    });
    const topSheenStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'glass-panel-top-sheen'}).props.style,
    );

    expect(gradient.props.colors).toEqual(glass.darkHighlightGradientColors);
    expect(gradient.props.start).toEqual({x: 0.5, y: 0});
    expect(gradient.props.end).toEqual({x: 0.5, y: 1});
    expect(topSheenStyle).toMatchObject({
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 999,
      height: glass.darkHighlightSheenHeight,
      left: glass.darkCardHighlightSheenInset,
      right: glass.darkCardHighlightSheenInset,
      top: glass.darkHighlightSheenTop,
    });
  });

  it('widens dark top highlights to each glass variant radius start', () => {
    mockAppearance = 'dark';

    (
      [
        {inset: glass.darkCardHighlightSheenInset, variant: 'card'},
        {inset: glass.darkPanelHighlightSheenInset, variant: 'panel'},
        {inset: glass.darkNavHighlightSheenInset, variant: 'nav'},
      ] as const
    ).forEach(({inset, variant}) => {
      const tree = renderGlassPanel({variant});
      const topSheenStyle = StyleSheet.flatten(
        tree.root.findByProps({testID: 'glass-panel-top-sheen'}).props.style,
      );

      expect(topSheenStyle.left).toBe(inset);
      expect(topSheenStyle.right).toBe(inset);
    });
  });

  it('keeps the existing light-mode top highlight', () => {
    mockAppearance = 'light';
    const tree = renderGlassPanel();
    const topSheenStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'glass-panel-top-sheen'}).props.style,
    );

    expect(
      tree.root.findAllByProps({testID: 'glass-panel-highlight-gradient'}),
    ).toHaveLength(0);
    expect(topSheenStyle).toMatchObject({
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 999,
      height: glass.highlightHeight,
      left: 16,
      right: 16,
      top: 0.5,
    });
  });
});
