import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Image, Platform, Pressable, StyleSheet, View} from 'react-native';
import {Mail, Phone} from 'lucide-react-native';
import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {brandColors} from '../src/design/tokens/colors';
import {SetupAuthForm} from '../src/features/auth/components/SetupAuthForm';
import {signInWithGoogle} from '../src/features/auth/services/auth-service';
import {useSettingsStore} from '../src/store/settings-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-linear-gradient', () => {
  const ReactMock = require('react');
  return ({children, ...props}: React.PropsWithChildren) =>
    ReactMock.createElement(require('react-native').View, props, children);
});
jest.mock('../src/features/auth/services/auth-service', () => ({
  confirmPhoneSignIn: jest.fn(),
  registerWithEmail: jest.fn(),
  sendPasswordReset: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
  startPhoneSignIn: jest.fn(),
}));

let tree: renderer.ReactTestRenderer;
const originalPlatform = Platform.OS;
const onState = jest.fn();
const actionRef: React.MutableRefObject<(() => void) | undefined> = {
  current: undefined,
};
const backRef: React.MutableRefObject<(() => boolean) | undefined> = {
  current: undefined,
};
function render(creating: boolean) {
  act(() => {
    tree = renderer.create(
      <SetupAuthForm
        creating={creating}
        actionRef={actionRef}
        backRef={backRef}
        onState={onState}
      />,
    );
  });
}
function button(label: string) {
  return tree.root
    .findAllByType(HoystButton)
    .find(node => node.props.label === label)!;
}
beforeEach(() => {
  jest.clearAllMocks();
  actionRef.current = undefined;
  backRef.current = undefined;
});
afterEach(() => {
  act(() => tree?.unmount());
  Platform.OS = originalPlatform;
});

describe.each(['ios', 'android'] as const)('%s account buttons', platform => {
  it.each([
    [true, 'light'],
    [true, 'dark'],
    [false, 'light'],
    [false, 'dark'],
  ] as const)(
    'uses provider colors with creating=%s in %s mode',
    (creating, appearance) => {
      Platform.OS = platform;
      useSettingsStore.setState({appearance});
      render(creating);
      const google = button('Continue with Google');
      expect(google.props).toMatchObject({
        backgroundColor: brandColors.white,
        textColor: brandColors.charcoal,
        borderColor: brandColors.gray,
      });
      expect(StyleSheet.flatten(google.findByType(Image).props.style)).toEqual({
        width: 20,
        height: 20,
      });
      const border = google
        .parent!.findAllByType(View)
        .find(node => node.props.pointerEvents === 'none')!;
      expect(StyleSheet.flatten(border.props.style)).toMatchObject({
        borderWidth: 1,
        borderColor: brandColors.gray,
        position: 'absolute',
      });
      for (const [label, Icon] of [
        ['Continue with email', Mail],
        ['Continue with phone', Phone],
      ] as const) {
        const provider = button(label);
        expect(provider.props).toMatchObject({
          backgroundColor: '#086CA8',
          borderColor: '#086CA8',
          textColor: brandColors.white,
        });
        expect(provider.findByType(Icon).props).toMatchObject({
          color: brandColors.white,
          size: 20,
        });
      }
      if (platform === 'ios') {
        expect(button('Continue with Apple').props).toMatchObject({
          backgroundColor: '#070B1A',
          textColor: '#FFFFFF',
        });
      } else {
        expect(tree.root.findAllByType(HoystButton)).toHaveLength(3);
      }
    },
  );

  it.each([true, false])(
    'locks provider controls while busy with creating=%s',
    async creating => {
      Platform.OS = platform;
      let finish!: () => void;
      (signInWithGoogle as jest.Mock).mockReturnValue(
        new Promise<void>(resolve => {
          finish = resolve;
        }),
      );
      render(creating);
      await act(async () => button('Continue with Google').props.onPress());
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
      for (const provider of tree.root.findAllByType(HoystButton)) {
        expect(provider.props.disabled).toBe(true);
        expect(provider.findByType(Pressable).props.onPress).toBeUndefined();
      }
      expect(backRef.current?.()).toBe(true);
      await act(async () => finish());
      expect(button('Continue with Google').props.disabled).toBe(false);
    },
  );
});

it.each([true, false])(
  'retains email and phone selection and Back with creating=%s',
  async creating => {
    render(creating);
    await act(async () => button('Continue with email').props.onPress());
    expect(
      tree.root
        .findAllByType(HoystInput)
        .map(node => node.props.accessibilityLabel),
    ).toEqual(['Email', 'Password']);
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      method: 'email',
      busy: false,
    });
    act(() => {
      expect(backRef.current?.()).toBe(true);
    });
    await act(async () => button('Continue with phone').props.onPress());
    expect(
      tree.root
        .findAllByType(HoystInput)
        .some(node => node.props.accessibilityLabel === 'Phone number'),
    ).toBe(true);
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      method: 'phone',
      busy: false,
    });
    expect(signInWithGoogle).not.toHaveBeenCalled();
  },
);
