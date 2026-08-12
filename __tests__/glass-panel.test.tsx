import React from 'react';
import {StyleSheet, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {GlassPanel} from '../src/design/components/GlassPanel';

let mockAppearance: 'dark' | 'light';

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

  it('uses the opaque cool-slate surface in dark mode', () => {
    mockAppearance = 'dark';
    const tree = renderGlassPanel();
    const surfaceStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'solid-panel-surface'}).props.style,
    );

    expect(surfaceStyle).toMatchObject({
      backgroundColor: '#222638',
      borderColor: 'rgba(255,255,255,0.10)',
      borderRadius: 24,
      borderWidth: 1,
      shadowColor: 'rgba(0,0,0,0.46)',
    });
  });

  it('keeps every panel variant opaque in both themes', () => {
    (
      [
        {
          appearance: 'dark',
          backgroundColor: '#222638',
          borderColor: 'rgba(255,255,255,0.10)',
        },
        {
          appearance: 'light',
          backgroundColor: '#FFFFFF',
          borderColor: 'rgba(16,24,40,0.08)',
        },
      ] as const
    ).forEach(({appearance, backgroundColor, borderColor}) => {
      mockAppearance = appearance;

      (
        [
          {borderRadius: 24, variant: 'card'},
          {borderRadius: 28, variant: 'panel'},
          {borderRadius: 32, variant: 'nav'},
        ] as const
      ).forEach(({borderRadius, variant}) => {
        const tree = renderGlassPanel({variant});
        const surfaceStyle = StyleSheet.flatten(
          tree.root.findByProps({testID: 'solid-panel-surface'}).props.style,
        );

        expect(surfaceStyle).toMatchObject({
          backgroundColor,
          borderColor,
          borderRadius,
        });
      });
    });
  });

  it('renders no blur, tint, or illumination layers', () => {
    const tree = renderGlassPanel();

    expect(tree.root.findAll(node => node.props.blurAmount)).toHaveLength(0);
    expect(tree.root.findAllByProps({testID: 'glass-panel-blur'})).toHaveLength(
      0,
    );
    expect(tree.root.findAllByProps({testID: 'glass-panel-tint'})).toHaveLength(
      0,
    );
    expect(
      tree.root.findAllByProps({testID: 'glass-panel-highlight-gradient'}),
    ).toHaveLength(0);
  });
});
