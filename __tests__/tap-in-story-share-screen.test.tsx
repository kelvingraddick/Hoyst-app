import React from 'react';
import {Alert, Clipboard, NativeModules, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {TapInStoryTemplateCard} from '../src/features/check-in/components/TapInStoryShareCard';
import {TapInStoryShareScreen} from '../src/features/check-in/screens/TapInStoryShareScreen';
import {setTapInStoryShareNativeModuleAvailabilityForTests} from '../src/features/check-in/services/tap-in-story-share';
import type {RootStackParamList} from '../src/navigation/types';

const mockCaptureRef = jest.fn();
const mockReleaseCapture = jest.fn();
const mockShareOpen = jest.fn();
const mockShareSingle = jest.fn();
const mockCopyImage = jest.fn();

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    INSTAGRAM_APP_ID: 'instagram-app-id',
  },
}));

jest.mock('react-native-linear-gradient', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return ({children, ...props}: {children?: React.ReactNode}) =>
    MockReact.createElement(MockView, props, children);
});

jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
  releaseCapture: (...args: unknown[]) => mockReleaseCapture(...args),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: (...args: unknown[]) => mockShareOpen(...args),
    shareSingle: (...args: unknown[]) => mockShareSingle(...args),
    Social: {
      INSTAGRAM_STORIES: 'instagramstories',
      SNAPCHAT: 'snapchat',
    },
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

async function renderStoryShareScreen(
  params: Partial<RootStackParamList['TapInStoryShare']> = {},
) {
  let tree: renderer.ReactTestRenderer | undefined;

  await act(async () => {
    tree = renderer.create(
      <TapInStoryShareScreen
        navigation={
          {
            goBack: jest.fn(),
          } as never
        }
        route={
          {
            key: 'TapInStoryShare',
            name: 'TapInStoryShare',
            params: {
              circleId: 'circle-1',
              circleTitle: 'Morning Movers',
              commitment: 'Move for 30 minutes',
              inviteUrl: 'https://hoyst.app/join/circle-1',
              memberCount: 4,
              note: 'Finished the set.',
              periodTapInCount: 8,
              progressLabel: 'Week · 50%',
              source: 'home',
              streakDays: 4,
              streakLabel: '4d streak',
              ...params,
            },
          } as never
        }
      />,
      {
        createNodeMock: element => {
          if (element.type === View) {
            return {};
          }

          return null;
        },
      },
    );
  });

  return tree!;
}

async function flushAsyncShareAction() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('TapInStoryShareScreen', () => {
  let alertSpy: jest.SpyInstance;
  let clipboardSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCaptureRef.mockReset();
    mockReleaseCapture.mockReset();
    mockShareOpen.mockReset();
    mockShareSingle.mockReset();
    mockCopyImage.mockReset();
    mockCaptureRef.mockResolvedValue('file:///tmp/hoyst-story.png');
    mockShareOpen.mockResolvedValue({message: 'shared', success: true});
    mockShareSingle.mockResolvedValue({message: 'shared', success: true});
    mockCopyImage.mockResolvedValue(true);
    NativeModules.HoystClipboardImage = {
      copyImage: (...args: unknown[]) => mockCopyImage(...args),
    };
    setTapInStoryShareNativeModuleAvailabilityForTests(true);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    clipboardSpy = jest
      .spyOn(Clipboard, 'setString')
      .mockImplementation(() => undefined);
    clipboardSpy.mockClear();
  });

  afterEach(() => {
    delete NativeModules.HoystClipboardImage;
    setTapInStoryShareNativeModuleAvailabilityForTests(undefined);
    jest.restoreAllMocks();
  });

  it('hides the photo overlay option when no Tap In photo exists', async () => {
    const tree = await renderStoryShareScreen();

    const templateIds = tree.root
      .findAllByType(TapInStoryTemplateCard)
      .map(node => node.props.templateId);

    expect(templateIds).toEqual([
      'designedPost',
      'designedPost',
      'transparentStats',
    ]);
  });

  it('includes the photo overlay option when a Tap In photo exists', async () => {
    const tree = await renderStoryShareScreen({
      photoUri: 'file:///tmp/proof.jpg',
    });

    const templateIds = tree.root
      .findAllByType(TapInStoryTemplateCard)
      .map(node => node.props.templateId);

    expect(templateIds).toContain('photoOverlay');
  });

  it('copies invite links and story images from the destination actions', async () => {
    const tree = await renderStoryShareScreen();

    await act(async () => {
      tree.root.findByProps({accessibilityLabel: 'Copy Link'}).props.onPress();
    });

    expect(clipboardSpy).toHaveBeenLastCalledWith(
      'https://hoyst.app/join/circle-1',
    );
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Link copied',
      'Circle invite link copied to clipboard.',
    );

    clipboardSpy.mockClear();

    await act(async () => {
      tree.root
        .findByProps({accessibilityLabel: 'Copy to Clipboard'})
        .props.onPress();
    });
    await flushAsyncShareAction();

    expect(clipboardSpy).not.toHaveBeenCalled();
    expect(mockCaptureRef).toHaveBeenCalled();
    expect(mockCopyImage).toHaveBeenLastCalledWith(
      'file:///tmp/hoyst-story.png',
    );
    expect(mockReleaseCapture).toHaveBeenLastCalledWith(
      'file:///tmp/hoyst-story.png',
    );
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Image copied',
      'Story image copied to clipboard.',
    );
  });

  it('shares the active story image through Instagram, Snapchat, and More actions', async () => {
    const tree = await renderStoryShareScreen();

    await act(async () => {
      tree.root
        .findByProps({accessibilityLabel: 'Instagram Story'})
        .props.onPress();
    });
    await flushAsyncShareAction();

    expect(mockShareSingle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: 'instagram-app-id',
        backgroundImage: 'file:///tmp/hoyst-story.png',
        social: 'instagramstories',
      }),
    );

    await act(async () => {
      tree.root.findByProps({accessibilityLabel: 'Snapchat'}).props.onPress();
    });
    await flushAsyncShareAction();

    expect(mockShareSingle).toHaveBeenLastCalledWith({
      message:
        'I tapped in with Morning Movers on Hoyst. Join us: https://hoyst.app/join/circle-1',
      social: 'snapchat',
      type: 'image/png',
      url: 'file:///tmp/hoyst-story.png',
    });

    await act(async () => {
      tree.root.findByProps({accessibilityLabel: 'More'}).props.onPress();
    });
    await flushAsyncShareAction();

    expect(mockShareOpen).toHaveBeenLastCalledWith({
      failOnCancel: false,
      message:
        'I tapped in with Morning Movers on Hoyst. Join us: https://hoyst.app/join/circle-1',
      type: 'image/png',
      url: 'file:///tmp/hoyst-story.png',
    });
  });

  it('shows an unavailable state when copying a missing invite link', async () => {
    const tree = await renderStoryShareScreen({inviteUrl: undefined});

    await act(async () => {
      tree.root.findByProps({accessibilityLabel: 'Copy Link'}).props.onPress();
    });

    expect(clipboardSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Circle link unavailable',
      'This Circle does not have a share link yet.',
    );
  });
});
