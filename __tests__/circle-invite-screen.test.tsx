jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn(payload => ({payload, type: 'RESET'})),
  },
}));

import React from 'react';
import {Pressable} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {CircleInviteScreen} from '../src/features/circle-invites/screens/CircleInviteScreen';
import type {CircleInvitePreview} from '../src/features/circle-invites/types';
import {useCircleInviteStore} from '../src/store/circle-invite-store';
import {useOnboardingStore} from '../src/store/onboarding-store';

const mockBeginAuthFlow = jest.fn();
const mockSubscribeToInviteMembership = jest.fn();
let mockMembershipStatus: 'active' | 'pending' | undefined;
let mockSessionState: {
  beginAuthFlow: typeof mockBeginAuthFlow;
  status: 'authenticatedIncompleteProfile' | 'authenticatedReady' | 'guest';
  user?: {providerIds: string[]; uid: string};
};
const mountedTrees: renderer.ReactTestRenderer[] = [];

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

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

jest.mock('../src/features/circle-invites/services/invite-service', () => ({
  subscribeToInviteMembership: (args: {
    onStatus: (status: 'active' | 'pending' | undefined) => void;
  }) => {
    mockSubscribeToInviteMembership(args);
    args.onStatus(mockMembershipStatus);
    return jest.fn();
  },
}));

const basePreview: CircleInvitePreview = {
  cadenceLabel: 'Daily',
  circleId: 'circle-1',
  commitment: 'Move for 30 minutes',
  isFull: false,
  joinMode: 'invite_only',
  maxSize: 8,
  memberCount: 3,
  title: 'Morning Movers',
};

function textContent(node: ReactTestInstance): string {
  return node.children
    .map(child =>
      typeof child === 'string'
        ? child
        : textContent(child as ReactTestInstance),
    )
    .join('');
}

function pressButtonText(tree: renderer.ReactTestRenderer, label: string) {
  const match = tree.root
    .findAll(
      node =>
        node.type === Pressable &&
        !node.props.accessibilityLabel &&
        textContent(node).includes(label),
    )
    .at(-1);

  if (!match) {
    throw new Error(`Could not find button with label ${label}`);
  }

  act(() => {
    match.props.onPress();
  });
}

function renderScreen() {
  const navigation = {
    canGoBack: jest.fn(() => true),
    dispatch: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleInviteScreen
        navigation={navigation as never}
        route={
          {
            key: 'CircleInvite',
            name: 'CircleInvite',
            params: {inviteCode: 'abc123xy'},
          } as never
        }
      />,
    );
  });
  mountedTrees.push(tree!);

  return {navigation, output: JSON.stringify(tree!.toJSON()), tree: tree!};
}

function setResolvedInvite(preview: CircleInvitePreview = basePreview) {
  useCircleInviteStore.getState().setInviteCode('abc123xy');
  useCircleInviteStore.getState().setResolvedPreview('abc123xy', preview);
}

describe('CircleInviteScreen', () => {
  beforeEach(() => {
    mockMembershipStatus = undefined;
    mockSessionState = {
      beginAuthFlow: mockBeginAuthFlow,
      status: 'guest',
    };
    mockBeginAuthFlow.mockReset();
    mockSubscribeToInviteMembership.mockReset();
    useCircleInviteStore.getState().clearInvite();
    useOnboardingStore.getState().reset();
    setResolvedInvite();
  });

  afterEach(() => {
    act(() => {
      mountedTrees.splice(0).forEach(tree => tree.unmount());
    });
    jest.clearAllMocks();
  });

  it('shows the limited preview and both guest account paths', () => {
    const {output} = renderScreen();

    expect(output).toContain('Morning Movers');
    expect(output).toContain('Move for 30 minutes');
    expect(output).toContain('3 of 8 members');
    expect(output).toContain('Create Account to Join');
    expect(output).toContain('I Already Have an Account');
  });

  it('records consent before starting invite account creation', () => {
    const {navigation, tree} = renderScreen();

    pressButtonText(tree, 'Create Account to Join');

    expect(useCircleInviteStore.getState().consented).toBe(true);
    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'notifications',
      firstCircleSkipped: true,
      journey: 'invite',
    });
    expect(mockBeginAuthFlow).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('Auth', {
      screen: 'Welcome',
    });
  });

  it('offers profile completion without clearing the invitation', () => {
    mockSessionState = {
      beginAuthFlow: mockBeginAuthFlow,
      status: 'authenticatedIncompleteProfile',
      user: {providerIds: ['apple.com'], uid: 'user-1'},
    };
    const {navigation, output, tree} = renderScreen();

    expect(output).toContain('Finish Profile to Join');
    pressButtonText(tree, 'Finish Profile to Join');

    expect(useCircleInviteStore.getState()).toMatchObject({
      consented: true,
      inviteCode: 'abc123xy',
      preview: basePreview,
    });
    expect(useOnboardingStore.getState()).toMatchObject({
      currentStep: 'finishProfile',
      journey: 'invite',
    });
    expect(navigation.navigate).toHaveBeenCalledWith('Auth', {
      screen: 'Welcome',
    });
  });

  it('records consent for ready members and request-to-join Circles', () => {
    mockSessionState = {
      beginAuthFlow: mockBeginAuthFlow,
      status: 'authenticatedReady',
      user: {providerIds: ['apple.com'], uid: 'user-1'},
    };
    setResolvedInvite({
      ...basePreview,
      joinMode: 'request_to_join',
    });
    const {output, tree} = renderScreen();

    expect(output).toContain('Request to Join');
    pressButtonText(tree, 'Request to Join');
    expect(useCircleInviteStore.getState().consented).toBe(true);
  });

  it('keeps a full Circle preview visible while disabling joining', () => {
    setResolvedInvite({
      ...basePreview,
      isFull: true,
      memberCount: 8,
    });
    const {output} = renderScreen();

    expect(output).toContain('Morning Movers');
    expect(output).toContain('Circle full');
    expect(output).toContain('reached its current capacity');
    expect(output).not.toContain('Create Account to Join');
  });

  it('shows uniform unavailable and retry states', () => {
    useCircleInviteStore.getState().setResolutionUnavailable();
    let rendered = renderScreen();
    expect(rendered.output).toContain('Invite no longer available');

    act(() => {
      rendered.tree.unmount();
    });
    useCircleInviteStore.getState().setResolutionError('Network unavailable.');
    rendered = renderScreen();
    expect(rendered.output).toContain('Could not open invitation');
    expect(rendered.output).toContain('Network unavailable.');
    expect(rendered.output).toContain('Retry');
  });

  it('opens Circle Detail immediately for active or pending members', () => {
    mockMembershipStatus = 'pending';
    mockSessionState = {
      beginAuthFlow: mockBeginAuthFlow,
      status: 'authenticatedReady',
      user: {providerIds: ['apple.com'], uid: 'user-1'},
    };
    const {navigation} = renderScreen();

    expect(mockSubscribeToInviteMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        uid: 'user-1',
      }),
    );
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'RESET'}),
    );
    expect(useCircleInviteStore.getState().inviteCode).toBeUndefined();
  });
});
