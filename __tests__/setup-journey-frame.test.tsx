import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Keyboard, ScrollView, StyleSheet, TextInput, Text} from 'react-native';
import * as ReactNative from 'react-native';
import {SetupInput} from '../src/features/create-circle/components/SetupInput';
import {HoystInput} from '../src/design/components/HoystInput';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SetupJourneyFrame} from '../src/features/create-circle/components/SetupJourneyFrame';
import {HoyOrb} from '../src/design/components/HoyOrb';
import {HoystButton} from '../src/design/components/HoystButton';
import {useSettingsStore} from '../src/store/settings-store';

let mockInsets = {top: 62, bottom: 34, left: 0, right: 0};
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: React.PropsWithChildren) => children,
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('react-native-linear-gradient', () => {
  const ReactMock = require('react');
  const {View} = require('react-native');
  return (props: React.PropsWithChildren) =>
    ReactMock.createElement(View, props);
});

let tree: renderer.ReactTestRenderer;
const props = {
  title: 'Setup',
  step: 'name',
  onBack: jest.fn(),
  onLater: jest.fn(),
  primary: {label: 'Continue', onPress: jest.fn()},
};
beforeEach(() => {
  mockInsets = {top: 62, bottom: 34, left: 0, right: 0};
  useSettingsStore.setState({appearance: 'dark'});
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});
function render(children?: React.ReactNode) {
  act(() => {
    tree = renderer.create(
      <SetupJourneyFrame {...props}>{children}</SetupJourneyFrame>,
    );
  });
}
it('scales the heading and its line box together without applying native font scaling twice', () => {
  jest
    .spyOn(ReactNative, 'useWindowDimensions')
    .mockReturnValue({width: 390, height: 844, scale: 3, fontScale: 2});
  render();
  const heading = tree.root
    .findAllByType(Text)
    .find(node => node.props.accessibilityRole === 'header')!;
  expect(StyleSheet.flatten(heading.props.style)).toMatchObject({
    fontSize: 48,
    lineHeight: 58,
    flexShrink: 0,
  });
  expect(heading.props.allowFontScaling).toBe(false);
});
it('scrolls a newly focused field inside the viewport above the footer while the keyboard is open', () => {
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    callback(0);
    return 1;
  });
  const focused = {
    measureInWindow: (callback: (...args: number[]) => void) =>
      callback(0, 450, 300, 56),
  } as TextInput;
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focused);
  jest
    .spyOn(Keyboard, 'metrics')
    .mockReturnValue({height: 300, width: 390, screenX: 0, screenY: 544});
  render(<SetupInput accessibilityLabel="Test field" />);
  const instance = tree.root.findByType(ScrollView).instance;
  jest
    .spyOn(instance, 'measureInWindow')
    .mockImplementation((callback: any) => callback(0, 120, 390, 300));
  const reveal = jest
    .spyOn(instance, 'scrollTo')
    .mockImplementation(() => undefined);
  act(() =>
    tree.root
      .findByProps({testID: 'setup-frame-footer'})
      .props.onLayout({nativeEvent: {layout: {height: 80}}}),
  );
  act(() => tree.root.findByType(HoystInput).props.onFocus({nativeEvent: {}}));
  expect(reveal).toHaveBeenLastCalledWith({y: 94, animated: false});
});
function rootStyle() {
  return StyleSheet.flatten(
    tree.root.findByProps({testID: 'setup-frame-root'}).props.style,
  );
}
function footerStyle() {
  return StyleSheet.flatten(
    tree.root.findByProps({testID: 'setup-frame-footer'}).props.style,
  );
}

it.each(['light', 'dark'] as const)(
  'uses blue actions and tint in %s',
  appearance => {
    useSettingsStore.setState({appearance});
    render();
    expect(tree.root.findByType(HoystButton).props).toMatchObject({
      backgroundColor: '#086CA8',
      borderColor: '#086CA8',
      textColor: '#FFFFFF',
    });
    expect(
      tree.root.findAllByProps({testID: 'setup-top-tint'})[0].props.colors,
    ).toEqual([
      appearance === 'dark' ? '#133240' : '#E7F8FF',
      appearance === 'dark' ? '#090B1200' : '#FAFAF700',
    ]);
  },
);

it.each(['light', 'dark'] as const)(
  'uses Home’s shadow in %s mode while retaining the onboarding artwork size',
  appearance => {
    useSettingsStore.setState({appearance});
    act(() => {
      tree = renderer.create(
        <SetupJourneyFrame {...props} message="Let’s get started." />,
      );
    });
    expect(tree.root.findByType(HoyOrb).props.shadowTone).toBe(appearance);
    expect(
      tree.root.findAllByProps({testID: 'setup-hoy-orb-home-shadow'}),
    ).not.toHaveLength(0);
    const image = tree.root.findByProps({
      testID: 'setup-hoy-orb-getting_started-image',
    });
    expect(image.props.source).toEqual(
      require('../src/assets/hoy/setup-friendly-blue.png'),
    );
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      width: 58,
      height: 58,
    });
  },
);

it('measures the native screen locally and clears both system areas exactly once', () => {
  render();
  expect(tree.root.findAllByType(SafeAreaProvider)).toHaveLength(1);
  expect(rootStyle()).toMatchObject({paddingTop: 62});
  expect(rootStyle().paddingBottom).toBeUndefined();
  expect(footerStyle().paddingBottom).toBe(42);
  expect(tree.root.findByType(ScrollView).props).toMatchObject({
    automaticallyAdjustKeyboardInsets: false,
    automaticallyAdjustContentInsets: false,
    contentInsetAdjustmentBehavior: 'never',
  });
});

it('responds to landscape insets instead of caching the launch orientation', () => {
  render();
  mockInsets = {top: 0, bottom: 21, left: 62, right: 62};
  act(() => tree.update(<SetupJourneyFrame {...props} />));
  expect(rootStyle()).toMatchObject({
    paddingTop: 0,
    paddingLeft: 62,
    paddingRight: 62,
  });
  expect(footerStyle().paddingBottom).toBe(29);
});

it('uses only the footer gap above the keyboard and restores the bottom inset on dismissal', () => {
  const callbacks = new Map<string, (...args: any[]) => void>();
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    callbacks.set(event, callback);
    return {remove: jest.fn()} as unknown as ReturnType<
      typeof Keyboard.addListener
    >;
  });
  render();
  act(() =>
    callbacks.get('keyboardWillShow')?.({endCoordinates: {height: 300}}),
  );
  expect(footerStyle().paddingBottom).toBe(8);
  act(() => callbacks.get('keyboardWillHide')?.());
  expect(footerStyle().paddingBottom).toBe(42);
});

it('starts with the keyboard gap when mounting over an already visible keyboard', () => {
  jest
    .spyOn(Keyboard, 'metrics')
    .mockReturnValue({height: 300, width: 390, screenX: 0, screenY: 500});
  render();
  expect(footerStyle().paddingBottom).toBe(8);
});

it('retains the home indicator inset for a floating input toolbar with no keyboard height', () => {
  const callbacks = new Map<string, (...args: any[]) => void>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    callbacks.set(event, callback);
    return {remove: jest.fn()} as unknown as ReturnType<
      typeof Keyboard.addListener
    >;
  });
  render();
  act(() => callbacks.get('keyboardWillShow')?.({endCoordinates: {height: 0}}));
  expect(footerStyle().paddingBottom).toBe(42);
});
