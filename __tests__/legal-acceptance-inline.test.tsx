import React, {useEffect} from 'react';
import renderer, {act} from 'react-test-renderer';
import {Modal, Text} from 'react-native';
import {useHasLegalAcceptance} from '../src/features/legal/LegalAcceptanceContext';
import {LegalAcceptanceProvider} from '../src/features/legal/LegalAcceptanceProvider';
import {LegalAcceptanceBanner} from '../src/features/legal/LegalAcceptanceBanner';
import {DSButton, DesignSystemProvider} from '../src/design/system';
import {useSessionStore} from '../src/store/session-store';
const mockSave = jest.fn();
const mockSignOut = jest.fn();
const mockSubscriptions = new Map<
  string,
  {value: (accepted: boolean) => void; error: () => void; stop: jest.Mock}
>();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/features/legal/policy-service', () => ({
  acceptLegalTerms: (uid: string) => mockSave(uid),
  subscribeToLegalAcceptance: (
    uid: string,
    value: (accepted: boolean) => void,
    error: () => void,
  ) => {
    const stop = jest.fn();
    mockSubscriptions.set(uid, {value, error, stop});
    return stop;
  },
}));
jest.mock('../src/features/auth/services/auth-service', () => ({
  signOutOfHoyst: () => mockSignOut(),
}));
jest.mock('../src/design/components/HoystScreen', () => ({
  HoystScreen: require('react-native').View,
}));
jest.mock('../src/design/components/HoystText', () => ({
  HoystText: require('react-native').Text,
}));
jest.mock('../src/design/components/HoystButton', () => ({
  HoystButton: (props: object) =>
    require('react').createElement(require('react-native').View, props),
}));
let tree: renderer.ReactTestRenderer;
let mounts: number;
function Content() {
  const accepted = useHasLegalAcceptance();
  useEffect(() => {
    mounts++;
  }, []);
  return <Text>{accepted ? 'Account acknowledged' : 'Account pending'}</Text>;
}
function render() {
  act(() => {
    tree = renderer.create(
      <LegalAcceptanceProvider>
        <Content />
        <DesignSystemProvider scheme="light">
          <LegalAcceptanceBanner />
        </DesignSystemProvider>
      </LegalAcceptanceProvider>,
    );
  });
}
function button(label: string) {
  return tree.root
    .findAllByType(DSButton)
    .find(node => node.props.label === label)!;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSubscriptions.clear();
  mounts = 0;
  useSessionStore.setState({status: 'guest', user: undefined});
  mockSave.mockResolvedValue({accepted: true});
});
afterEach(() => act(() => tree?.unmount()));
it('mounts guest content without requesting account data', () => {
  render();
  expect(mounts).toBe(1);
  expect(mockSubscriptions.size).toBe(0);
});
it('keeps navigation usable and saves acknowledgment inline with retry', async () => {
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'a', providerIds: []},
  });
  render();
  expect(mounts).toBe(1);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  act(() => mockSubscriptions.get('a')!.value(false));
  expect(button('Confirm').props.disabled).toBe(true);
  await act(async () => button('Confirm').props.onPress());
  expect(mockSave).not.toHaveBeenCalled();
  act(() =>
    tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
  );
  mockSave.mockRejectedValueOnce(new Error('offline'));
  await act(async () => button('Confirm').props.onPress());
  expect(mounts).toBe(1);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'offline'),
  ).toBe(true);
  await act(async () => button('Confirm').props.onPress());
  expect(mounts).toBe(1);
  expect(mockSave).toHaveBeenLastCalledWith('a');
  expect(
    tree.root.findAllByProps({testID: 'legal-acceptance-inline'}),
  ).toHaveLength(0);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Account acknowledged'),
  ).toBe(true);
});
it('isolates accounts and ignores stale subscription responses after switching or signing out', () => {
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'a', providerIds: []},
  });
  render();
  const previous = mockSubscriptions.get('a')!;
  act(() => previous.value(true));
  expect(mounts).toBe(1);
  act(() => useSessionStore.setState({user: {uid: 'b', providerIds: []}}));
  expect(previous.stop).toHaveBeenCalled();
  act(() => previous.value(true));
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Account pending'),
  ).toBe(true);
  act(() => mockSubscriptions.get('b')!.error());
  expect(button('Try again')).toBeDefined();
  act(() => useSessionStore.setState({status: 'guest', user: undefined}));
  expect(mounts).toBe(1);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
});

it('ignores an acknowledgment response after the account changes during saving', async () => {
  let finish!: () => void;
  mockSave.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'a', providerIds: []},
  });
  render();
  act(() => mockSubscriptions.get('a')!.value(false));
  act(() =>
    tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
  );
  await act(async () => button('Confirm').props.onPress());
  act(() => useSessionStore.setState({user: {uid: 'b', providerIds: []}}));
  await act(async () => finish());
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Account acknowledged'),
  ).toBe(false);
});

it('resets the inline checkbox when accounts change and skips guest reads even with a stale user', () => {
  useSessionStore.setState({
    status: 'authenticatedReady',
    user: {uid: 'a', providerIds: []},
  });
  render();
  act(() => mockSubscriptions.get('a')!.value(false));
  act(() =>
    tree.root.findByProps({testID: 'legal-acknowledgment'}).props.onPress(),
  );
  expect(button('Confirm').props.disabled).toBe(false);
  act(() => useSessionStore.setState({user: {uid: 'b', providerIds: []}}));
  act(() => mockSubscriptions.get('b')!.value(false));
  expect(button('Confirm').props.disabled).toBe(true);
  act(() =>
    useSessionStore.setState({
      status: 'guest',
      user: {uid: 'stale', providerIds: []},
    }),
  );
  expect(mockSubscriptions.has('stale')).toBe(false);
  expect(
    tree.root.findAllByProps({testID: 'legal-acceptance-inline'}),
  ).toHaveLength(0);
});
