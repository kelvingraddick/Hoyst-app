import React from 'react';
import {AccessibilityInfo, InteractionManager, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystButton} from '../src/design/components/HoystButton';
import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {TapInRingMark} from '../src/design/components/TapInRingMark';
import {TapInCompleteScreen} from '../src/features/check-in/screens/TapInCompleteScreen';
import type {RootStackParamList} from '../src/navigation/types';

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

function renderCompleteScreen(
  params: Partial<RootStackParamList['TapInComplete']> = {},
) {
  return renderer.create(
    <TapInCompleteScreen
      navigation={
        {
          canGoBack: jest.fn(() => true),
          goBack: jest.fn(),
          navigate: jest.fn(),
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
            completionMomentum: {
              currentStreak: 6,
              streakDelta: 1,
            },
            commitment: 'Move for 30 minutes',
            inviteUrl: 'https://hoyst.app/join/circle-1',
            memberCount: 4,
            periodTapInCount: 8,
            progressLabel: 'Week · 50%',
            source: 'home',
            status: 'done',
            streakDays: 4,
            streakLabel: '4d streak',
            ...params,
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
    expect(output).toContain('+1 day streak');
    expect(output).toContain('6 now');
    expect(output).toContain('Move for 30 minutes');
    expect(output).toContain('Share Story');
    expect(output).toContain('Done');
    expect(output).not.toContain('Finalizing Tap In');
    expect(output).not.toContain('Loading Tap In details');
    expect(output).not.toContain('Loading your circle');
  });

  it('uses the current floating Tap In mark instead of the stale ring mark', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    const logo = tree!.root.findByProps({testID: 'tap-in-complete-logo'});

    expect(logo.type).toBe(HoystTapInMark);
    expect(logo.props.logoRotation).toBeDefined();
    expect(tree!.root.findAllByType(TapInRingMark)).toHaveLength(0);
  });

  it('opens the dedicated story share screen from Share Story', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    const layoutTarget = tree!.root
      .findAllByType(View)
      .find(node => typeof node.props.onLayout === 'function');

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const navigation =
      tree!.root.findByType(TapInCompleteScreen).props.navigation;
    const shareButton = tree!.root
      .findAllByType(HoystButton)
      .find(button => button.props.label === 'Share Story');

    await act(async () => {
      shareButton!.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInStoryShare', {
      circleId: 'circle-1',
      circleTitle: 'Morning Movers',
      commitment: 'Move for 30 minutes',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      memberCount: 4,
      note: undefined,
      periodTapInCount: 8,
      photoUri: undefined,
      progressLabel: 'Week · 50%',
      source: 'home',
      streakDays: 4,
      streakLabel: '4d streak',
    });
  });

  it('renders skip confirmation with grace copy and no story action', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen({
        completionMomentum: {
          currentStreak: 6,
          streakDelta: 0,
        },
        status: 'skip',
      });
    });

    const layoutTarget = tree!.root
      .findAllByType(View)
      .find(node => typeof node.props.onLayout === 'function');

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Skip Recorded');
    expect(output).toContain('Grace skip used');
    expect(output).toContain('6 days streak held');
    expect(output).toContain('No note added. Your grace skip still counts.');
    expect(output).not.toContain('Share Story');
  });
});
