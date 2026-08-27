import React from 'react';
import {StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystTabBarBackground} from '../src/navigation/components/HoystTabBarBackground';

let mockAppearance: 'dark' | 'light' = 'dark';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: typeof mockAppearance}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

describe('HoystTabBarBackground', () => {
  it('uses an opaque themed surface with its rounded border', () => {
    (
      [
        {
          appearance: 'dark',
          backgroundColor: '#202020',
          borderColor: 'rgba(255,255,255,0.10)',
        },
        {
          appearance: 'light',
          backgroundColor: '#FAFAF7',
          borderColor: 'rgba(16,24,40,0.08)',
        },
      ] as const
    ).forEach(({appearance, backgroundColor, borderColor}) => {
      mockAppearance = appearance;
      let tree: renderer.ReactTestRenderer | undefined;

      act(() => {
        tree = renderer.create(<HoystTabBarBackground />);
      });

      const surfaceStyle = StyleSheet.flatten(
        tree!.root.findByProps({testID: 'hoyst-tab-bar-surface'}).props.style,
      );

      expect(surfaceStyle).toMatchObject({
        backgroundColor,
        borderColor,
        borderRadius: 34,
        borderWidth: 1,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      });
    });
  });

  it('renders no blur or gradient layers', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<HoystTabBarBackground />);
    });

    expect(tree!.root.findAll(node => node.props.blurAmount)).toHaveLength(0);
    expect(
      tree!.root.findAllByProps({testID: 'hoyst-tab-bar-gradient'}),
    ).toHaveLength(0);
  });
});
