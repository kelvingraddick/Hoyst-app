import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {TapInComposerScreen} from '../src/features/check-in/screens/TapInComposerScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockSubmitTapIn = jest.fn();
const mockRemoveTapIn = jest.fn();
const mockSubscribeToMemberCircleDetail = jest.fn();

const baseMockDetail: CircleDetailModel = {
  activity: [],
  category: 'Fitness',
  commitment: 'Move for 30 minutes',
  commitmentCadence: 'weekly',
  commitmentFrequency: {tapInsPerWeek: 4},
  commitmentLabel: 'Commitment: Move for 30 minutes',
  completionRate: 50,
  graceRules: {skip: {allowance: 0, windowDays: 7}},
  id: 'circle-1',
  inviteUrl: 'https://hoyst.app/join/circle-1',
  maxSize: 8,
  memberCount: 4,
  members: [],
  monthProgress: [],
  progressLabel: 'Week · 50%',
  remainingCheckIns: 2,
  state: 'active',
  streakDays: 4,
  streakLabel: '4d streak',
  title: 'Morning Movers',
  viewerHasCheckedIn: false,
  viewerHasTappedInToday: false,
  viewerMembershipStatus: 'active',
  viewerRemainingTapIns: 2,
  viewerTodayStatus: 'rest',
};
let mockDetail: CircleDetailModel = {...baseMockDetail};

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
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

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

jest.mock('../src/features/check-in/services/check-in-service', () => ({
  removeTapIn: (...args: unknown[]) => mockRemoveTapIn(...args),
  submitTapIn: (...args: unknown[]) => mockSubmitTapIn(...args),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  subscribeToMemberCircleDetail: ({
    onDetail,
  }: {
    onDetail: (detail: typeof mockDetail) => void;
  }) => {
    mockSubscribeToMemberCircleDetail();
    onDetail(mockDetail);
    return jest.fn();
  },
}));

function renderComposerScreen() {
  return renderer.create(
    <TapInComposerScreen
      navigation={
        {
          goBack: jest.fn(),
          replace: jest.fn(),
        } as never
      }
      route={
        {
          key: 'TapInComposer',
          name: 'TapInComposer',
          params: {
            circleId: 'circle-1',
            source: 'home',
          },
        } as never
      }
    />,
  );
}

describe('TapInComposerScreen', () => {
  beforeEach(() => {
    mockDetail = {...baseMockDetail};
    mockSubmitTapIn.mockResolvedValue({
      checkInId: 'user-1',
      dateKey: '2026-05-29',
    });
    mockRemoveTapIn.mockResolvedValue({dateKey: '2026-05-29', removed: true});
    mockSubscribeToMemberCircleDetail.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes circle snapshot params to the complete screen after submit', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const confirmButton = tree!.root
      .findAllByType(TapInPulseButton)
      .find(button => button.props.label === 'Confirm Tap In');

    await act(async () => {
      confirmButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.replace).toHaveBeenCalledWith('TapInComplete', {
      circleId: 'circle-1',
      circleTitle: 'Morning Movers',
      commitment: 'Move for 30 minutes',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      note: undefined,
      photoUri: undefined,
      progressLabel: 'Week · 50%',
      source: 'home',
      status: 'done',
      streakLabel: '4d streak',
    });
  });

  it('allows a new daily Tap In after the weekly commitment is complete', async () => {
    mockDetail = {
      ...baseMockDetail,
      completionRate: 100,
      progressLabel: 'Week · 100%',
      remainingCheckIns: 0,
      state: 'done',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: false,
      viewerRemainingTapIns: 0,
      viewerTodayStatus: undefined,
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());
    const confirmButton = tree!.root
      .findAllByType(TapInPulseButton)
      .find(button => button.props.label === 'Confirm Tap In');

    expect(output).toContain('Commitment complete');
    expect(confirmButton).toBeTruthy();
    expect(confirmButton?.props.disabled).toBe(false);
  });
});
