import React from 'react';
import {
  AccessibilityInfo,
  Alert,
  InteractionManager,
  StyleSheet,
} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystTapInMark} from '../src/design/components/HoystTapInMark';
import {TapInRingMark} from '../src/design/components/TapInRingMark';
import {DSButton, DSInput} from '../src/design/system';
import {TapInCompleteScreen} from '../src/features/check-in/screens/TapInCompleteScreen';
import type {RootStackParamList} from '../src/navigation/types';

const mockSubscribeToMemberCircleDetail = jest.fn((_options: unknown) =>
  jest.fn(),
);
const mockUpdateTapInDetails = jest.fn();
const mockUploadTapInPhoto = jest.fn();
const mockLaunchCamera = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockSubscribeTapInCompletion = jest.fn(
  (
    _uid: string,
    _id: string,
    _receive: (value: unknown) => void,
    _onError: (error: Error) => void,
  ) => jest.fn(),
);
let mockAppearance: 'light' | 'dark' = 'light';

jest.mock('react-native-image-picker', () => ({
  launchCamera: (...args: unknown[]) => mockLaunchCamera(...args),
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('../src/features/check-in/services/check-in-service', () => ({
  subscribeTapInCompletion: (
    ...args: Parameters<typeof mockSubscribeTapInCompletion>
  ) => mockSubscribeTapInCompletion(...args),
  updateTapInDetails: (...args: unknown[]) => mockUpdateTapInDetails(...args),
  uploadTapInPhoto: (...args: unknown[]) => mockUploadTapInPhoto(...args),
}));

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
  useSettingsStore: (
    selector: (state: {appearance: 'light' | 'dark'}) => unknown,
  ) => selector({appearance: mockAppearance}),
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
          addListener: jest.fn(() => jest.fn()),
          canGoBack: jest.fn(() => true),
          dispatch: jest.fn(),
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
            category: 'Fitness',
            circleId: 'circle-1',
            dateKey: '2026-05-29',
            circleTitle: 'Morning Movers',
            completionMomentum: {
              currentStreak: 6,
              streakDelta: 1,
            },
            commitment: 'Move for 30 minutes',
            commitmentType: 'build',
            inviteUrl: 'https://hoyst.app/join/circle-1',
            memberCount: 4,
            members: [],
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

async function renderReadyCompleteScreen(
  params: Partial<RootStackParamList['TapInComplete']> = {},
) {
  let tree: renderer.ReactTestRenderer | undefined;

  await act(async () => {
    tree = renderCompleteScreen(params);
  });

  const layoutTarget = tree!.root.findByProps({
    testID: 'tap-in-complete-content',
  });

  await act(async () => {
    layoutTarget!.props.onLayout();
  });

  return tree!;
}

describe('TapInCompleteScreen', () => {
  beforeEach(() => {
    mockAppearance = 'light';
    mockSubscribeTapInCompletion.mockClear();
    mockSubscribeToMemberCircleDetail.mockClear();
    mockUpdateTapInDetails.mockReset();
    mockUploadTapInPhoto.mockReset();
    mockUploadTapInPhoto.mockResolvedValue(
      'https://example.com/uploaded-proof.jpg',
    );
    mockLaunchCamera.mockResolvedValue({assets: []});
    mockLaunchImageLibrary.mockResolvedValue({assets: []});
    mockUpdateTapInDetails.mockResolvedValue({
      dateKey: '2026-05-29',
      note: 'Saved after the Tap In.',
      photoUrl: null,
    });
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

  it('shows confirmed content without waiting for interactions and replaces rewards when results arrive', async () => {
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation(() => ({cancel: jest.fn()} as never));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCompleteScreen({
        completionId: 'operation-1',
        completionOwnerUid: 'user-1',
        completionProgress: {xpEarned: 10, rewards: {skips: 0, restores: 0}},
        completionMomentum: undefined,
      });
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Tap In complete');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Finalizing Tap In');
    expect(
      tree.root.findByProps({testID: 'tap-in-complete-share-action'}).props
        .disabled,
    ).toBeFalsy();
    expect(JSON.stringify(tree.toJSON())).toContain(
      'Updating streaks and rewards',
    );
    const receive = mockSubscribeTapInCompletion.mock.calls[0][2];
    await act(async () =>
      receive({
        completionId: 'operation-1',
        status: 'complete',
        progress: {xpEarned: 30, rewards: {skips: 1, restores: 0}},
        momentum: {currentStreak: 6, streakDelta: 1},
      }),
    );
    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain('30');
    expect(output).not.toContain('Updating streaks and rewards');
    expect(output).toContain('+1 day Daily Tap In streak');
    await act(async () =>
      receive({
        completionId: 'operation-1',
        status: 'complete',
        progress: {xpEarned: 30, rewards: {skips: 1, restores: 0}},
      }),
    );
    expect(JSON.stringify(tree.toJSON())).not.toContain('+40');
    await act(async () => tree.unmount());
  });

  it.each([
    {
      name: 'partial personal progress',
      circleMode: 'personal' as const,
      status: 'partial' as const,
      currentValue: 0,
      xpEarned: 0,
    },
    {
      name: 'covered group progress with bonus XP',
      circleMode: 'group' as const,
      status: 'done' as const,
      currentValue: undefined,
      xpEarned: 30,
    },
  ])(
    'keeps confirmation, details and actions stable when $name resolves',
    async ({circleMode, status, currentValue, xpEarned}) => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderCompleteScreen({
          completionId: 'layout-1',
          completionOwnerUid: 'user-1',
          circleMode,
          status,
          currentValue,
          targetValue: 3,
          unitLabel: 'Tap Ins',
          completionMomentum: undefined,
          completionProgress: {
            xpEarned: status === 'done' ? 10 : 0,
            rewards: {skips: 0, restores: 0},
          },
        });
      });
      const findNode = (testID: string) => {
        const visit = (
          node: renderer.ReactTestRendererJSON,
        ): renderer.ReactTestRendererJSON | undefined => {
          if (node.props.testID === testID) {
            return node;
          }
          for (const child of node.children ?? []) {
            if (typeof child === 'string') {
              continue;
            }
            const found = visit(child);
            if (found) {
              return found;
            }
          }
          return undefined;
        };
        const output = tree.toJSON();
        return (Array.isArray(output) ? output : output ? [output] : [])
          .map(visit)
          .find(Boolean)!;
      };
      const readStableContent = () =>
        JSON.stringify([
          findNode('tap-in-complete-title'),
          findNode('tap-in-complete-status'),
          findNode('tap-in-complete-details'),
          findNode('tap-in-complete-action-dock'),
        ]);
      const before = readStableContent();
      const reduceMotionChecks = jest.mocked(
        AccessibilityInfo.isReduceMotionEnabled,
      ).mock.calls.length;
      const summary = {
        version: 2,
        revision: 'layout-test',
        asOfDateKey: '2026-05-29',
        cadence: 'daily',
        period: {key: '2026-05-29', start: '2026-05-29', end: '2026-05-29'},
        streak: {
          count: status === 'done' ? 1 : 0,
          unit: 'day',
          availability: 'ready',
        },
        progress: {
          covered: status === 'done' ? 1 : 0,
          required: 1,
          outcome: status === 'done' ? 'secured' : 'open',
        },
      };
      await act(async () =>
        mockSubscribeTapInCompletion.mock.calls[0][2]({
          completionId: 'layout-1',
          status: 'complete',
          circleProgress: {
            viewer: summary,
            ...(circleMode === 'group' ? {group: summary} : {}),
            viewerStreakDelta: 1,
          },
          progress: {xpEarned, rewards: {skips: 1, restores: 0}},
          momentum: {currentStreak: 1, streakDelta: 1},
        }),
      );
      expect(readStableContent()).toBe(before);
      const feedback = JSON.stringify(findNode('tap-in-complete-feedback'));
      expect(feedback).toContain('Your streak');
      expect(feedback).not.toContain('Updating streaks and rewards');
      if (circleMode === 'group') {
        expect(feedback).toContain('Group streak');
        expect(feedback).toContain('Your Circle streak extended');
        expect(feedback).toContain('30');
      }
      const sections = findNode('tap-in-complete-content').children?.flatMap(
        child => (typeof child === 'string' ? [] : [child.props.testID]),
      );
      expect(sections?.slice(-2)).toEqual([
        'tap-in-complete-details',
        'tap-in-complete-feedback',
      ]);
      expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(
        reduceMotionChecks,
      );
      await act(async () => tree.unmount());
    },
  );

  it('keeps actions available after ten seconds and ignores results after unmount', async () => {
    jest.useFakeTimers();
    let tree!: renderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = renderCompleteScreen({
          completionId: 'slow-1',
          completionOwnerUid: 'user-1',
        });
      });
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(JSON.stringify(tree.toJSON())).toContain(
        'Progress is still updating',
      );
      expect(
        tree.root.findByProps({testID: 'tap-in-complete-share-action'}).props
          .disabled,
      ).toBeFalsy();
      const unsubscribe = mockSubscribeTapInCompletion.mock.results[0].value;
      const receive = mockSubscribeTapInCompletion.mock.calls[0][2];
      await act(async () => tree.unmount());
      expect(unsubscribe).toHaveBeenCalled();
      receive({completionId: 'slow-1', status: 'complete'});
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not subscribe to a completion owned by another session', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderCompleteScreen({
        completionId: 'other-1',
        completionOwnerUid: 'other-user',
      });
    });
    expect(mockSubscribeTapInCompletion).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('renders completion from route snapshot before detail subscription emits', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    expect(mockSubscribeToMemberCircleDetail).toHaveBeenCalledTimes(1);

    const layoutTarget = tree!.root.findByProps({
      testID: 'tap-in-complete-content',
    });

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Tap In complete');
    expect(output).toContain('+1 day Daily Tap In streak');
    expect(output).toContain('6 now');
    expect(output).toContain('Move for 30 minutes');
    expect(output).toContain('Share as story');
    expect(output).toContain('Add details');
    expect(output).toContain('Done');
    expect(output).not.toContain('Finalizing Tap In');
    expect(output).not.toContain('Loading Tap In details');
    expect(output).not.toContain('Loading your circle');

    expect(
      tree!.root.findByProps({testID: 'tap-in-complete-circle-title'}).props
        .variant,
    ).toBe('screenTitle');
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({testID: 'tap-in-complete-title'}).props.style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 26, lineHeight: 31}));
    expect(
      tree!.root.findByProps({testID: 'tap-in-complete-status'}).props.variant,
    ).toBe('secondary');
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({
          testID: 'tap-in-complete-share-action-label',
        }).props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 21,
      }),
    );
    expect(
      StyleSheet.flatten(
        tree!.root.findByProps({
          testID: 'tap-in-complete-share-action-face',
        }).props.style,
      ),
    ).toEqual(
      expect.objectContaining({backgroundColor: '#5A1CFF', minHeight: 56}),
    );
    expect(
      tree!.root.findByProps({testID: 'tap-in-complete-commitment'}).props
        .variant,
    ).toBe('body');

    const disclosure = tree!.root.findByProps({
      testID: 'tap-in-details-disclosure',
    });
    expect(disclosure.props.title).toBe('Add details');
    expect(disclosure.props.subtitle).toBe('Optional note or photo');

    expect(
      tree!.root.findByProps({testID: 'tap-in-complete-category-fade'}),
    ).toBeTruthy();
    const dock = tree!.root.findByProps({
      testID: 'tap-in-complete-action-dock',
    });
    expect(StyleSheet.flatten(dock.props.style)).toEqual(
      expect.objectContaining({paddingBottom: 16, paddingHorizontal: 22}),
    );
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

  it('uses the selected dark canvas for the local completion presentation', async () => {
    mockAppearance = 'dark';
    const tree = await renderReadyCompleteScreen();

    expect(JSON.stringify(tree.toJSON())).toContain(
      '"backgroundColor":"#121212"',
    );
  });

  it('renders covered Build quantity completion context', async () => {
    const tree = await renderReadyCompleteScreen({
      commitmentType: 'build',
      coverageStatus: 'covered',
      currentValue: 5,
      status: 'done',
      targetValue: 5,
      unitLabel: 'pages',
    });

    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Tap In complete');
    expect(output).toContain('Goal covered');
    expect(output).toContain('5 pages logged');
    expect(output).toContain('Goal 5 pages');
    expect(output).toContain('Share as story');
    expect(
      tree.root.findByProps({testID: 'tap-in-complete-commitment-type'}).props
        .children,
    ).toBe(' · BUILD');
    expect(
      tree.root.findByProps({testID: 'tap-in-complete-particles'}),
    ).toBeTruthy();
  });

  it('renders partial Build quantity completion context', async () => {
    const tree = await renderReadyCompleteScreen({
      commitmentType: 'build',
      coverageStatus: 'partial',
      currentValue: 3,
      status: 'partial',
      targetValue: 5,
      unitLabel: 'pages',
    });

    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Progress Saved');
    expect(output).toContain('Keep building');
    expect(output).toContain('3 pages logged');
    expect(output).toContain('Goal 5 pages');
    expect(output).toContain('No note added. Your Progress was saved.');
    expect(output).toContain('Share as story');
    expect(
      tree.root.findByProps({testID: 'tap-in-complete-commitment-type'}).props
        .children,
    ).toBe(' · BUILD');
    expect(
      tree.root.findAllByProps({testID: 'tap-in-complete-particles'}),
    ).toHaveLength(0);
  });

  it('renders failed Limit quantity completion context with story sharing', async () => {
    const tree = await renderReadyCompleteScreen({
      commitmentType: 'limit',
      coverageStatus: 'failed',
      currentValue: 8,
      maximumValue: 6,
      minimumValue: 2,
      status: 'failed',
      unitLabel: 'servings',
    });

    const output = JSON.stringify(tree.toJSON());

    expect(output).toContain('Tap In Saved');
    expect(output).toContain('Outside Goal range');
    expect(output).toContain('8 servings logged');
    expect(output).toContain('Goal range 2 to 6 servings');
    expect(output).toContain('No note added. Your Tap In was saved.');
    expect(output).toContain('Share as story');
    expect(
      tree.root.findByProps({testID: 'tap-in-complete-commitment-type'}).props
        .children,
    ).toBe(' · LIMIT');
    expect(
      tree.root.findAllByProps({testID: 'tap-in-complete-particles'}),
    ).toHaveLength(0);
  });

  it('opens the dedicated story share screen from Share as story', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = renderCompleteScreen();
    });

    const layoutTarget = tree!.root.findByProps({
      testID: 'tap-in-complete-content',
    });

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const navigation =
      tree!.root.findByType(TapInCompleteScreen).props.navigation;
    const shareButton = tree!.root.findByProps({
      testID: 'tap-in-complete-share-action',
    });

    await act(async () => {
      shareButton!.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith(
      'TapInStoryShare',
      expect.objectContaining({
        category: 'Fitness',
        circleId: 'circle-1',
        dateKey: '2026-05-29',
        status: 'done',
        circleTitle: 'Morning Movers',
        commitment: 'Move for 30 minutes',
        commitmentType: 'build',
        inviteUrl: 'https://hoyst.app/join/circle-1',
        memberCount: 4,
        members: [],
        photoUri: undefined,
        source: 'home',
      }),
    );
  });

  it('saves notes on the Tap In without including them in story sharing', async () => {
    const tree = await renderReadyCompleteScreen();

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-disclosure'})
        .props.onPress();
    });

    const noteInput = tree.root.findByType(DSInput);

    await act(async () => {
      noteInput.props.onChangeText('Saved after the Tap In.');
    });

    const saveButton = tree.root
      .findAllByType(DSButton)
      .find(button => button.props.label === 'Save Details');

    await act(async () => {
      saveButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdateTapInDetails).toHaveBeenCalledWith({
      circleId: 'circle-1',
      note: 'Saved after the Tap In.',
      photoUrl: null,
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Saved after the Tap In.');
    expect(JSON.stringify(tree.toJSON())).toContain('Edit details');

    const navigation =
      tree.root.findByType(TapInCompleteScreen).props.navigation;
    const shareButton = tree.root.findByProps({
      testID: 'tap-in-complete-share-action',
    });

    await act(async () => {
      shareButton!.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith(
      'TapInStoryShare',
      expect.objectContaining({dateKey: '2026-05-29'}),
    );
    expect(navigation.navigate.mock.calls.at(-1)?.[1]).not.toHaveProperty(
      'note',
    );
  });

  it('shows selected proof immediately and saves it after Tap In completion', async () => {
    mockUpdateTapInDetails.mockResolvedValueOnce({
      dateKey: '2026-05-29',
      note: null,
      photoUrl: 'https://example.com/uploaded-proof.jpg',
    });
    const tree = await renderReadyCompleteScreen({
      photoUri: 'file:///proof.jpg',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadTapInPhoto).toHaveBeenCalledWith({
      circleId: 'circle-1',
      dateKey: '2026-05-29',
      uid: 'user-1',
      uri: 'file:///proof.jpg',
    });
    expect(mockUpdateTapInDetails).toHaveBeenCalledWith({
      circleId: 'circle-1',
      note: null,
      photoUrl: 'https://example.com/uploaded-proof.jpg',
    });
    expect(JSON.stringify(tree.toJSON())).toContain(
      'https://example.com/uploaded-proof.jpg',
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Edit details');
  });

  it('waits for an active photo save before completing Done', async () => {
    let resolveUpload: ((photoUrl: string) => void) | undefined;
    mockUploadTapInPhoto.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          resolveUpload = resolve;
        }),
    );
    mockUpdateTapInDetails.mockResolvedValueOnce({
      dateKey: '2026-05-29',
      note: null,
      photoUrl: 'https://example.com/done-proof.jpg',
    });
    const tree = await renderReadyCompleteScreen({
      photoUri: 'file:///proof.jpg',
    });
    const navigation =
      tree.root.findByType(TapInCompleteScreen).props.navigation;

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-complete-done-action'})
        .props.onPress();
    });

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('Saving Photo...');

    await act(async () => {
      resolveUpload?.('https://example.com/done-proof.jpg');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('waits for an active photo save before opening Share as story', async () => {
    let resolveUpload: ((photoUrl: string) => void) | undefined;
    mockUploadTapInPhoto.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          resolveUpload = resolve;
        }),
    );
    mockUpdateTapInDetails.mockResolvedValueOnce({
      dateKey: '2026-05-29',
      note: null,
      photoUrl: 'https://example.com/shared-proof.jpg',
    });
    const tree = await renderReadyCompleteScreen({
      photoUri: 'file:///proof.jpg',
    });
    const navigation =
      tree.root.findByType(TapInCompleteScreen).props.navigation;

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-complete-share-action'})
        .props.onPress();
    });

    expect(navigation.navigate).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpload?.('https://example.com/shared-proof.jpg');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.navigate).toHaveBeenCalledWith(
      'TapInStoryShare',
      expect.objectContaining({
        photoUri: 'https://example.com/shared-proof.jpg',
      }),
    );
  });

  it('keeps a failed proof upload retryable without rolling back the Tap In', async () => {
    mockUploadTapInPhoto
      .mockRejectedValueOnce(new Error('Upload unavailable'))
      .mockResolvedValueOnce('https://example.com/retried-proof.jpg');
    mockUpdateTapInDetails.mockResolvedValueOnce({
      dateKey: '2026-05-29',
      note: null,
      photoUrl: 'https://example.com/retried-proof.jpg',
    });
    const tree = await renderReadyCompleteScreen({
      photoUri: 'file:///proof.jpg',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(JSON.stringify(tree.toJSON())).toContain('Retry photo upload');
    expect(JSON.stringify(tree.toJSON())).toContain('file:///proof.jpg');
    expect(
      tree.root.findByProps({testID: 'tap-in-details-disclosure'}).props.title,
    ).toBe('Retry photo upload');

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-disclosure'})
        .props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadTapInPhoto).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).toContain(
      'https://example.com/retried-proof.jpg',
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Edit details');
  });

  it('offers retry or leave without a photo after a queued retry fails', async () => {
    mockUploadTapInPhoto
      .mockRejectedValueOnce({
        code: 'storage/unauthorized',
        message:
          '[storage/unauthorized] User is not authorized to perform the desired action.',
      })
      .mockRejectedValueOnce({
        code: 'storage/unauthorized',
        message:
          '[storage/unauthorized] User is not authorized to perform the desired action.',
      });
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const tree = await renderReadyCompleteScreen({
      photoUri: 'file:///proof.jpg',
    });
    const navigation =
      tree.root.findByType(TapInCompleteScreen).props.navigation;

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-complete-done-action'})
        .props.onPress();
    });

    const firstButtons = alertSpy.mock.calls.at(-1)?.[2] as
      | Array<{onPress?: () => void; text?: string}>
      | undefined;

    expect(alertSpy).toHaveBeenLastCalledWith(
      'Photo not uploaded',
      'Your Tap In is saved, but the photo still needs another try.',
      expect.any(Array),
    );

    await act(async () => {
      firstButtons?.find(button => button.text === 'Retry Photo')?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadTapInPhoto).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Photo not uploaded',
      'Your Tap In is saved, but the photo still needs another try.',
      expect.any(Array),
    );
    expect(JSON.stringify(alertSpy.mock.calls)).not.toContain(
      'storage/unauthorized',
    );

    const secondButtons = alertSpy.mock.calls.at(-1)?.[2] as
      | Array<{onPress?: () => void; text?: string}>
      | undefined;

    await act(async () => {
      secondButtons
        ?.find(button => button.text === 'Leave Without Photo')
        ?.onPress?.();
    });

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('shows friendly copy when an explicitly saved photo upload is rejected', async () => {
    mockLaunchCamera.mockResolvedValueOnce({
      assets: [{uri: 'file:///details-proof.jpg'}],
    });
    mockUploadTapInPhoto.mockRejectedValueOnce({
      code: 'storage/unauthorized',
      message:
        '[storage/unauthorized] User is not authorized to perform the desired action.',
    });
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const tree = await renderReadyCompleteScreen();

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-disclosure'})
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-photo-picker'})
        .props.onPress();
      const photoActions = alertSpy.mock.calls.at(-1)?.[2] as
        | Array<{onPress?: () => void; text?: string}>
        | undefined;
      photoActions?.find(button => button.text === 'Take Photo')?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root
        .findAllByType(DSButton)
        .find(button => button.props.label === 'Save Details')
        ?.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Could not save details',
      "We couldn't upload this photo. Try again in a moment.",
    );
    expect(JSON.stringify(alertSpy.mock.calls)).not.toContain(
      'storage/unauthorized',
    );
    expect(
      tree.root.findByProps({testID: 'tap-in-details-photo-preview'}),
    ).toBeTruthy();
  });

  it('clears an existing note and photo with explicit nullable fields', async () => {
    mockUpdateTapInDetails.mockResolvedValueOnce({
      dateKey: '2026-05-29',
      note: null,
      photoUrl: null,
    });
    const tree = await renderReadyCompleteScreen({
      note: 'Existing proof note',
      photoUri: 'https://example.com/proof.jpg',
    });

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-disclosure'})
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByType(DSInput).props.onChangeText('');
      tree.root
        .findByProps({accessibilityLabel: 'Remove photo'})
        .props.onPress();
    });

    const saveButton = tree.root
      .findAllByType(DSButton)
      .find(button => button.props.label === 'Save Details');

    await act(async () => {
      saveButton!.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdateTapInDetails).toHaveBeenCalledWith({
      circleId: 'circle-1',
      note: null,
      photoUrl: null,
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Add details');
  });

  it('protects unsaved detail edits when leaving completion', async () => {
    const tree = await renderReadyCompleteScreen();
    const navigation =
      tree.root.findByType(TapInCompleteScreen).props.navigation;

    await act(async () => {
      tree.root
        .findByProps({testID: 'tap-in-details-disclosure'})
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByType(DSInput).props.onChangeText('Unsaved context');
    });

    const beforeRemove = navigation.addListener.mock.calls
      .filter(([eventName]: [string]) => eventName === 'beforeRemove')
      .at(-1)?.[1];
    const preventDefault = jest.fn();
    const action = {type: 'GO_BACK'};
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    await act(async () => {
      beforeRemove({data: {action}, preventDefault});
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard detail changes?',
      'Your note or photo is not saved yet.',
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls.at(-1)?.[2];

    await act(async () => {
      buttons?.[1]?.onPress?.();
    });

    expect(navigation.dispatch).toHaveBeenCalledWith(action);
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

    const layoutTarget = tree!.root.findByProps({
      testID: 'tap-in-complete-content',
    });

    await act(async () => {
      layoutTarget!.props.onLayout();
    });

    const output = JSON.stringify(tree!.toJSON());

    expect(output).toContain('Skip Recorded');
    expect(output).toContain('Skip used');
    expect(output).toContain('6 days Daily Tap In streak held');
    expect(output).toContain(
      'No note added. Your skip still protects this opportunity.',
    );
    expect(output).not.toContain('Share as story');
    expect(output).not.toContain('Add details');
  });
});
