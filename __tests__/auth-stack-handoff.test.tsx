import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AuthStackNavigator} from '../src/navigation/AuthStackNavigator';
import {useSessionStore} from '../src/store/session-store';
import {useOnboardingStore} from '../src/store/onboarding-store';
import {useSetupJourneyStore} from '../src/store/setup-journey-store';
import {createSetupJourney} from '../src/features/create-circle/services/setup-journey';

let mockMounts = 0;
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-navigation/native', () => ({
  CommonActions: {reset: (payload: unknown) => ({payload})},
}));
jest.mock('@react-navigation/native-stack', () => {
  const ReactMock = require('react');
  const Navigator = ({children}: React.PropsWithChildren) => {
    ReactMock.useEffect(() => {
      mockMounts += 1;
    }, []);
    return children;
  };
  return {createNativeStackNavigator: () => ({Navigator, Screen: () => null})};
});
jest.mock('../src/features/auth/screens/WelcomeScreen', () => ({
  WelcomeScreen: () => null,
}));
jest.mock('../src/features/auth/screens/SignInScreen', () => ({
  SignInScreen: () => null,
}));

it('retains the same navigator and keeps the modal open while profile saving hands off to reminders', () => {
  mockMounts = 0;
  const user = {uid: 'qa', providerIds: ['apple.com']};
  useSessionStore.setState({status: 'authenticatedIncompleteProfile', user});
  useOnboardingStore.setState({
    hasSeenOnboarding: true,
    hasPendingProfileCompletion: false,
    hasPendingStarterCircleSetup: false,
  });
  const record = createSetupJourney('profile', 'UTC');
  record.status = 'saving';
  record.ownerUid = user.uid;
  useSetupJourneyStore.setState({
    records: {onboarding: record},
    hydrated: true,
  });
  const navigation = {
    getState: () => ({
      index: 1,
      routes: [
        {key: 'main', name: 'MainTabs'},
        {key: 'auth', name: 'Auth'},
      ],
    }),
    dispatch: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <AuthStackNavigator
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });
  act(() => useSessionStore.getState().setAuthenticatedReady(user));
  act(() => {
    useSetupJourneyStore
      .getState()
      .update('onboarding', {step: 'reminders', status: 'saved'});
  });
  expect(mockMounts).toBe(1);
  expect(navigation.dispatch).not.toHaveBeenCalled();
  act(() => {
    useOnboardingStore.getState().markSeen();
    useSetupJourneyStore.getState().discard('onboarding');
  });
  expect(navigation.dispatch).toHaveBeenCalled();
  act(() => tree!.unmount());
});
