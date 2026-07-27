jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn(payload => ({payload, type: 'RESET'})),
  },
}));

const mockGetInitialURL = jest.fn();
const mockRemoveUrlListener = jest.fn();
const mockResolveCircleInvite = jest.fn();
const mockJoinCircle = jest.fn();
const mockSettingsGet = jest.fn();
const mockSettingsSet = jest.fn();
const mockSettingsWatchKeys = jest.fn();
const mockSettingsClearWatch = jest.fn();
const mockTakePendingURL = jest.fn();

jest.mock('react-native/Libraries/Settings/Settings', () => ({
  clearWatch: (...args: unknown[]) => mockSettingsClearWatch(...args),
  get: (...args: unknown[]) => mockSettingsGet(...args),
  set: (...args: unknown[]) => mockSettingsSet(...args),
  watchKeys: (...args: unknown[]) => mockSettingsWatchKeys(...args),
}));

jest.mock('../src/features/circle-invites/services/invite-service', () => ({
  resolveCircleInvite: (...args: unknown[]) => mockResolveCircleInvite(...args),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  joinCircle: (...args: unknown[]) => mockJoinCircle(...args),
}));

import React from 'react';
import type {NavigationContainerRef} from '@react-navigation/native';
import {Linking, NativeModules} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {CircleInviteCoordinator} from '../src/features/circle-invites/providers/CircleInviteCoordinator';
import type {CircleInvitePreview} from '../src/features/circle-invites/types';
import type {RootStackParamList} from '../src/navigation/types';
import {useCircleInviteStore} from '../src/store/circle-invite-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {useSessionStore} from '../src/store/session-store';

const preview: CircleInvitePreview = {
  cadenceLabel: 'Daily',
  circleId: 'circle-1',
  commitment: 'Sleep 7 hours in a day',
  isFull: false,
  joinMode: 'invite_only',
  maxSize: 8,
  memberCount: 3,
  title: 'Sleep 7 Hours',
};

describe('CircleInviteCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInitialURL.mockResolvedValue(null);
    mockJoinCircle.mockResolvedValue(undefined);
    mockResolveCircleInvite.mockResolvedValue(preview);
    jest.spyOn(Linking, 'addEventListener').mockReturnValue({
      remove: mockRemoveUrlListener,
    } as unknown as ReturnType<typeof Linking.addEventListener>);
    jest.spyOn(Linking, 'getInitialURL').mockImplementation(mockGetInitialURL);
    mockSettingsGet.mockReturnValue(undefined);
    mockSettingsWatchKeys.mockReturnValue(1);
    mockTakePendingURL.mockResolvedValue(undefined);
    NativeModules.HoystInviteLink = {
      takePendingURL: mockTakePendingURL,
    };

    useSessionStore.setState({
      pendingAction: undefined,
      status: 'guest',
      user: undefined,
    });
    useOnboardingStore.getState().reset();
    useOnboardingStore.setState({
      hasHydrated: false,
      hasSeenOnboarding: false,
      journey: 'standard',
    });
    useCircleInviteStore.getState().clearInvite();
    useCircleInviteStore.setState({
      consented: false,
      hasCheckedInitialUrl: true,
      hasHydrated: true,
      inviteCode: 'abc123xy',
      joinStatus: 'idle',
      preview,
      resolutionStatus: 'ready',
    });
  });

  it('consumes an invite delivered by the iOS scene lifecycle', async () => {
    useCircleInviteStore.getState().clearInvite();
    mockTakePendingURL.mockResolvedValue('hoyst://join/yig941r4');
    const navigationRef = {
      dispatch: jest.fn(),
      getCurrentRoute: jest.fn(() => ({name: 'MainTabs'})),
      navigate: jest.fn(),
    } as unknown as NavigationContainerRef<RootStackParamList>;
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CircleInviteCoordinator
          isNavigationReady
          navigationRef={navigationRef}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTakePendingURL).toHaveBeenCalled();
    expect(useCircleInviteStore.getState().inviteCode).toBe('yig941r4');
    expect(mockResolveCircleInvite).toHaveBeenCalledWith('yig941r4');
    expect(useCircleInviteStore.getState().preview).toEqual(preview);
    expect(useCircleInviteStore.getState().resolutionStatus).toBe('ready');

    act(() => tree.unmount());
  });

  it('keeps a native invite that arrives while persistence is hydrating', async () => {
    useCircleInviteStore.getState().clearInvite();
    useCircleInviteStore.setState({hasHydrated: false});
    let resolvePendingURL: (url: string) => void = () => undefined;
    mockTakePendingURL.mockReturnValue(
      new Promise(resolve => {
        resolvePendingURL = resolve;
      }),
    );
    const navigationRef = {
      dispatch: jest.fn(),
      getCurrentRoute: jest.fn(() => ({name: 'MainTabs'})),
      navigate: jest.fn(),
    } as unknown as NavigationContainerRef<RootStackParamList>;
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CircleInviteCoordinator
          isNavigationReady
          navigationRef={navigationRef}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      useCircleInviteStore.setState({hasHydrated: true});
      resolvePendingURL('hoyst://join/yig941r4');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useCircleInviteStore.getState().inviteCode).toBe('yig941r4');
    expect(mockResolveCircleInvite).toHaveBeenCalledWith('yig941r4');
    expect(useCircleInviteStore.getState().preview).toEqual(preview);

    act(() => tree.unmount());
  });

  it('completes an automatic join after its joining state is set', async () => {
    useOnboardingStore.getState().setHasHydrated(true);
    useSessionStore.setState({
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    });
    useCircleInviteStore.setState({
      consented: true,
      inviteCode: 'abc123xy',
      joinStatus: 'idle',
      preview,
      resolutionStatus: 'ready',
    });
    const dispatch = jest.fn();
    const navigationRef = {
      dispatch,
      getCurrentRoute: jest.fn(() => ({name: 'CircleInvite'})),
      navigate: jest.fn(),
    } as unknown as NavigationContainerRef<RootStackParamList>;
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CircleInviteCoordinator
          isNavigationReady
          navigationRef={navigationRef}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockJoinCircle).toHaveBeenCalledWith('circle-1', 'abc123xy');
    expect(useCircleInviteStore.getState().inviteCode).toBeUndefined();
    expect(dispatch).toHaveBeenCalledWith({
      payload: {
        index: 1,
        routes: [
          {name: 'MainTabs'},
          {
            name: 'CircleDetail',
            params: {circleId: 'circle-1'},
          },
        ],
      },
      type: 'RESET',
    });

    act(() => tree.unmount());
  });

  it('waits for the root navigator to leave loading before presenting an invite', async () => {
    const navigate = jest.fn();
    const navigationRef = {
      dispatch: jest.fn(),
      getCurrentRoute: jest.fn(() => ({name: 'MainTabs'})),
      navigate,
    } as unknown as NavigationContainerRef<RootStackParamList>;
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CircleInviteCoordinator
          isNavigationReady
          navigationRef={navigationRef}
        />,
      );
      await Promise.resolve();
    });

    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      useOnboardingStore.getState().setHasHydrated(true);
      await Promise.resolve();
    });

    expect(navigate).toHaveBeenCalledWith('CircleInvite', {
      inviteCode: 'abc123xy',
    });

    act(() => tree.unmount());
  });

  it('waits for session initialization before presenting an invite', async () => {
    useOnboardingStore.getState().setHasHydrated(true);
    useSessionStore.getState().setInitializing();

    const navigate = jest.fn();
    const navigationRef = {
      dispatch: jest.fn(),
      getCurrentRoute: jest.fn(() => ({name: 'MainTabs'})),
      navigate,
    } as unknown as NavigationContainerRef<RootStackParamList>;
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <CircleInviteCoordinator
          isNavigationReady
          navigationRef={navigationRef}
        />,
      );
      await Promise.resolve();
    });

    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      useSessionStore.getState().setGuest();
      await Promise.resolve();
    });

    expect(navigate).toHaveBeenCalledWith('CircleInvite', {
      inviteCode: 'abc123xy',
    });

    act(() => tree.unmount());
  });
});
