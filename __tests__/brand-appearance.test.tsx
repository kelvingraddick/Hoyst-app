import React from 'react';
import {Image, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {brandAssets} from '../src/design/brand/assets';
import {BrandMark} from '../src/design/components/BrandMark';
import {HoystTapInMark} from '../src/design/components/HoystTapInMark';

let mockAppearance: 'dark' | 'light' = 'light';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: typeof mockAppearance}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

function expectVisible(image: renderer.ReactTestInstance, visible: boolean) {
  expect(StyleSheet.flatten(image.parent!.props.style).opacity).toBe(
    visible ? 1 : 0,
  );
  expect(image.props.accessibilityIgnoresInvertColors).toBe(true);
}

describe('brand appearance', () => {
  beforeEach(() => {
    mockAppearance = 'light';
  });

  it.each(['logo', 'icon'] as const)(
    'keeps %s sources fixed while visibility follows dark to light to dark to light',
    kind => {
      let tree: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(<BrandMark isDark kind={kind} />);
      });
      const [light, dark] = tree!.root.findAllByType(Image);
      const blackSource =
        kind === 'logo' ? brandAssets.logoBlack : brandAssets.iconWhite;
      const whiteSource =
        kind === 'logo' ? brandAssets.logoWhite : brandAssets.iconBlack;
      expect(blackSource).not.toEqual(whiteSource);

      for (const isDark of [true, false, true, false]) {
        act(() => {
          tree.update(<BrandMark isDark={isDark} kind={kind} />);
        });
        const images = tree!.root.findAllByType(Image);
        expect(images[0]).toBe(light);
        expect(images[1]).toBe(dark);
        expect(light.props.source).toBe(blackSource);
        expect(dark.props.source).toBe(whiteSource);
        expectVisible(light, !isDark);
        expectVisible(dark, isDark);
      }
      act(() => tree.unmount());
    },
  );

  it('keeps the Tap In images fixed through saved preference hydration and theme changes', () => {
    mockAppearance = 'dark';
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<HoystTapInMark animated={false} size={78} />);
    });
    const light = tree!.root.findByProps({
      testID: 'hoyst-tap-in-mark-image-light',
    });
    const dark = tree!.root.findByProps({
      testID: 'hoyst-tap-in-mark-image-dark',
    });
    for (const appearance of ['dark', 'light', 'dark', 'light'] as const) {
      mockAppearance = appearance;
      act(() => {
        tree.update(<HoystTapInMark animated={false} size={78} />);
      });
      expect(
        tree!.root.findByProps({testID: 'hoyst-tap-in-mark-image-light'}),
      ).toBe(light);
      expect(
        tree!.root.findByProps({testID: 'hoyst-tap-in-mark-image-dark'}),
      ).toBe(dark);
      expect(light.props.source).toBe(brandAssets.iconWhite);
      expect(dark.props.source).toBe(brandAssets.iconBlack);
      const backing = tree!.root.findByProps({
        testID: 'hoyst-tap-in-mark-image-letter-backing',
      });
      expect(StyleSheet.flatten(backing.props.style).backgroundColor).toBe(
        appearance === 'light' ? '#0B0B0B' : '#FFFFFF',
      );
      expectVisible(light, appearance === 'light');
      expectVisible(dark, appearance === 'dark');
    }
    act(() => tree.unmount());
  });

  it('renders the nonadaptive ring as a single image', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<BrandMark kind="ring" isDark={false} />);
    });
    expect(tree!.root.findAllByType(Image)).toHaveLength(1);
    expect(tree!.root.findByType(Image).props.source).toBe(brandAssets.ring);
    act(() => tree.unmount());
  });
});
