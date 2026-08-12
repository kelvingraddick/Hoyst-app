import React from 'react';
import {Alert, Image, Pressable, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {CommitmentTypePill} from '../src/design/components/CommitmentTypeVisual';
import {TapInActionButton} from '../src/design/components/TapInActionButton';
import {TapInComposerScreen} from '../src/features/check-in/screens/TapInComposerScreen';
import {useHoyFeedbackStore} from '../src/store/hoy-feedback-store';
import type {CircleDetailModel} from '../src/types/models';

const mockSubmitTapIn = jest.fn();
const mockRemoveTapIn = jest.fn();
const mockSubscribeToMemberCircleDetail = jest.fn();
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockNavigationListeners: Record<
  string,
  (event: {data: {index: number; stable: boolean}}) => void
> = {};

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
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: (...args: unknown[]) => mockLaunchCamera(...args),
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
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
  const addListener = jest.fn(
    (
      eventName: string,
      listener: (event: {data: {index: number; stable: boolean}}) => void,
    ) => {
      mockNavigationListeners[eventName] = listener;
      return jest.fn();
    },
  );

  return renderer.create(
    <TapInComposerScreen
      navigation={
        {
          addListener,
          dispatch: jest.fn(),
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
    useHoyFeedbackStore.setState({pendingTapInCelebration: undefined});
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
    mockLaunchCamera.mockReset();
    mockLaunchImageLibrary.mockReset();
    Object.keys(mockNavigationListeners).forEach(key => {
      delete mockNavigationListeners[key];
    });
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
    expect(
      tree!.root.findByProps({testID: 'tap-in-composer-circle-title'}).props
        .children,
    ).toBe('Morning Movers');
    expect(
      tree!.root.findByProps({testID: 'tap-in-composer-commitment'}).props
        .children,
    ).toBe('Move for 30 minutes');
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({testID: 'tap-in-composer-close-row'}).props
          .style,
      ),
    ).toEqual(
      expect.objectContaining({height: 54, marginBottom: -38, paddingTop: 16}),
    );
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Circle Commitment');
    const confirmButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Tap In');
    const actionFooter = tree!.root.findByProps({
      testID: 'tap-in-composer-action-footer',
    });

    expect(confirmButton?.props.variant).toBe('primary');
    expect(confirmButton?.props.emphasis).toBe('spectrumBreathing');
    expect(
      actionFooter
        .findAllByType(TapInActionButton)
        .map(button => button.props.label),
    ).toEqual(['Tap In']);
    expect(StyleSheet.flatten(actionFooter.props.style)).toEqual(
      expect.objectContaining({gap: 24}),
    );
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({
          testID: 'tap-in-composer-action-footer-position',
        }).props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        paddingBottom: 8,
        paddingTop: 10,
      }),
    );
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({
          testID: 'tap-in-composer-action-footer-position',
        }).props.style,
      ).position,
    ).toBeUndefined();
    expect(
      tree!.root.findByType(CommitmentTypePill).props.commitmentType,
    ).toBe('build');

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
      commitmentType: 'build',
      inviteUrl: 'https://hoyst.app/join/circle-1',
      memberCount: 4,
      dateKey: '2026-05-29',
      periodTapInCount: 8,
      progressLabel: 'Week · 50%',
      source: 'home',
      status: 'done',
      streakDays: 4,
      streakLabel: '4d streak',
    });
    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toEqual({
      circleId: 'circle-1',
      dateKey: '2026-05-29',
      uid: 'user-1',
    });
  });

  it('keeps the action footer anchored when the sheet expands', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const compactHeight = StyleSheet.flatten(
      tree!.root.findByProps({testID: 'tap-in-composer-sheet-frame'}).props
        .style,
    ).height;

    act(() => {
      mockNavigationListeners.sheetDetentChange({
        data: {index: 1, stable: true},
      });
    });

    const expandedHeight = StyleSheet.flatten(
      tree!.root.findByProps({testID: 'tap-in-composer-sheet-frame'}).props
        .style,
    ).height;

    expect(expandedHeight).toBeGreaterThan(compactHeight);
    expect(
      tree!.root.findByProps({testID: 'tap-in-composer-action-footer'}),
    ).toBeTruthy();
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
      .find(button => button.props.label === 'Tap In');

    expect(output).toContain('COMMITMENT COMPLETE');
    expect(confirmButton).toBeTruthy();
    expect(confirmButton?.props.disabled).toBe(false);
  });

  it('uses Tap In for an Avoid confirmation', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'avoid',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const confirmButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Tap In');
    const typePill = tree!.root.findByType(CommitmentTypePill);
    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;

    expect(confirmButton).toBeTruthy();
    expect(typePill.props.commitmentType).toBe('avoid');
    expect(JSON.stringify(tree!.toJSON())).not.toContain("Today's Progress");

    await act(async () => {
      confirmButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.replace).toHaveBeenCalledWith(
      'TapInComplete',
      expect.objectContaining({commitmentType: 'avoid', status: 'done'}),
    );
  });

  it('uses Log Progress for a first Limit quantity save', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'limit',
      currentValue: 0,
      maximumValue: 4,
      unitLabel: 'drinks',
      viewerTodayStatus: undefined,
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const confirmButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Log Progress');

    expect(confirmButton).toBeTruthy();
    expect(tree!.root.findByType(CommitmentTypePill).props.commitmentType).toBe(
      'limit',
    );
    expect(JSON.stringify(tree!.toJSON())).toContain("Today's Progress");
  });

  it('uses Update Progress when reopening a saved Limit quantity', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'limit',
      currentValue: 5,
      maximumValue: 4,
      unitLabel: 'drinks',
      viewerCanUpdateTapIn: true,
      viewerHasTappedInToday: true,
      viewerTodayCheckIn: {
        coverageStatus: 'failed',
        currentValue: 5,
        status: 'failed',
      },
      viewerTodayStatus: 'failed',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const confirmButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Update Progress');

    expect(confirmButton).toBeTruthy();
    expect(confirmButton?.props.disabled).toBe(false);
  });

  it('opens the completion screen after a first quantity Tap In save', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'build',
      currentValue: 0,
      targetValue: 3,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: false,
      viewerRemainingTapIns: 1,
      viewerTodayStatus: undefined,
    };
    mockSubmitTapIn.mockResolvedValueOnce({
      checkInId: 'user-1',
      coverageStatus: 'covered',
      currentValue: 3,
      dateKey: '2026-05-29',
      momentum: {
        currentStreak: 6,
        streakDelta: 1,
      },
      status: 'done',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const progressButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Log Progress');

    expect(progressButton).toBeTruthy();

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        tree!.root
          .findByProps({accessibilityLabel: 'Increase quantity'})
          .props.onPress();
      });
    }

    await act(async () => {
      progressButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSubmitTapIn).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        currentValue: 3,
        status: 'done',
      }),
    );
    expect(navigation.replace).toHaveBeenCalledWith(
      'TapInComplete',
      expect.objectContaining({
        circleId: 'circle-1',
        commitmentType: 'build',
        coverageStatus: 'covered',
        currentValue: 3,
        source: 'home',
        status: 'done',
        targetValue: 3,
        unitLabel: 'pages',
      }),
    );
    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toEqual({
      circleId: 'circle-1',
      dateKey: '2026-05-29',
      uid: 'user-1',
    });
  });

  it('does not queue Hoy for a failed quantity Tap In', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'limit',
      currentValue: 0,
      maximumValue: 4,
      stepValue: 1,
      unitLabel: 'drinks',
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: false,
      viewerRemainingTapIns: 1,
      viewerTodayStatus: undefined,
    };
    mockSubmitTapIn.mockResolvedValueOnce({
      checkInId: 'user-1',
      coverageStatus: 'failed',
      currentValue: 5,
      dateKey: '2026-05-29',
      status: 'failed',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    for (let index = 0; index < 5; index += 1) {
      await act(async () => {
        tree!.root
          .findByProps({accessibilityLabel: 'Increase quantity'})
          .props.onPress();
      });
    }

    const progressButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Log Progress');

    await act(async () => {
      progressButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();
  });

  it('opens the completion screen after updating a saved quantity Tap In', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'build',
      currentValue: 2,
      stepValue: 1,
      targetValue: 5,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 1,
      viewerTodayCheckIn: {
        coverageStatus: 'partial',
        currentValue: 2,
        status: 'partial',
      },
      viewerTodayStatus: 'partial',
    };
    mockSubmitTapIn.mockResolvedValueOnce({
      checkInId: 'user-1',
      coverageStatus: 'partial',
      currentValue: 3,
      dateKey: '2026-05-29',
      status: 'partial',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const increaseButton = tree!.root.findByProps({
      accessibilityLabel: 'Increase quantity',
    });
    const updateButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Update Progress');

    expect(JSON.stringify(tree!.toJSON())).toContain("Today's Progress");
    expect(updateButton?.props.disabled).toBe(false);

    await act(async () => {
      increaseButton.props.onPress();
    });

    await act(async () => {
      updateButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSubmitTapIn).toHaveBeenCalledWith(
      expect.objectContaining({
        circleId: 'circle-1',
        currentValue: 3,
        status: 'done',
      }),
    );
    expect(navigation.replace).toHaveBeenCalledWith(
      'TapInComplete',
      expect.objectContaining({
        circleId: 'circle-1',
        commitmentType: 'build',
        coverageStatus: 'partial',
        currentValue: 3,
        source: 'home',
        status: 'partial',
        targetValue: 5,
        unitLabel: 'pages',
      }),
    );
    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();
  });

  it('queues Hoy when partial progress becomes covered', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'build',
      currentValue: 2,
      stepValue: 1,
      targetValue: 3,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 1,
      viewerTodayCheckIn: {
        coverageStatus: 'partial',
        currentValue: 2,
        status: 'partial',
      },
      viewerTodayStatus: 'partial',
    };
    mockSubmitTapIn.mockResolvedValueOnce({
      checkInId: 'user-1',
      coverageStatus: 'covered',
      currentValue: 3,
      dateKey: '2026-05-29',
      status: 'done',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    await act(async () => {
      tree!.root
        .findByProps({accessibilityLabel: 'Increase quantity'})
        .props.onPress();
    });

    const updateButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Update Progress');

    await act(async () => {
      updateButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toEqual({
      circleId: 'circle-1',
      dateKey: '2026-05-29',
      uid: 'user-1',
    });
  });

  it('does not queue Hoy when editing an already-covered quantity Tap In', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'limit',
      currentValue: 3,
      maximumValue: 4,
      stepValue: 1,
      unitLabel: 'drinks',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerTodayCheckIn: {
        coverageStatus: 'covered',
        currentValue: 3,
        status: 'done',
      },
      viewerTodayStatus: 'done',
    };
    mockSubmitTapIn.mockResolvedValueOnce({
      checkInId: 'user-1',
      coverageStatus: 'covered',
      currentValue: 4,
      dateKey: '2026-05-29',
      status: 'done',
    });
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    await act(async () => {
      tree!.root
        .findByProps({accessibilityLabel: 'Increase quantity'})
        .props.onPress();
    });

    const updateButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Update Progress');

    await act(async () => {
      updateButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();
  });

  it('allows removing a saved quantity Tap In from the update composer', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'build',
      currentValue: 2,
      targetValue: 5,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: false,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 1,
      viewerTodayCheckIn: {
        coverageStatus: 'partial',
        currentValue: 2,
        status: 'partial',
      },
      viewerTodayStatus: 'partial',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const actionButtons = tree!.root.findAllByType(TapInActionButton);
    const updateButton = actionButtons.find(
      button => button.props.label === 'Update Progress',
    );
    const removeButton = actionButtons.find(
      button => button.props.label === 'Remove Tap In',
    );

    expect(JSON.stringify(tree!.toJSON())).toContain("Today's Progress");
    expect(updateButton).toBeTruthy();
    expect(removeButton?.props.variant).toBe('dangerOutline');

    await act(async () => {
      removeButton!.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Remove today?',
      "Removing this will delete today's saved quantity and reopen this Opportunity.",
      expect.arrayContaining([
        expect.objectContaining({text: 'Keep'}),
        expect.objectContaining({style: 'destructive', text: 'Remove'}),
      ]),
    );

    const latestAlert = alertSpy.mock.calls.find(
      call => call[0] === 'Remove today?',
    );
    const removeAlertButton = (
      latestAlert?.[2] as Array<{onPress?: () => void; text?: string}>
    ).find(button => button.text === 'Remove');

    await act(async () => {
      removeAlertButton?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRemoveTapIn).toHaveBeenCalledWith({circleId: 'circle-1'});
    expect(navigation.goBack).toHaveBeenCalled();
    alertSpy.mockRestore();
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
    const actionFooter = tree!.root.findByProps({
      testID: 'tap-in-composer-action-footer',
    });

    expect(skipButton?.props.disabled).toBe(false);
    expect(actionFooter.findAllByType(Pressable)).toContain(skipButton);

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
    expect(
      useHoyFeedbackStore.getState().pendingTapInCelebration,
    ).toBeUndefined();
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

    expect(output).toContain('SAVED TODAY');
    expect(output).toContain('Morning Movers');
    expect(output).toContain("Today's proof");
    expect(output).not.toContain('Already tapped in');
    expect(output).toContain('No note added. Your Tap In still counts.');
    expect(tree!.root.findAllByType(HoystTapInMark).length).toBeGreaterThan(0);
    expect(shareButton?.props.variant).toBe('accentOutline');
    expect(removeButton?.props.variant).toBe('dangerOutline');
    expect(removeButton?.props.disabled).toBe(false);
    expect(
      actionButtons
        .map(button => button.props.label)
        .filter((label: string) =>
          ['Share Story', 'Remove Tap In'].includes(label),
        ),
    ).toEqual(['Share Story', 'Remove Tap In']);

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
        dateKey: '2026-05-29',
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
    expect(
      tree!.root.findByProps({testID: 'tap-in-details-disclosure'}),
    ).toBeTruthy();

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

  it('keeps optional photo controls out of quantity logging', async () => {
    mockDetail = {
      ...baseMockDetail,
      commitmentType: 'build',
      currentValue: 0,
      targetValue: 3,
      unitLabel: 'pages',
    };
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain("Today's Progress");
    expect(output).not.toContain('Optional Note');
    expect(output).not.toContain('Add Photo');
    expect(output).not.toContain('Take Photo');
    expect(output).not.toContain('Choose Photo');
  });

  it('adds optional proof to a non-quantity Tap In from one photo action', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      assets: [{uri: 'file:///proof.jpg'}],
    });
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderComposerScreen();
    });

    expect(tree!.root.findByProps({testID: 'photo-picker-add'})).toBeTruthy();

    const photoButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Add Photo');

    expect(photoButton?.props.variant).toBe('surface');

    await act(async () => {
      tree!.root.findByProps({testID: 'photo-picker-add'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Add Photo',
      'Choose a photo source.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Take Photo'}),
        expect.objectContaining({text: 'Choose from Library'}),
      ]),
    );

    const sourceButtons = alertSpy.mock.calls.at(-1)?.[2] as Array<{
      onPress?: () => void;
      text?: string;
    }>;

    await act(async () => {
      sourceButtons
        .find(button => button.text === 'Choose from Library')
        ?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findByProps({testID: 'photo-picker-preview'}),
    ).toBeTruthy();

    const navigation =
      tree!.root.findByType(TapInComposerScreen).props.navigation;
    const submitButton = tree!.root
      .findAllByType(TapInActionButton)
      .find(button => button.props.label === 'Tap In');

    await act(async () => {
      submitButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.replace).toHaveBeenCalledWith(
      'TapInComplete',
      expect.objectContaining({photoUri: 'file:///proof.jpg', status: 'done'}),
    );
    alertSpy.mockRestore();
  });
});
