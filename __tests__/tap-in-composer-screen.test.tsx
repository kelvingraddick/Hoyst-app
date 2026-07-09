import React from 'react';
import {Image, Pressable} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {TapInActionButton} from '../src/design/components/TapInActionButton';
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
  periodTapInCount: 8,
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
          navigate: jest.fn(),
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

function findPressableContainingText(
  tree: renderer.ReactTestRenderer,
  text: string,
) {
  const hasText = (node: renderer.ReactTestInstance): boolean =>
    node.children.some(child => {
      if (typeof child === 'string') {
        return child.includes(text);
      }

      return hasText(child);
    });

  return tree.root
    .findAllByType(Pressable)
    .find(pressable => hasText(pressable));
}

describe('TapInComposerScreen', () => {
  beforeEach(() => {
    mockDetail = {...baseMockDetail};
    mockSubmitTapIn.mockResolvedValue({
      checkInId: 'user-1',
      dateKey: '2026-05-29',
      momentum: {
        currentStreak: 6,
        streakDelta: 1,
      },
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
    expect(tree!.root.findByProps({testID: 'tap-in-composer-logo'}).type).toBe(
      HoystTapInMark,
    );
    const confirmButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Confirm Tap In');

    expect(confirmButton?.props.variant).toBe('primary');

    await act(async () => {
      confirmButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.replace).toHaveBeenCalledWith('TapInComplete', {
      circleId: 'circle-1',
      circleTitle: 'Morning Movers',
      completionMomentum: {
        currentStreak: 6,
        streakDelta: 1,
      },
      commitment: 'Move for 30 minutes',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      memberCount: 4,
      note: undefined,
      periodTapInCount: 8,
      photoUri: undefined,
      progressLabel: 'Week · 50%',
      source: 'home',
      status: 'done',
      streakDays: 4,
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
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Confirm Tap In');

    expect(output).toContain('Commitment complete');
    expect(confirmButton).toBeTruthy();
    expect(confirmButton?.props.disabled).toBe(false);
  });

  it('keeps skip disabled until grace availability is loaded', async () => {
    mockDetail = {
      ...baseMockDetail,
      graceRules: {skip: {allowance: 1, windowDays: 7}},
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());
    const skipButton = findPressableContainingText(tree!, 'Checking skips');

    expect(output).toContain('Checking skips (1 per 7 days)');
    expect(skipButton?.props.disabled).toBe(true);
  });

  it('disables skip when the grace allowance is exhausted', async () => {
    mockDetail = {
      ...baseMockDetail,
      graceRules: {skip: {allowance: 1, windowDays: 7}},
      viewerAvailableSkips: 0,
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());
    const skipButton = findPressableContainingText(tree!, 'No skips left');

    expect(output).toContain('No skips left (1 per 7 days)');
    expect(skipButton?.props.disabled).toBe(true);
  });

  it('submits a skip when grace availability is positive', async () => {
    mockDetail = {
      ...baseMockDetail,
      graceRules: {skip: {allowance: 1, windowDays: 7}},
      viewerAvailableSkips: 1,
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const skipButton = findPressableContainingText(tree!, 'Use Skip (1 left)');

    expect(skipButton?.props.disabled).toBe(false);

    await act(async () => {
      skipButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSubmitTapIn).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        status: 'skip',
      }),
    );
  });

  it('renders the logged Tap In review state with fallback proof copy and actions', async () => {
    mockDetail = {
      ...baseMockDetail,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerTodayStatus: 'done',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());
    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const actionButtons = tree!.root.findAllByType(TapInActionButton);
    const shareButton = actionButtons.find(
      button => button.props.label === 'Share Story',
    );
    const removeButton = actionButtons.find(
      button => button.props.label === 'Remove Tap In',
    );
    const closeButton = actionButtons.find(
      button => button.props.label === 'Close',
    );

    expect(output).toContain('Tap In logged');
    expect(output).toContain("Today's proof");
    expect(output).not.toContain('Already tapped in');
    expect(output).toContain('No note added. Your Tap In still counts.');
    expect(output).toContain(
      "Removing this will reopen today's Tap In and lower this Circle's Progression.",
    );
    expect(tree!.root.findAllByType(HoystTapInMark).length).toBeGreaterThan(0);
    expect(shareButton?.props.variant).toBe('accentOutline');
    expect(removeButton?.props.variant).toBe('dangerOutline');
    expect(removeButton?.props.disabled).toBe(false);
    expect(closeButton?.props.variant).toBe('text');
    expect(
      actionButtons
        .map(button => button.props.label)
        .filter((label: string) =>
          ['Share Story', 'Remove Tap In', 'Close'].includes(label),
        ),
    ).toEqual(['Share Story', 'Remove Tap In', 'Close']);

    await act(async () => {
      shareButton!.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInStoryShare', {
      circleId: 'circle-1',
      circleTitle: 'Morning Movers',
      commitment: 'Move for 30 minutes',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      memberCount: 4,
      periodTapInCount: 8,
      progressLabel: 'Week · 50%',
      source: 'home',
      streakDays: 4,
      streakLabel: '4d streak',
      note: undefined,
      photoUri: undefined,
    });
  });

  it('renders the saved Tap In photo and note in the review state', async () => {
    mockDetail = {
      ...baseMockDetail,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerTodayCheckIn: {
        note: 'Slept eight hours and woke up steady.',
        photoUrl: 'https://example.com/proof.jpg',
        status: 'done',
      },
      viewerTodayStatus: 'done',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());
    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const proofImage = tree!.root.findByProps({
      testID: 'tap-in-view-proof-image',
    });
    const shareButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Share Story');

    expect(output).toContain('Slept eight hours and woke up steady.');
    expect(proofImage.type).toBe(Image);
    expect(proofImage.props.source).toEqual({
      uri: 'https://example.com/proof.jpg',
    });

    await act(async () => {
      shareButton!.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInStoryShare', {
      circleId: 'circle-1',
      circleTitle: 'Morning Movers',
      commitment: 'Move for 30 minutes',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      memberCount: 4,
      note: 'Slept eight hours and woke up steady.',
      periodTapInCount: 8,
      photoUri: 'https://example.com/proof.jpg',
      progressLabel: 'Week · 50%',
      source: 'home',
      streakDays: 4,
      streakLabel: '4d streak',
    });
  });
});
