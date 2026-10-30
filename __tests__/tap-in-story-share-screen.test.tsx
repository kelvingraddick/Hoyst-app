import React from 'react';
import {Alert, Clipboard, NativeModules, ScrollView, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {BrandMark} from '../src/design/components/BrandMark';
import {Flame} from 'lucide-react-native';
import {HoystText} from '../src/design/components/HoystText';
import {TapInStoryTemplateCard} from '../src/features/check-in/components/TapInStoryShareCard';
import {TapInStoryShareScreen} from '../src/features/check-in/screens/TapInStoryShareScreen';
import {setTapInStoryShareNativeModuleAvailabilityForTests} from '../src/features/check-in/services/tap-in-story-share';
import type {RootStackParamList} from '../src/navigation/types';

const mockCaptureRef = jest.fn();
const mockReleaseCapture = jest.fn();
const mockShareOpen = jest.fn();
const mockShareSingle = jest.fn();
const mockCopyImage = jest.fn();
const mockLoadStoryContext = jest.fn();

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

jest.mock('../src/features/check-in/services/tap-in-story-context', () => ({
  loadTapInStoryContext: (...args: unknown[]) => mockLoadStoryContext(...args),
  unavailableTapInStoryContext: (params: {
    dateKey: string;
    status?: string;
  }) => ({tapIn: params}),
}));
jest.mock('../src/store/session-store', () => ({
  useSessionStore: (selector: (state: {user: {uid: string}}) => unknown) =>
    selector({user: {uid: 'user-1'}}),
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
              category: 'Fitness',
              circleId: 'circle-1',
              circleTitle: 'Morning Movers',
              commitment: 'Move for 30 minutes',
              commitmentType: 'build',
              inviteUrl: 'https://hoyst.app/join/circle-1',
              memberCount: 4,
              members: [],
              dateKey: '2026-10-17',
              status: 'done',
              source: 'home',
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

  it('retains the selected story on resize without cancelling dot navigation animation', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    const tree = await renderStoryShareScreen({photoUri: 'file:///proof.jpg'});
    try {
      await act(async () => {
        tree.root.findByProps({accessibilityLabel: 'Show story option 2'}).props.onPress();
      });
      expect(scrollTo.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({animated: true}));
      expect(tree.root.findAllByType(TapInStoryTemplateCard)[0].props.templateId).toBe('transparentOverlay');
      scrollTo.mockClear();
      const block = tree.root.findAll(node => typeof node.props.onLayout === 'function' && node.type === View)[0];
      await act(async () => {
        block.props.onLayout({nativeEvent: {layout: {width: 280, height: 500}}});
      });
      expect(scrollTo).toHaveBeenLastCalledWith({x: 280, animated: false});
      expect(tree.root.findAllByType(TapInStoryTemplateCard)[0].props.templateId).toBe('transparentOverlay');
      expect(mockLoadStoryContext).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => tree.unmount());
      scrollTo.mockRestore();
    }
  });

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCaptureRef.mockReset();
    mockReleaseCapture.mockReset();
    mockShareOpen.mockReset();
    mockShareSingle.mockReset();
    mockCopyImage.mockReset();
    mockLoadStoryContext.mockReset();
    mockCaptureRef.mockResolvedValue('file:///tmp/hoyst-story.png');
    mockShareOpen.mockResolvedValue({message: 'shared', success: true});
    mockShareSingle.mockResolvedValue({message: 'shared', success: true});
    mockCopyImage.mockResolvedValue(true);
    mockLoadStoryContext.mockImplementation(
      async (params: {dateKey: string}) => ({
        tapIn: params,
        progress: {
          viewer: {
            version: 2,
            revision: 'v1',
            asOfDateKey: '2026-10-17',
            cadence: 'weekly',
            period: {key: '2026-10-12', start: '2026-10-12', end: '2026-10-18'},
            progress: {covered: 2, required: 4, outcome: 'open'},
            streak: {count: 3, unit: 'week', availability: 'ready'},
          },
        },
      }),
    );
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

  it('groups the tap-in amount and status under Your progress and shows both flame icons', async () => {
    const tree = await renderStoryShareScreen({
      currentValue: 12,
      unitLabel: 'pages',
      status: 'partial',
    });
    const sections = tree.root.findAll(
      node =>
        node.type === View &&
        node.props.testID === 'tap-in-story-your-progress',
    );
    expect(sections).toHaveLength(3);
    for (const section of sections) {
      const result = section.findAll(
        node =>
          node.type === View &&
          node.props.testID === 'tap-in-story-this-tap-in',
      )[0];
      const text = result
        .findAllByType(HoystText)
        .map(node => node.props.children);
      expect(text).toEqual(['This Tap In', '12 pages', 'Partial']);
    }
    expect(tree.root.findAllByType(Flame)).toHaveLength(6);
    for (const id of [
      'tap-in-story-activity',
      'tap-in-story-result',
      'tap-in-story-note',
      'tap-in-story-eyebrow',
    ]) {
      expect(tree.root.findAllByProps({testID: id})).toHaveLength(0);
    }
    expect(JSON.stringify(tree.toJSON())).not.toContain('Goal:');
  });

  it('shows the same two-card carousel when no Tap In photo exists', async () => {
    const tree = await renderStoryShareScreen();

    const templateIds = tree.root
      .findAllByType(TapInStoryTemplateCard)
      .map(node => node.props.templateId);

    expect(templateIds).toEqual([
      'tapInMoment',
      'tapInMoment',
      'transparentOverlay',
    ]);
  });

  it('centers each export as one group with an inline Hoyst wordmark CTA', async () => {
    const tree = await renderStoryShareScreen();

    expect(
      tree.root.findAll(
        node =>
          node.type === View &&
          node.props.testID === 'tap-in-story-content-group',
      ),
    ).toHaveLength(3);
    expect(
      tree.root.findAll(
        node => node.type === View && node.props.testID === 'tap-in-story-cta',
      ),
    ).toHaveLength(3);
    expect(
      tree.root.findAll(
        node =>
          node.type === View &&
          node.props.testID === 'tap-in-story-title-group',
      ),
    ).toHaveLength(3);

    const wordmarks = tree.root.findAllByType(BrandMark);
    expect(wordmarks).toHaveLength(3);
    expect(wordmarks.map(node => node.props.kind)).toEqual([
      'logo',
      'logo',
      'logo',
    ]);
    expect(wordmarks.map(node => node.props.isDark)).toEqual([
      false,
      false,
      true,
    ]);
    const titles = tree.root.findAll(
      node =>
        node.type === HoystText && node.props.testID === 'tap-in-story-title',
    );
    expect(titles).toHaveLength(3);
    expect(titles.map(node => node.props.children)).toEqual([
      'Morning Movers',
      'Morning Movers',
      'Morning Movers',
    ]);
    const eyebrows = tree.root.findAll(
      node =>
        node.type === HoystText && node.props.testID === 'tap-in-story-header',
    );
    expect(eyebrows).toHaveLength(3);
    expect(
      eyebrows.map(node => node.props.children.replace(/\s+/g, ' ')),
    ).toEqual([
      'OCT 17, 2026 · I TAPPED IN ON MY ACCOUNTABILITY CIRCLE:',
      'OCT 17, 2026 · I TAPPED IN ON MY ACCOUNTABILITY CIRCLE:',
      'OCT 17, 2026 · I TAPPED IN ON MY ACCOUNTABILITY CIRCLE:',
    ]);
    expect(
      tree.root.findAll(
        node => node.type === HoystText && node.props.children === 'Circle',
      ),
    ).toHaveLength(0);
  });

  it('uses current commitment stats without lifetime or overall daily stats', async () => {
    const tree = await renderStoryShareScreen({memberCount: 4});
    const story = tree.root.findAllByType(TapInStoryTemplateCard)[0].props
      .story;
    expect(mockLoadStoryContext).toHaveBeenCalledTimes(1);
    expect(story.personalProgress).toEqual(
      expect.objectContaining({value: '2 of 4', streak: '3 weeks'}),
    );
    expect(story).not.toHaveProperty('totalTapIns');
    expect(story.dateLabel).toBe('Oct 17, 2026');
    expect(story.result.statusLabel).toBe('Goal met');
  });

  it('waits for one resolved snapshot and keeps it stable through rerenders', async () => {
    let finish: (context: unknown) => void = () => {};
    mockLoadStoryContext.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const tree = await renderStoryShareScreen();
    expect(
      tree.root.findByProps({accessibilityLabel: 'More'}).props.disabled,
    ).toBe(true);
    await act(async () => {
      finish({tapIn: {dateKey: '2026-10-17', status: 'partial'}});
    });
    const story = tree.root.findAllByType(TapInStoryTemplateCard)[0].props
      .story;
    expect(
      tree.root.findByProps({accessibilityLabel: 'More'}).props.disabled,
    ).toBe(false);
    await act(async () => {
      tree.root
        .findByProps({accessibilityLabel: 'Show story option 2'})
        .props.onPress();
    });
    expect(mockLoadStoryContext).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(TapInStoryTemplateCard)[0].props.story).toBe(
      story,
    );
    expect(story.result.statusLabel).toBe('Partial');
  });

  it('waits for photo and member images in the capture card', async () => {
    const tree = await renderStoryShareScreen({
      photoUri: 'file:///proof.jpg',
      members: [
        {
          id: 'a',
          name: 'Avery',
          initials: 'AV',
          state: 'done',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ],
    });
    const capture = () => tree.root.findAllByType(TapInStoryTemplateCard)[0];
    const button = () => tree.root.findByProps({accessibilityLabel: 'More'});
    expect(button().props.disabled).toBe(true);
    await act(async () => {
      capture().props.onImageSettled('file:///proof.jpg');
    });
    expect(button().props.disabled).toBe(true);
    await act(async () => {
      capture().props.onImageSettled('https://example.com/avatar.png');
    });
    expect(button().props.disabled).toBe(false);
  });

  it('resolves a failed load without fabricating progress', async () => {
    mockLoadStoryContext.mockRejectedValue(new Error('offline'));
    const tree = await renderStoryShareScreen();
    const story = tree.root.findAllByType(TapInStoryTemplateCard)[0].props
      .story;
    expect(story.personalProgress.value).toBe('Progress unavailable');
    expect(
      tree.root.findByProps({accessibilityLabel: 'More'}).props.disabled,
    ).toBe(false);
  });

  it('omits group sections and invitations for a personal commitment', async () => {
    const tree = await renderStoryShareScreen({circleMode: 'personal'});
    const story = tree.root.findAllByType(TapInStoryTemplateCard)[0].props
      .story;
    expect(story.groupProgress).toBeUndefined();
    expect(
      tree.root.findAllByProps({testID: 'tap-in-story-member-cluster'}),
    ).toHaveLength(0);
    expect(story.ctaLabel).toBe('Tapped in on Hoyst');
  });

  it('ignores a result that finishes after the screen unmounts', async () => {
    let finish: (context: unknown) => void = () => {};
    mockLoadStoryContext.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const tree = await renderStoryShareScreen();
    await act(async () => {
      tree.unmount();
    });
    await act(async () => {
      finish({tapIn: {dateKey: '2026-10-17'}});
    });
    expect(mockCaptureRef).not.toHaveBeenCalled();
  });

  it('uses routed Circle context without starting another live subscription', async () => {
    const tree = await renderStoryShareScreen({
      category: 'Fitness',
      circleTitle: 'Lunch Walkers',
      commitment: 'Walk outdoors for 20 minutes',
      commitmentType: 'avoid',
      memberCount: 5,
      members: [
        {id: 'a', initials: 'A', name: 'Avery', state: 'done'},
        {
          id: 'b',
          initials: 'B',
          membershipStatus: 'pending',
          name: 'Blair',
          state: 'pending',
        },
        {id: 'c', initials: 'C', name: 'Casey', state: 'done'},
      ],
    });
    const story = tree.root.findAllByType(TapInStoryTemplateCard)[0].props
      .story;

    expect(story).toEqual(
      expect.objectContaining({
        category: 'Fitness',
        circleTitle: 'Lunch Walkers',
        commitmentType: 'avoid',
        memberCount: 5,
        members: [
          expect.objectContaining({id: 'a'}),
          expect.objectContaining({id: 'c'}),
        ],
      }),
    );
  });

  it('keeps the two-card carousel when a proof photo exists', async () => {
    const tree = await renderStoryShareScreen({
      photoUri: 'file:///tmp/proof.jpg',
    });

    const templateIds = tree.root
      .findAllByType(TapInStoryTemplateCard)
      .map(node => node.props.templateId);

    expect(templateIds).toEqual([
      'tapInMoment',
      'tapInMoment',
      'transparentOverlay',
    ]);
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
