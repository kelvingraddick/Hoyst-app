import React from 'react';
import * as ReactNative from 'react-native';
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {
  DesignSystemProvider,
  DSButton,
  DSIconButton,
} from '../src/design/system';
import {
  ComposerAction,
  ComposerHeader,
  ComposerQuantity,
  ComposerQuietAction,
  ComposerSheet,
} from '../src/features/check-in/components/TapInComposerPresentation';
import type {CircleDetailModel} from '../src/types/models';
import {KeyboardInsetView} from '../src/design/components/KeyboardInsetView';
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

let mockSheetFrame = {x: 0, y: 0, width: 402, height: 874};
let mockSheetInsets = {top: 0, bottom: 0, left: 0, right: 0};

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => mockSheetInsets,
    useSafeAreaFrame: () => mockSheetFrame,
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (s: {appearance: string}) => unknown) =>
    selector({appearance: 'light'}),
}));
const detail = {
  commitmentType: 'build',
  targetValue: 30,
  unitLabel: 'pages',
} as CircleDetailModel;

it('updates sheet geometry and live insets without losing expansion', async () => {
  let listener!: (event: {data: {stable: boolean; index: number}}) => void;
  const navigation = {
    setOptions: jest.fn(),
    addListener: jest.fn((_name, callback) => {
      listener = callback;
      return jest.fn();
    }),
  };
  const content = () => (
    <ComposerSheet
      navigation={navigation as never}
      footer={<DSButton label="Tap In" onPress={() => {}} />}>
      <TextInput value="17" />
    </ComposerSheet>
  );
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = mount(content());
    });
    await act(async () => {
      tree.root.findByType(ScrollView).props.onContentSizeChange(402, 300);
      tree.root
        .findAllByProps({testID: 'tap-in-composer-action-footer-position'})[0]
        .props.onLayout({nativeEvent: {layout: {height: 100}}});
      listener({data: {stable: true, index: 1}});
    });
    const input = tree.root.findByType(TextInput).instance;
    for (const geometry of [
      {
        frame: {x: 0, y: 0, width: 800, height: 620},
        insets: {top: 0, bottom: 0, left: 0, right: 74},
      },
      {
        frame: {x: 0, y: 0, width: 800, height: 620},
        insets: {top: 22, bottom: 40, left: 74, right: 0},
      },
      {
        frame: {x: 0, y: 0, width: 350, height: 820},
        insets: {top: 20, bottom: 34, left: 0, right: 0},
      },
    ]) {
      mockSheetFrame = geometry.frame;
      mockSheetInsets = geometry.insets;
      await act(async () => {
        tree.update(
          <DesignSystemProvider scheme="dark">
            {content()}
          </DesignSystemProvider>,
        );
      });
      expect(
        StyleSheet.flatten(
          tree.root.findAllByProps({testID: 'tap-in-composer-sheet-frame'})[0]
            .props.style,
        ).height,
      ).toBe(
        Math.round((geometry.frame.height - geometry.insets.top - 10) * 0.92),
      );
      expect(
        StyleSheet.flatten(
          tree.root.findAllByProps({
            testID: 'tap-in-composer-action-footer-position',
          })[0].props.style,
        ).paddingBottom,
      ).toBe(Math.max(20, geometry.insets.bottom - 8));
      expect(tree.root.findByType(TextInput).instance).toBe(input);
      expect(
        navigation.setOptions.mock.calls.at(-1)?.[0].sheetInitialDetentIndex,
      ).toBe(1);
    }
  } finally {
    mockSheetFrame = {x: 0, y: 0, width: 402, height: 874};
    mockSheetInsets = {top: 0, bottom: 0, left: 0, right: 0};
    await act(async () => tree?.unmount());
  }
});

it('uses native view-local keyboard overlap rather than physical screen coordinates', async () => {
  const navigation = {
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerSheet navigation={navigation as never}>body</ComposerSheet>,
    );
  });
  for (const inset of [250, 120, 0]) {
    await act(async () => {
      tree.root
        .findByType(KeyboardInsetView)
        .props.onInsetChange({nativeEvent: {inset}});
    });
    expect(
      StyleSheet.flatten(
        tree.root.findAllByProps({testID: 'tap-in-composer-sheet-frame'})[0]
          .props.style,
      ).paddingBottom,
    ).toBe(inset);
  }
  await act(async () => tree.unmount());
});

it('fits a large quantity inside a sheet narrower than its presenting window', async () => {
  const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({width: 951, height: 669, scale: 3, fontScale: 2});
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = mount(<ComposerQuantity detail={detail} value={123456789} onDecrease={() => {}} onIncrease={() => {}} />);
    });
    await act(async () => {
      tree.root.findAll(node => node.type === ReactNative.View && typeof node.props.onLayout === 'function')[0]
        .props.onLayout({nativeEvent: {layout: {width: 240}}});
    });
    expect(tree.root.findAllByProps({testID: 'tap-in-composer-quantity-ring'})[0].props.style.width).toBeLessThanOrEqual(240);
  } finally {
    await act(async () => tree?.unmount());
    dimensions.mockRestore();
  }
});
it('uses the Circle Detail hero hierarchy and a tighter mark gap', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerHeader
        detail={{
          ...detail,
          category: 'Wellness',
          title: 'Read a little every day',
          commitment: 'Make room for a thoughtful daily routine.',
        }}
        status="Streak at risk · Start today"
        onClose={() => {}}
      />,
    );
  });
  expect(
    tree.root.findByProps({testID: 'tap-in-composer-logo'}).props.size,
  ).toBe(52);
  expect(
    tree.root.findByProps({testID: 'tap-in-composer-circle-title'}).props
      .variant,
  ).toBe('screenTitle');
  expect(
    tree.root.findByProps({testID: 'tap-in-composer-commitment'}).props.variant,
  ).toBe('body');
  expect(
    tree.root.findByProps({testID: 'tap-in-composer-category-label'}).props
      .children,
  ).toBe('WELLNESS');
  expect(
    tree.root.findByProps({testID: 'tap-in-composer-commitment-type'}).props
      .children,
  ).toBe(' · BUILD');
});
it('gives Skip a full-width 56-point target while keeping it secondary', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerQuietAction label="Use Skip (2 left)" onPress={() => {}} />,
    );
  });
  const button = tree.root.findAll(
    node => node.props.accessibilityRole === 'button',
  )[0];
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({
    minHeight: 56,
    alignSelf: 'stretch',
  });
});
function mount(children: React.ReactNode) {
  return renderer.create(
    <DesignSystemProvider scheme="dark">{children}</DesignSystemProvider>,
  );
}
it('keeps a static halo under Reduce Motion and removes it while submitting', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const loop = jest.spyOn(Animated, 'loop');
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerAction category="blue" label="Tap In" onPress={() => {}} />,
    );
  });
  expect(
    tree.root.findAll(
      node => node.props.testID === 'tap-in-composer-action-glow',
    ).length,
  ).toBeGreaterThan(0);
  expect(loop).not.toHaveBeenCalled();
  await act(async () => {
    tree.update(
      <DesignSystemProvider scheme="dark">
        <ComposerAction
          category="blue"
          label="Submitting..."
          busy
          onPress={() => {}}
        />
      </DesignSystemProvider>,
    );
  });
  expect(
    tree.root.findAll(
      node => node.props.testID === 'tap-in-composer-action-glow',
    ),
  ).toHaveLength(0);
  expect(tree.root.findByType(DSButton).props.busy).toBe(true);
  loop.mockRestore();
});
it('keeps saved Limit compliance explicit with no arc and busy steppers disabled', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerQuantity
        detail={{
          ...detail,
          commitmentType: 'limit',
          minimumValue: 2,
          maximumValue: 3,
        }}
        value={4}
        saved
        disabled
        onDecrease={() => {}}
        onIncrease={() => {}}
      />,
    );
  });
  const ring = tree.root.findAll(
    node => node.props.testID === 'tap-in-composer-quantity-ring',
  )[0];
  expect(ring.props.accessibilityLabel).toContain('Above range. Saved');
  expect(
    tree.root.findAll(
      node => node.props.testID === 'tap-in-composer-progress-arc',
    ),
  ).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(DSIconButton)
      .every(button => button.props.disabled),
  ).toBe(true);
});
it('grows the ring for large values without disabling font scaling', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerQuantity
        detail={detail}
        value={123456789}
        onDecrease={() => {}}
        onIncrease={() => {}}
      />,
    );
  });
  const ring = tree.root.findAll(
    node => node.props.testID === 'tap-in-composer-quantity-ring',
  )[0];
  expect(ring.props.style.width).toBeGreaterThan(72);
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    '"allowFontScaling":false',
  );
});

it.each(['light', 'dark'] as const)(
  'fits large editable totals on a narrow screen with large text (%s)',
  async scheme => {
    const dimensions = jest
      .spyOn(ReactNative.Dimensions, 'get')
      .mockReturnValue({width: 320, height: 568, fontScale: 2, scale: 2});
    let tree!: renderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = renderer.create(
          <DesignSystemProvider scheme={scheme}>
            <ComposerQuantity
              detail={detail}
              value={Number.MAX_SAFE_INTEGER}
              onChangeText={() => {}}
              onDecrease={() => {}}
              onIncrease={() => {}}
            />
          </DesignSystemProvider>,
        );
      });
      const ring = tree.root.findAllByProps({
        testID: 'tap-in-composer-quantity-ring',
      })[0];
      expect(ring.props.style.width).toBeLessThanOrEqual(276);
      const input = tree.root.findByType(TextInput);
      expect(input.props.value).toBe('9007199254740991');
      expect(input.props.allowFontScaling).not.toBe(false);
      expect(input.props.accessibilityLabel).toContain('pages');
      expect(input.props.accessibilityLabel).toContain("Edit today's progress");
      const pencil = tree.root.findByProps({
        testID: 'tap-in-composer-quantity-edit-icon',
      });
      expect(pencil.props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
      expect(JSON.stringify(tree.toJSON())).not.toContain('Tap number to edit');
      expect(JSON.stringify(tree.toJSON())).not.toContain('Hold + /');
      expect(
        tree.root
          .findAllByType(DSIconButton)
          .find(button => button.props.label === 'Increase quantity')!.props
          .disabled,
      ).toBe(true);
    } finally {
      await act(async () => tree?.unmount());
      dimensions.mockRestore();
    }
  },
);

it('shows an inline Done control for Android numeric entry and finishes edits on blur', async () => {
  const platform = jest.replaceProperty(ReactNative.Platform, 'OS', 'android');
  const finish = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = mount(
        <ComposerQuantity
          detail={detail}
          value={20}
          onChangeText={() => {}}
          onEndEditing={finish}
          onDecrease={() => {}}
          onIncrease={() => {}}
        />,
      );
    });
    await act(async () => tree.root.findByType(TextInput).props.onFocus());
    expect(
      tree.root.findByType(TextInput).props.inputAccessoryViewID,
    ).toBeUndefined();
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Done editing quantity'})
        .length,
    ).toBeGreaterThan(0);
    await act(async () => tree.root.findByType(TextInput).props.onBlur());
    expect(finish).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Done editing quantity'}),
    ).toHaveLength(0);
  } finally {
    await act(async () => tree?.unmount());
    platform.restore();
  }
});
it('measures body and footer separately and preserves user expansion after content changes', async () => {
  let listener!: (event: {data: {stable: boolean; index: number}}) => void;
  const navigation = {
    setOptions: jest.fn(),
    addListener: jest.fn((_name, callback) => {
      listener = callback;
      return jest.fn();
    }),
  };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerSheet
        navigation={navigation as never}
        footer={<DSButton label="Tap In" onPress={() => {}} />}>
        body
      </ComposerSheet>,
    );
  });
  await act(async () => {
    tree.root.findByType(ScrollView).props.onContentSizeChange(402, 300);
    tree.root
      .findAll(
        node => node.props.testID === 'tap-in-composer-action-footer-position',
      )[0]
      .props.onLayout({nativeEvent: {layout: {height: 100}}});
  });
  expect(navigation.setOptions).toHaveBeenCalled();
  expect(
    StyleSheet.flatten(
      tree.root.findAll(
        node => node.props.testID === 'tap-in-composer-action-footer-position',
      )[0].props.style,
    ).paddingBottom,
  ).toBe(20);
  await act(async () => {
    listener({data: {stable: true, index: 1}});
  });
  const height = () =>
    StyleSheet.flatten(
      tree.root.findAll(
        node => node.props.testID === 'tap-in-composer-sheet-frame',
      )[0].props.style,
    ).height;
  const expanded = height();
  await act(async () => {
    tree.root.findByType(ScrollView).props.onContentSizeChange(402, 500);
  });
  expect(height()).toBe(expanded);
  await act(async () => {
    tree.unmount();
  });
});

it('resets the body scroll after a local editor transition', async () => {
  const navigation = {
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  const requestFrame = jest
    .spyOn(global, 'requestAnimationFrame')
    .mockImplementation(callback => {
      callback(0);
      return 0;
    });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = mount(
      <ComposerSheet navigation={navigation as never} scrollResetKey={0}>
        body
      </ComposerSheet>,
    );
  });
  const scrollTo = jest.fn();
  (
    tree.root.findByType(ScrollView).instance as {scrollTo: jest.Mock}
  ).scrollTo = scrollTo;
  await act(async () => {
    tree.update(
      <DesignSystemProvider scheme="dark">
        <ComposerSheet navigation={navigation as never} scrollResetKey={1}>
          body
        </ComposerSheet>
      </DesignSystemProvider>,
    );
  });
  expect(scrollTo).toHaveBeenCalledWith({animated: false, y: 0});
  requestFrame.mockRestore();
});
