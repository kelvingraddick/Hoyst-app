import React from 'react';
import {DevSettings, Image, Modal, Pressable, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {DesignSystemProvider} from '../src/design/system/theme';
import {
  DSAvatar,
  DSButton,
  DSInput,
  DSListRow,
  DSText,
} from '../src/design/system/primitives';
import {DSCommitmentPreview} from '../src/design/system/recipes';
import {DesignSystemGallery} from '../src/design/system/DesignSystemGallery';
import {DesignSystemDevHost} from '../src/design/system/DesignSystemDevHost';
import {getSystemTheme, minimumTarget} from '../src/design/system/tokens';
import {getCommitmentCardColors} from '../src/design/components/CommitmentCardSurface';
import {palettes, type PaletteId} from '../src/shared/commitment-appearance';

jest.mock('react-native-linear-gradient', () => {
  const {View} = require('react-native');
  return View;
});

jest.mock('react-native-safe-area-context', () => {
  const {View: MockView} = require('react-native');
  return {
    SafeAreaView: MockView,
    SafeAreaProvider: MockView,
    initialWindowMetrics: null,
  };
});
jest.mock('react-native/Libraries/Utilities/DevSettings', () => ({
  addMenuItem: jest.fn(),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

const trees: renderer.ReactTestRenderer[] = [];
function render(content: React.ReactNode) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <DesignSystemProvider scheme="light">{content}</DesignSystemProvider>,
    );
  });
  trees.push(tree);
  return tree;
}
function button(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAllByType(Pressable)
    .find(node => node.props.accessibilityLabel === label)!;
}
afterEach(() => {
  act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
});

it('keeps direct actions separate from row and chevron navigation', () => {
  const open = jest.fn();
  const submit = jest.fn();
  const tree = render(
    <DSListRow
      title="Reading"
      onPress={open}
      testID="row"
      action={<DSButton label="Tap In" onPress={submit} />}
    />,
  );
  act(() => button(tree, 'Tap In').props.onPress());
  expect(submit).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  act(() => button(tree, 'Reading').props.onPress());
  act(() => button(tree, 'Open Reading').props.onPress());
  expect(open).toHaveBeenCalledTimes(2);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(button(tree, 'Reading').findAllByType(DSButton)).toHaveLength(0);
});

it('blocks repeat interaction and exposes busy/disabled state', () => {
  const tree = render(<DSButton label="Save" busy onPress={jest.fn()} />);
  expect(button(tree, 'Save').props.disabled).toBe(true);
  expect(button(tree, 'Save').props.accessibilityState).toMatchObject({
    busy: true,
    disabled: true,
  });
  expect(minimumTarget('ios')).toBe(44);
  expect(minimumTarget('android')).toBe(48);
});

it.each(['Tapped in today', 'Pending approval'])(
  'keeps %s cards expanded without adding an action',
  status => {
    const onDetails = jest.fn();
    const tree = render(
      <DSCommitmentPreview
        title="Reading"
        category="Deep Work"
        description="Read one chapter."
        context="Personal commitment"
        status={status}
        onDetails={onDetails}
      />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Read one chapter.');
    expect(tree.root.findAllByType(DSButton)).toHaveLength(0);
    expect(
      tree.root.findAll(
        node => node.props.accessibilityState?.expanded === false,
      ),
    ).toHaveLength(0);
    act(() => button(tree, 'View details for Reading').props.onPress());
    expect(onDetails).toHaveBeenCalledTimes(1);
  },
);

it('keeps detail navigation independent of the card action', () => {
  const onDetails = jest.fn();
  const onAction = jest.fn();
  const tree = render(
    <DSCommitmentPreview
      category="Fitness"
      context="2/4 members tapped in"
      description="Move for 30 minutes."
      onDetails={onDetails}
      status="Needs your Tap In"
      title="Movement"
      action={{label: 'Tap In', onPress: onAction}}
    />,
  );
  act(() => button(tree, 'Tap In for Movement').props.onPress());
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onDetails).not.toHaveBeenCalled();
  act(() => button(tree, 'View details for Movement').props.onPress());
  expect(onDetails).toHaveBeenCalledTimes(1);
  expect(onAction).toHaveBeenCalledTimes(1);
});

it('exposes input errors without losing its label or native callbacks', () => {
  const onChangeText = jest.fn();
  const onFocus = jest.fn();
  const tree = render(
    <DSInput
      label="Name"
      error="Enter a name"
      value=""
      onChangeText={onChangeText}
      onFocus={onFocus}
    />,
  );
  const input = tree.root.findByType(TextInput);
  expect(input.props.accessibilityLabel).toBe('Name');
  expect(input.props.accessibilityHint).toContain('Enter a name');
  act(() => {
    input.props.onChangeText('Reading');
    input.props.onFocus({});
  });
  expect(onChangeText).toHaveBeenCalledWith('Reading');
  expect(onFocus).toHaveBeenCalledTimes(1);
});

it('falls back for failed avatars and retries a changed source', () => {
  const source = {uri: 'https://example.invalid/avatar.png'};
  const tree = render(<DSAvatar source={source} name="Alex" />);
  act(() => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(tree.root.findByType(DSText).props.children).toBe('A');
  act(() =>
    tree.update(
      <DesignSystemProvider scheme="light">
        <DSAvatar
          source={{uri: 'https://example.invalid/new.png'}}
          name="Alex"
        />
      </DesignSystemProvider>,
    ),
  );
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
});

it('switches gallery themes locally and resolves a fixture retry', () => {
  const tree = render(<DesignSystemGallery />);
  act(() => button(tree, 'Show dark').props.onPress());
  expect(button(tree, 'Show light')).toBeDefined();
  act(() => button(tree, 'States').props.onPress());
  act(() => button(tree, 'Retry').props.onPress());
  expect(button(tree, 'Retry')).toBeUndefined();
  expect(
    tree.root
      .findAllByType(DSText)
      .some(node => node.props.children === 'Example loaded'),
  ).toBe(true);
});

it('opens and dismisses the developer gallery without registering a route', () => {
  const menu = jest.spyOn(DevSettings, 'addMenuItem');
  try {
    const tree = render(<DesignSystemDevHost />);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(menu).toHaveBeenCalledWith(
      'Hoyst Design System',
      expect.any(Function),
    );
    act(() =>
      menu.mock.calls.find(([title]) => title === 'Hoyst Design System')![1](),
    );
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  } finally {
    menu.mockRestore();
  }
});

it('does not register the gallery outside development', () => {
  const runtime = global as unknown as {__DEV__: boolean};
  const original = runtime.__DEV__;
  const menu = jest.spyOn(DevSettings, 'addMenuItem');
  try {
    runtime.__DEV__ = false;
    const tree = render(<DesignSystemDevHost />);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(menu).not.toHaveBeenCalled();
  } finally {
    runtime.__DEV__ = original;
    menu.mockRestore();
  }
});

function contrast(a: string, b: string, background = '#121212') {
  const composite = (hex: string) => {
    if (hex.length !== 9) return hex;
    const alpha = parseInt(hex.slice(7, 9), 16) / 255;
    return (
      '#' +
      [1, 3, 5]
        .map(offset =>
          Math.round(
            parseInt(hex.slice(offset, offset + 2), 16) * alpha +
              parseInt(background.slice(offset, offset + 2), 16) * (1 - alpha),
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  a = composite(a);
  b = composite(b);
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map(value =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
it.each(['light', 'dark'] as const)(
  'keeps commitment text readable across every %s category tint',
  scheme => {
    for (const palette of Object.keys(palettes) as PaletteId[]) {
      const colors = getCommitmentCardColors(
        'Custom',
        {palette},
        scheme === 'dark',
      );
      for (const background of [colors.surface, colors.tint]) {
        for (const foreground of [colors.text, colors.muted, colors.category]) {
          expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  },
);
it.each(['light', 'dark'] as const)(
  'keeps small text and category pairs readable in %s',
  scheme => {
    const theme = getSystemTheme(scheme);
    for (const foreground of [
      theme.text,
      theme.muted,
      theme.action,
      theme.progress,
      theme.success,
      theme.warning,
      theme.danger,
    ]) {
      for (const surface of [theme.canvas, theme.surface, theme.mutedSurface]) {
        expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const category of Object.values(theme.category)) {
      expect(
        contrast(category.foreground, category.surface, theme.canvas),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          category.foreground,
          theme.isDark ? theme.canvas : theme.onAction,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(theme.onAction, theme.actionFill)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(theme.inputBorder, theme.surface)).toBeGreaterThanOrEqual(
      3,
    );
  },
);
