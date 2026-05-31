import React from 'react';
import {AccessibilityInfo, InteractionManager, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {TapInRingMark} from '../src/design/components/TapInRingMark';
import {TapInCompleteScreen} from '../src/features/check-in/screens/TapInCompleteScreen';

const mockSubscribeToMemberCircleDetail = jest.fn((_options: unknown) =>
  jest.fn(),
);

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(MockView, props, children);
});

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (
    selector: (state: {
      status: 'authenticatedReady';
      user: {providerIds: string[]; uid: string};
    }) => unknown,
  ) =>
    selector({
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    }),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  subscribeToMemberCircleDetail: (options: unknown) =>
    mockSubscribeToMemberCircleDetail(options),
}));

function renderCompleteScreen() {
  return renderer.create(
    <TapInCompleteScreen
      navigation={
        {
          canGoBack: jest.fn(() => true),
          goBack: jest.fn(),
          replace: jest.fn(),
        } as never
      }
      route={
        {
          key: 'TapInComplete',
          name: 'TapInComplete',
          params: {
            circleId: 'circle-1',
            circleTitle: 'Morning Movers',
            commitment: 'Move for 30 minutes',
            inviteUrl: 'https://hoyst.app/join/circle-1',
            progressLabel: 'Week · 50%',
            source: 'home',
            status: 'done',
            streakLabel: '4d streak',
          },
        } as never
      }
    />,
  );
}

describe('TapInCompleteScreen', () => {
  beforeEach(() => {
    mockSubscribeToMemberCircleDetail.mockClear();
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation(callback => {
        if (typeof callback === 'function') {
          callback();
        }
        return {cancel: jest.fn()} as never;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders completion from route snapshot before detail subscription emits', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    expect(mockSubscribeToMemberCircleDetail).toHaveBeenCalledTimes(1);

    const layoutTarget = tree!.root
      .findAllByType(View)
      .find(node => typeof node.props.onLayout === 'function');

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Tap In Complete');
    expect(output).toContain('Update sent');
    expect(output).toContain('Move for 30 minutes');
    expect(output).not.toContain('Finalizing Tap In');
    expect(output).not.toContain('Loading Tap In details');
    expect(output).not.toContain('Loading your circle');
  });

  it('keeps the success ring celebratory without the rotating streak trail', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    const ring = tree!.root
      .findAllByType(TapInRingMark)
      .find(node => node.props.outerSize === 92);

    expect(ring?.props.state).toBe('streak');
    expect(ring?.props.showTrail).toBe(false);
  });
});
