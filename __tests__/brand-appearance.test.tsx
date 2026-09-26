import React from 'react';
import {Image} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {getBrandIcon, getBrandLogo} from '../src/design/brand/usage';
import {BrandMark} from '../src/design/components/BrandMark';
import {HoystTapInMark} from '../src/design/components/HoystTapInMark';

let mockAppearance: 'dark' | 'light' = 'light';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: typeof mockAppearance}) => unknown,
  ) => selector({appearance: mockAppearance}),
}));

describe('brand appearance', () => {
  beforeEach(() => {
    mockAppearance = 'light';
  });

  it('remounts the wordmark with the correct source when appearance changes', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<BrandMark isDark={false} kind="logo" />);
    });

    const lightLogo = tree!.root.findByType(Image);
    expect(lightLogo.props.source).toBe(getBrandLogo(false));
    expect(lightLogo.props.accessibilityIgnoresInvertColors).toBe(true);

    act(() => {
      tree.update(<BrandMark isDark kind="logo" />);
    });

    const darkLogo = tree!.root.findByType(Image);
    expect(darkLogo.props.source).toBe(getBrandLogo(true));
    expect(darkLogo).not.toBe(lightLogo);

    act(() => {
      tree.update(<BrandMark isDark={false} kind="logo" />);
    });
    expect(tree!.root.findByType(Image).props.source).toBe(getBrandLogo(false));
  });

  it('remounts the center Tap In mark when the app appearance changes', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<HoystTapInMark animated={false} size={78} />);
    });

    const lightIcon = tree!.root.findByProps({
      testID: 'hoyst-tap-in-mark-image',
    });
    expect(lightIcon.props.source).toBe(getBrandIcon(false));
    expect(lightIcon.props.accessibilityIgnoresInvertColors).toBe(true);

    mockAppearance = 'dark';
    act(() => {
      tree.update(<HoystTapInMark animated={false} size={78} />);
    });

    const darkIcon = tree!.root.findByProps({
      testID: 'hoyst-tap-in-mark-image',
    });
    expect(darkIcon.props.source).toBe(getBrandIcon(true));
    expect(darkIcon).not.toBe(lightIcon);

    mockAppearance = 'light';
    act(() => {
      tree.update(<HoystTapInMark animated={false} size={78} />);
    });
    expect(
      tree!.root.findByProps({testID: 'hoyst-tap-in-mark-image'}).props.source,
    ).toBe(getBrandIcon(false));
  });
});
