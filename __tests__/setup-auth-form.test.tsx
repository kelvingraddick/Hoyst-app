import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Mail, Phone} from 'lucide-react-native';
import {HoystButton} from '../src/design/components/HoystButton';
import {HoystInput} from '../src/design/components/HoystInput';
import {brandColors} from '../src/design/tokens/colors';
import {SetupAuthForm} from '../src/features/auth/components/SetupAuthForm';
import {SignInScreen} from '../src/features/auth/screens/SignInScreen';
import {
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '../src/features/auth/services/auth-service';
import {useSessionStore} from '../src/store/session-store';
import {useSettingsStore} from '../src/store/settings-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-linear-gradient', () => {
  const ReactMock = require('react');
  return ({children, ...props}: React.PropsWithChildren) =>
    ReactMock.createElement(require('react-native').View, props, children);
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: React.PropsWithChildren) => children,
  useSafeAreaInsets: () => ({top: 62, bottom: 34, left: 0, right: 0}),
}));
jest.mock('../src/features/legal/policy-service', () => ({
  acceptLegalTerms: jest.fn().mockResolvedValue({accepted: true}),
}));

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
  jest.spyOn(Dimensions, 'get').mockReturnValue({
    width: 390,
    height: 844,
    scale: 3,
    fontScale: 1,
  });
  actionRef.current = undefined;
  backRef.current = undefined;
});
afterEach(() => {
  act(() => tree?.unmount());
  Platform.OS = originalPlatform;
  jest.restoreAllMocks();
});

it('updates email links and their line boxes when text size grows and returns to normal', () => {
  render(false);
  act(() => button('Continue with email').props.onPress());
  for (const fontScale of [3.1, 1]) {
    const metrics = {width: 390, height: 844, scale: 3, fontScale};
    jest.mocked(Dimensions.get).mockReturnValue(metrics);
    act(() => Dimensions.set({window: metrics, screen: metrics}));
    const link = tree.root
      .findAllByType(Text)
      .find(node => node.props.children === 'Forgot password?')!;
    expect(link.props.allowFontScaling).toBe(false);
    expect(StyleSheet.flatten(link.props.style)).toMatchObject({
      fontSize: 16 * fontScale,
      lineHeight: 22 * fontScale,
    });
  }
});

it('preserves the email but clears the previous password when returning from a successful reset request', async () => {
  (sendPasswordReset as jest.Mock).mockResolvedValueOnce(undefined);
  render(false);
  act(() => button('Continue with email').props.onPress());
  act(() => {
    const inputs = tree.root.findAllByType(HoystInput);
    inputs
      .find(input => input.props.accessibilityLabel === 'Email')!
      .props.onChangeText('qa@example.com');
    inputs
      .find(input => input.props.accessibilityLabel === 'Password')!
      .props.onChangeText('previous-attempt');
  });
  const forgot = tree.root
    .findAllByType(Pressable)
    .find(
      node => node.findAllByProps({children: 'Forgot password?'}).length > 0,
    )!;
  act(() => forgot.props.onPress());
  await act(async () => actionRef.current?.());
  expect(sendPasswordReset).toHaveBeenCalledTimes(1);
  expect(sendPasswordReset).toHaveBeenCalledWith('qa@example.com');
  expect(onState.mock.lastCall?.[0].label).toBe('Back to sign in');
  act(() => actionRef.current?.());
  expect(
    tree.root.findAllByType(HoystInput).map(input => input.props.value),
  ).toEqual(['qa@example.com', '']);
  expect(onState.mock.lastCall?.[0]).toMatchObject({
    label: 'Sign in',
    disabled: true,
  });
});

it.each(['1000', 1000])(
  'explains an unfinished Apple sign-in without exposing native error %s',
  async code => {
    Platform.OS = 'ios';
    (signInWithApple as jest.Mock).mockRejectedValueOnce({
      code,
      message:
        'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)',
    });
    render(false);
    await act(async () => button('Continue with Apple').props.onPress());
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      busy: false,
      error:
        'Apple sign-in couldn’t finish. If prompted, sign in to your Apple Account in iPhone Settings, then try again.',
    });
    expect(button('Continue with Apple').props.disabled).toBe(false);
  },
);

it('keeps Apple-specific recovery wording out of other providers', async () => {
  (signInWithGoogle as jest.Mock).mockRejectedValueOnce({
    code: '1000',
    message: 'Google sign-in unavailable.',
  });
  render(false);
  await act(async () => button('Continue with Google').props.onPress());
  expect(onState.mock.lastCall?.[0].error).toBe('Google sign-in unavailable.');
});

it.each([true, false])(
  'returns quietly from provider cancellation with creating=%s',
  async creating => {
    (signInWithGoogle as jest.Mock).mockRejectedValueOnce({
      code: 'auth/cancelled',
    });
    render(creating);
    if (creating)
      act(() =>
        tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
      );
    await act(async () => button('Continue with Google').props.onPress());
    expect(onState.mock.lastCall?.[0]).toMatchObject({
      busy: false,
      error: undefined,
    });
    expect(button('Continue with Google').props.disabled).toBe(false);
    expect(
      require('../src/features/legal/policy-service').acceptLegalTerms,
    ).not.toHaveBeenCalled();
  },
);

it('starts only one provider request when two taps arrive before the busy state renders', async () => {
  let finish!: () => void;
  (signInWithGoogle as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  render(false);
  const press = button('Continue with Google').props.onPress;
  await act(async () => {
    press();
    press();
  });
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  await act(async () => finish());
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
      if (creating)
        act(() =>
          tree.root
            .findByProps({testID: 'legal-acknowledgment'})
            .props.onPress(),
        );
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

it('requires adult acknowledgment for signup, including stale action references, without gating login', async () => {
  render(true);
  expect(button('Continue with Google').props.disabled).toBe(true);
  act(() => button('Continue with email').props.onPress());
  for (const input of tree.root.findAllByType(HoystInput)) {
    act(() =>
      input.props.onChangeText(
        input.props.accessibilityLabel === 'Email'
          ? 'adult@example.com'
          : 'password123',
      ),
    );
  }
  expect(onState.mock.lastCall?.[0].disabled).toBe(true);
  await act(async () => actionRef.current?.());
  const {
    registerWithEmail,
  } = require('../src/features/auth/services/auth-service');
  expect(registerWithEmail).not.toHaveBeenCalled();
  act(() =>
    tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
  );
  expect(onState.mock.lastCall?.[0].disabled).toBe(false);
  await act(async () => actionRef.current?.());
  expect(registerWithEmail).toHaveBeenCalledTimes(1);
  expect(
    require('../src/features/legal/policy-service').acceptLegalTerms,
  ).toHaveBeenCalledTimes(1);
});

it('does not record acceptance when sending or resending a phone code, but records it after confirmation', async () => {
  const auth = require('../src/features/auth/services/auth-service');
  const legal = require('../src/features/legal/policy-service');
  const confirmation = {confirm: jest.fn()};
  auth.startPhoneSignIn.mockResolvedValue(confirmation);
  auth.confirmPhoneSignIn.mockResolvedValue({user: {uid: 'phone-user'}});
  render(true);
  act(() =>
    tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
  );
  act(() => button('Continue with phone').props.onPress());
  act(() =>
    tree.root
      .findAllByType(HoystInput)
      .find(node => node.props.accessibilityLabel === 'Phone number')!
      .props.onChangeText('2025550142'),
  );
  await act(async () => actionRef.current?.());
  expect(auth.startPhoneSignIn).toHaveBeenCalledTimes(1);
  expect(legal.acceptLegalTerms).not.toHaveBeenCalled();
  const resend = tree.root
    .findAllByType(Pressable)
    .find(node => node.findAllByProps({children: 'Resend code'}).length > 0)!;
  await act(async () => resend.props.onPress());
  expect(auth.startPhoneSignIn).toHaveBeenCalledTimes(2);
  expect(legal.acceptLegalTerms).not.toHaveBeenCalled();
  act(() =>
    tree.root
      .findAllByType(HoystInput)
      .find(node => node.props.accessibilityLabel === 'Verification code')!
      .props.onChangeText('123456'),
  );
  await act(async () => actionRef.current?.());
  expect(auth.confirmPhoneSignIn).toHaveBeenCalledWith(confirmation, '123456');
  expect(legal.acceptLegalTerms).toHaveBeenCalledWith('phone-user');
});

it('shows a failed login above the fixed action, preserves the inputs, and clears the error on retry or method change', async () => {
  useSessionStore.setState({status: 'guest', user: undefined});
  const failure = {
    code: 'auth/invalid-credential',
    message: 'Raw Firebase error',
  };
  (signInWithEmail as jest.Mock).mockRejectedValue(failure);
  act(() => {
    tree = renderer.create(
      <SignInScreen
        navigation={{getParent: () => undefined, goBack: jest.fn()} as never}
        route={{params: {method: 'email'}} as never}
      />,
    );
  });
  act(() => {
    for (const input of tree.root.findAllByType(HoystInput)) {
      input.props.onChangeText(
        input.props.accessibilityLabel === 'Email'
          ? 'missing@example.com'
          : 'test-password',
      );
    }
  });
  await act(async () => button('Sign in').props.onPress());
  const footer = tree.root.findByProps({testID: 'setup-frame-footer'});
  const alerts = () =>
    footer
      .findAllByType(Text)
      .filter(node => node.props.accessibilityRole === 'alert');
  expect(alerts()).toHaveLength(1);
  expect(alerts()[0].props.children).toBe(
    'Email or password is incorrect. Try again or reset your password.',
  );
  expect(
    tree.root
      .findByType(ScrollView)
      .findAllByProps({accessibilityRole: 'alert'}),
  ).toHaveLength(0);
  expect(button('Sign in').props.disabled).toBe(false);
  expect(
    tree.root.findAllByType(HoystInput).map(input => input.props.value),
  ).toEqual(['missing@example.com', 'test-password']);

  let rejectRetry!: (reason: unknown) => void;
  (signInWithEmail as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectRetry = reject;
      }),
  );
  await act(async () => button('Sign in').props.onPress());
  expect(alerts()).toHaveLength(0);
  expect(button('Working...').props.disabled).toBe(true);
  await act(async () => rejectRetry(failure));
  expect(alerts()).toHaveLength(1);
  const changeMethod = tree.root
    .findAllByType(Pressable)
    .find(
      node =>
        node.findAllByProps({children: 'Use another sign-in method'}).length >
        0,
    )!;
  act(() => changeMethod.props.onPress());
  expect(alerts()).toHaveLength(0);
  expect(button('Continue with email')).toBeDefined();
});
