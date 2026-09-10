import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';
import {ArrowRight, Camera} from 'lucide-react-native';

import {DesignSystemProvider} from '../src/design/system';
import {CircleThreadSection} from '../src/features/circles/components/CircleThreadSection';
import type {CircleThreadItem} from '../src/types/models';

const mockSubscribeToCircleThreadItems = jest.fn();
const mockMarkCircleThreadRead = jest.fn();
const mockSendCircleThreadMessage = jest.fn();
const mockToggleCircleThreadItemLike = jest.fn();
const mockUploadCircleThreadImage = jest.fn();
const mockCreateCircleThreadMessageId = jest.fn();
const mockLaunchImageLibrary = jest.fn();

let mockThreadError: Error | undefined;
let mockThreadItems: CircleThreadItem[];
let mockThreadHasMore: boolean;
let alertSpy: jest.SpyInstance;

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
  const {View: MockView} = require('react-native');

  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 0}),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/features/circles/services/circle-thread-service', () => ({
  createCircleThreadMessageId: (...args: unknown[]) =>
    mockCreateCircleThreadMessageId(...args),
  markCircleThreadRead: (...args: unknown[]) =>
    mockMarkCircleThreadRead(...args),
  sendCircleThreadMessage: (...args: unknown[]) =>
    mockSendCircleThreadMessage(...args),
  subscribeToCircleThreadItems: (
    input: Parameters<typeof mockSubscribeToCircleThreadItems>[0],
  ) => {
    mockSubscribeToCircleThreadItems(input);
    if (mockThreadError) {
      input.onError(mockThreadError);
    } else {
      input.onItems({hasMore: mockThreadHasMore, items: mockThreadItems});
    }
    return jest.fn();
  },
  toggleCircleThreadItemLike: (...args: unknown[]) =>
    mockToggleCircleThreadItemLike(...args),
  uploadCircleThreadImage: (...args: unknown[]) =>
    mockUploadCircleThreadImage(...args),
}));

function threadItems(): CircleThreadItem[] {
  const now = Date.now();

  const items: CircleThreadItem[] = [
    {
      activityType: 'tap_in',
      actor: {initials: 'MJ', name: 'Maya', uid: 'user-2'},
      createdAtLabel: '8:40 AM',
      createdAtMs: now - 3 * 60_000,
      id: 'activity-1',
      isLikedByViewer: true,
      kind: 'activity',
      likeCount: 2,
      mediaImageUrl: 'https://example.com/proof.jpg',
      note: 'Rough night but got it done',
      text: 'Maya tapped in',
      tone: 'success',
    },
    {
      actor: {initials: 'KM', name: 'Kelvin', uid: 'user-1'},
      createdAtLabel: '9:16 AM',
      createdAtMs: now - 2 * 60_000,
      id: 'message-1',
      isLikedByViewer: false,
      kind: 'message',
      likeCount: 0,
      text: "Let's gooo 🔥 proud of everyone",
    },
    {
      actor: {initials: 'PJ', name: 'Priya', uid: 'user-3'},
      createdAtLabel: '9:32 AM',
      createdAtMs: now - 60_000,
      id: 'message-2',
      isLikedByViewer: false,
      kind: 'message',
      likeCount: 0,
      mediaImageUrl: 'https://example.com/message.jpg',
      text: "who's still up 👀",
    },
    {
      activityType: 'nudge',
      actor: {initials: 'SR', name: 'Sam', uid: 'user-4'},
      createdAtLabel: '9:40 AM',
      createdAtMs: now,
      id: 'activity-2',
      isLikedByViewer: false,
      kind: 'activity',
      likeCount: 0,
      text: 'Sam nudged Priya',
      tone: 'pending',
    },
  ];

  return items.reverse();
}

type SectionProps = React.ComponentProps<typeof CircleThreadSection>;

function renderSection(overrides: Partial<SectionProps> = {}) {
  let props: SectionProps = {
    circleId: 'circle-1',
    isArchived: false,
    isVisible: false,
    loadMoreRequestToken: 0,
    onLayout: jest.fn(),
    timezone: 'UTC',
    viewer: {
      avatarSource: {uri: 'https://example.com/viewer.jpg'},
      initials: 'KM',
      name: 'Kelvin',
    },
    viewerUid: 'user-1',
    ...overrides,
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <DesignSystemProvider scheme="light">
        <CircleThreadSection {...props} />
      </DesignSystemProvider>,
    );
  });

  return {
    rerender(nextProps: Partial<SectionProps>) {
      props = {...props, ...nextProps};
      act(() => {
        tree?.update(
          <DesignSystemProvider scheme="light">
            <CircleThreadSection {...props} />
          </DesignSystemProvider>,
        );
      });
    },
    tree: tree!,
  };
}

function outputOf(tree: renderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

function textContent(node: ReactTestInstance): string {
  return node.children
    .map(child =>
      typeof child === 'string'
        ? child
        : textContent(child as ReactTestInstance),
    )
    .join('');
}

function findTextNode(tree: renderer.ReactTestRenderer, text: string) {
  return tree.root.findAllByType(Text).find(node => textContent(node) === text);
}

function getDayMarkerIds(tree: renderer.ReactTestRenderer) {
  return new Set(
    tree.root
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('circle-thread-day-'),
      )
      .map(node => node.props.testID as string),
  );
}

describe('CircleThreadSection', () => {
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockThreadError = undefined;
    mockThreadItems = threadItems();
    mockThreadHasMore = false;
    mockCreateCircleThreadMessageId.mockReturnValue('new-message-id');
    mockSendCircleThreadMessage.mockResolvedValue({itemId: 'new-message-id'});
    mockToggleCircleThreadItemLike.mockResolvedValue({
      liked: true,
      likeCount: 1,
    });
    mockUploadCircleThreadImage.mockResolvedValue(
      'https://example.com/uploaded.jpg',
    );
    mockLaunchImageLibrary.mockResolvedValue({assets: []});
    mockMarkCircleThreadRead.mockResolvedValue({read: true});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders a compact neutral feed with clear conversation identity', () => {
    const {tree} = renderSection();
    const output = outputOf(tree);

    expect(output).toContain('Circle feed');
    expect(output).toContain('Today');
    expect(output).toContain('Maya');
    expect(output).toContain('tapped in');
    expect(output).toContain('Priya');
    expect(output).toContain('You');
    expect(output).toContain('Rough night but got it done');
    expect(output).toContain("Let's gooo 🔥 proud of everyone");
    expect(output).toContain("who's still up 👀");
    expect(output).toContain('Sam');
    expect(output).toContain('nudged Priya');
    expect(output).not.toContain('👏 Nice');
    expect(output).not.toContain("🙌 Let's go");
    expect(output).not.toContain('💪 You got this');
    expect(output).not.toContain('🔥 Streak');
    expect(output).not.toContain('💪 Push');
    expect(getDayMarkerIds(tree).size).toBe(1);
    expect(
      tree.root.findByProps({testID: 'circle-thread-activity-image'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'circle-thread-message-image'}),
    ).toBeTruthy();
    const activityLikeRow = tree.root.findByProps({
      testID: 'circle-thread-activity-like-row-activity-2',
    });
    const activityLikeRowStyle = StyleSheet.flatten(
      activityLikeRow.props.style,
    );

    expect(activityLikeRowStyle).toEqual(
      expect.objectContaining({flexDirection: 'row', gap: 0}),
    );

    expect(
      textContent(
        tree.root.findByProps({
          testID: 'circle-thread-message-author-message-1',
        }),
      ),
    ).toBe('You ');
    expect(
      textContent(
        tree.root.findByProps({
          testID: 'circle-thread-message-author-message-2',
        }),
      ),
    ).toBe('Priya ');
    expect(
      tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.includes('message-bubble'),
      ),
    ).toHaveLength(0);
    expect(
      tree.root
        .findAllByType(Image)
        .some(image =>
          JSON.stringify(image.props.source).includes('proof.jpg'),
        ),
    ).toBe(true);

    expect(
      tree.root.findAllByProps({testID: 'circle-thread-surface'}),
    ).toHaveLength(0);
    expect(output.indexOf('circle-thread-composer')).toBeLessThan(
      output.indexOf('circle-thread-activity-activity-2'),
    );
    expect(output.indexOf('circle-thread-activity-activity-2')).toBeLessThan(
      output.indexOf("who's still up 👀"),
    );
    expect(output.indexOf("who's still up 👀")).toBeLessThan(
      output.indexOf("Let's gooo 🔥 proud of everyone"),
    );
  });

  it('renders separate date markers for activity from different days', () => {
    const now = Date.now();
    const [todayItem, olderItem] = threadItems();
    mockThreadItems = [
      {...todayItem, createdAtMs: now, id: 'today'},
      {...olderItem, createdAtMs: now - 24 * 60 * 60_000, id: 'older'},
    ];

    const {tree} = renderSection();
    const output = outputOf(tree);

    expect(getDayMarkerIds(tree).size).toBe(2);
    expect(output).toContain('Today');
    expect(output).toContain('Yesterday');
    expect(output).not.toContain('YESTERDAY');
    expect(output.indexOf('Sam nudged Priya')).toBeLessThan(
      output.indexOf("who's still up 👀"),
    );
  });

  it("shares only the viewer's completed Tap Ins, including in archived feeds", () => {
    const onShareTapIn = jest.fn();
    const completedTapIn: CircleThreadItem = {
      activityType: 'tap_in',
      actor: {initials: 'KM', name: 'Kelvin', uid: 'user-1'},
      createdAtLabel: '8:40 AM',
      createdAtMs: Date.now() - 3 * 60_000,
      id: 'completed-tap-in',
      isLikedByViewer: false,
      kind: 'activity',
      likeCount: 0,
      mediaImageUrl: 'https://example.com/owned-proof.jpg',
      note: 'Finished before work.',
      text: 'Kelvin tapped in',
      tone: 'success',
    };

    mockThreadItems = [
      completedTapIn,
      {
        ...completedTapIn,
        actor: {initials: 'MJ', name: 'Maya', uid: 'user-2'},
        id: 'other-member-tap-in',
      },
      {
        ...completedTapIn,
        id: 'partial-tap-in',
        text: 'Kelvin logged partial progress',
        tone: 'pending',
      },
      {
        ...completedTapIn,
        id: 'failed-tap-in',
        text: 'Kelvin missed the Goal',
        tone: 'alert',
      },
      {
        ...completedTapIn,
        id: 'skip-tap-in',
        text: 'Kelvin used a skip',
        tone: 'pending',
      },
    ];

    const {tree} = renderSection({isArchived: true, onShareTapIn});
    const shareButtons = tree.root
      .findAllByType(Pressable)
      .filter(button => button.props.accessibilityLabel === 'Share Tap In');

    expect(shareButtons).toHaveLength(1);
    expect(findTextNode(tree, 'Share Tap In')).toBeUndefined();
    expect(
      StyleSheet.flatten(shareButtons[0].props.style({pressed: false})),
    ).toEqual(expect.objectContaining({height: 44, opacity: 1, width: 44}));

    act(() => {
      shareButtons[0].props.onPress();
    });

    expect(onShareTapIn).toHaveBeenCalledWith(completedTapIn);
  });

  it('marks the newest item read only after the section becomes visible', async () => {
    const {rerender} = renderSection({isVisible: false});

    expect(mockMarkCircleThreadRead).not.toHaveBeenCalled();

    await act(async () => {
      rerender({isVisible: true});
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMarkCircleThreadRead).toHaveBeenCalledTimes(1);
    expect(mockMarkCircleThreadRead).toHaveBeenCalledWith('circle-1');

    const subscriptionInput = mockSubscribeToCircleThreadItems.mock.calls[0][0];
    const latestItem: CircleThreadItem = {
      ...threadItems()[0],
      createdAtMs: Date.now() + 1_000,
      id: 'new-live-item',
      text: 'Newest live activity',
    };

    await act(async () => {
      subscriptionInput.onItems({
        hasMore: false,
        items: [latestItem, ...threadItems()],
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMarkCircleThreadRead).toHaveBeenCalledTimes(2);
  });

  it('loads older items once per request and preserves content through retry', () => {
    mockThreadHasMore = true;
    const {rerender, tree} = renderSection();

    expect(mockSubscribeToCircleThreadItems).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToCircleThreadItems.mock.calls[0][0].itemLimit).toBe(
      20,
    );

    mockThreadError = new Error('temporarily unavailable');
    rerender({loadMoreRequestToken: 1});

    expect(mockSubscribeToCircleThreadItems).toHaveBeenCalledTimes(2);
    expect(mockSubscribeToCircleThreadItems.mock.calls[1][0].itemLimit).toBe(
      40,
    );
    expect(outputOf(tree)).toContain('Maya');
    expect(outputOf(tree)).toContain('tapped in');
    expect(outputOf(tree)).toContain('Could not load older activity.');

    rerender({loadMoreRequestToken: 1});
    expect(mockSubscribeToCircleThreadItems).toHaveBeenCalledTimes(2);

    mockThreadError = undefined;
    act(() => {
      tree.root
        .findByProps({accessibilityLabel: 'Retry older circle activity'})
        .props.onPress();
    });

    expect(mockSubscribeToCircleThreadItems).toHaveBeenCalledTimes(3);
    expect(mockSubscribeToCircleThreadItems.mock.calls[2][0].itemLimit).toBe(
      40,
    );
    expect(outputOf(tree)).not.toContain('Could not load older activity.');
  });

  it('does not request another page when all items are loaded', () => {
    mockThreadHasMore = false;
    const {rerender} = renderSection();

    rerender({loadMoreRequestToken: 1});

    expect(mockSubscribeToCircleThreadItems).toHaveBeenCalledTimes(1);
  });

  it('renders the standalone mock-sized composer and direct feed rows', () => {
    const {tree} = renderSection();
    const activityCopy = findTextNode(tree, 'Maya tapped in');
    const messageCopy = findTextNode(tree, "Let's gooo 🔥 proud of everyone");
    const timestamp = findTextNode(tree, '8:40 AM');
    const messageImage = tree.root.findByProps({
      testID: 'circle-thread-message-image',
    });
    const composerInput = tree.root.findByType(TextInput);
    const composerInputShell = tree.root.findByProps({
      testID: 'circle-thread-composer-input-shell',
    });
    const composerRow = tree.root.findByProps({
      testID: 'circle-thread-composer-row',
    });
    const composerActions = tree.root.findByProps({
      testID: 'circle-thread-composer-actions',
    });
    const imageButton = tree.root.findByProps({
      accessibilityLabel: 'Add image',
    });
    const cameraCircle = tree.root.findByProps({
      testID: 'circle-thread-composer-camera-circle',
    });
    const sendButton = tree.root.findByProps({
      accessibilityLabel: 'Send message',
    });
    const sendCircle = tree.root.findByProps({
      testID: 'circle-thread-composer-send-circle',
    });
    const activityCard = tree.root.findByProps({
      testID: 'circle-thread-activity-activity-1',
    });
    const composer = tree.root.findByProps({
      testID: 'circle-thread-composer',
    });
    const composerAvatar = tree.root.findByProps({
      testID: 'circle-thread-composer-avatar',
    });
    const composerAvatarImage = tree.root.findByProps({
      testID: 'circle-thread-composer-avatar-image',
    });
    const rowAvatar = tree.root.findByProps({
      testID: 'circle-thread-row-avatar-activity-1',
    });

    expect(StyleSheet.flatten(activityCopy?.props.style)).toEqual(
      expect.objectContaining({fontSize: 14, lineHeight: 20}),
    );
    expect(StyleSheet.flatten(messageCopy?.props.style)).toEqual(
      expect.objectContaining({fontSize: 14, lineHeight: 20}),
    );
    expect(StyleSheet.flatten(timestamp?.props.style)).toEqual(
      expect.objectContaining({fontSize: 12, lineHeight: 16}),
    );
    expect(StyleSheet.flatten(messageImage.props.style)).toEqual(
      expect.objectContaining({borderRadius: 8, height: 36, width: 36}),
    );
    expect(StyleSheet.flatten(activityCard.props.style)).toEqual(
      expect.objectContaining({
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
        minHeight: 64,
        paddingVertical: 12,
      }),
    );
    expect(StyleSheet.flatten(composer.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        minHeight: 64,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }),
    );
    expect(
      tree.root.findAllByProps({testID: 'circle-thread-surface'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('circle-thread-quick-pill-'),
      ),
    ).toHaveLength(0);
    expect(StyleSheet.flatten(composerAvatar.props.style)).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        alignSelf: 'center',
        height: 40,
        justifyContent: 'center',
        width: 40,
      }),
    );
    expect(StyleSheet.flatten(composerAvatarImage.props.style)).toEqual(
      expect.objectContaining({height: 40, width: 40}),
    );
    expect(StyleSheet.flatten(rowAvatar.props.style)).toEqual(
      expect.not.objectContaining({borderWidth: expect.anything()}),
    );
    expect(StyleSheet.flatten(composerInput.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
        maxHeight: 96,
        minHeight: 48,
        paddingRight: 104,
        textAlign: 'left',
        textAlignVertical: 'center',
      }),
    );
    expect(composerInput.props.placeholder).toBe('Share a message...');
    expect(StyleSheet.flatten(composerInputShell.props.style)).toEqual(
      expect.objectContaining({
        borderRadius: 12,
        minHeight: 48,
        position: 'relative',
      }),
    );
    expect(StyleSheet.flatten(composerRow.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 8,
        minHeight: 48,
      }),
    );
    expect(StyleSheet.flatten(composerActions.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 4,
        height: 44,
        position: 'absolute',
        right: 0,
        top: 2,
        width: 92,
        zIndex: 1,
      }),
    );
    expect(composerActions.parent?.props.testID).toBe(
      'circle-thread-composer-input-shell',
    );
    expect(
      StyleSheet.flatten(imageButton.props.style({pressed: false})),
    ).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        height: 44,
        width: 44,
      }),
    );
    expect(StyleSheet.flatten(cameraCircle.props.style)).toEqual(
      expect.objectContaining({
        height: 32,
        width: 32,
      }),
    );
    expect(cameraCircle.findByType(Camera).props.size).toBe(20);
    expect(
      StyleSheet.flatten(sendButton.props.style({pressed: false})),
    ).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        height: 44,
        opacity: 0.46,
        width: 44,
      }),
    );
    expect(StyleSheet.flatten(sendCircle.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#2F6FED',
        height: 32,
        width: 32,
      }),
    );
    expect(sendCircle.findByType(ArrowRight).props.size).toBe(20);
    expect(sendButton.props.accessibilityState).toEqual({disabled: true});
  });

  it('keeps the composer fallback initial proportional to its avatar', () => {
    const {tree} = renderSection({
      viewer: {initials: 'KM', name: 'Kelvin'},
    });
    const composerAvatarInitial = tree.root.findByProps({
      testID: 'circle-thread-composer-avatar-initial',
    });

    expect(textContent(composerAvatarInitial)).toBe('K');
    expect(StyleSheet.flatten(composerAvatarInitial.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
      }),
    );
  });

  it('sends typed messages and likes Member items', async () => {
    const {tree} = renderSection();
    const composerInput = tree.root.findByProps({
      testID: 'circle-thread-composer-input',
    });

    act(() => {
      composerInput.props.onChangeText('Making steady progress');
    });

    const sendButton = tree.root.findByProps({
      accessibilityLabel: 'Send message',
    });
    expect(sendButton.props.disabled).toBe(false);

    await act(async () => {
      sendButton.props.onPress();
      await Promise.resolve();
    });

    expect(mockSendCircleThreadMessage).toHaveBeenCalledWith({
      circleId: 'circle-1',
      mediaImageUrl: undefined,
      messageId: 'new-message-id',
      text: 'Making steady progress',
    });

    const likeButton = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Like activity');

    expect(likeButton).toBeTruthy();
    await act(async () => {
      likeButton?.props.onPress();
      await Promise.resolve();
    });

    expect(mockToggleCircleThreadItemLike).toHaveBeenCalledWith({
      circleId: 'circle-1',
      itemId: 'activity-2',
    });
  });

  it('keeps a failed message photo retryable without exposing Storage codes', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      assets: [{uri: 'file:///message-photo.jpg'}],
    });
    mockUploadCircleThreadImage.mockRejectedValueOnce({
      code: 'storage/unauthorized',
      message:
        '[storage/unauthorized] User is not authorized to perform the desired action.',
    });
    const {tree} = renderSection();

    await act(async () => {
      tree.root.findByProps({accessibilityLabel: 'Add image'}).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root
        .findByProps({accessibilityLabel: 'Send message'})
        .props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadCircleThreadImage).toHaveBeenCalledWith({
      circleId: 'circle-1',
      messageId: 'new-message-id',
      uid: 'user-1',
      uri: 'file:///message-photo.jpg',
    });
    expect(mockSendCircleThreadMessage).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Message failed',
      "We couldn't upload this photo. Try again in a moment.",
    );
    expect(JSON.stringify(alertSpy.mock.calls)).not.toContain(
      'storage/unauthorized',
    );
    expect(outputOf(tree)).toContain('file:///message-photo.jpg');
  });

  it('shows the empty state when the thread has no items', () => {
    mockThreadItems = [];

    const {tree} = renderSection();
    const output = outputOf(tree);

    expect(output).toContain('Start the Circle Feed');
    expect(output).toContain('Share a message...');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-empty-title'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 16, lineHeight: 21}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-empty-body'}).props.style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 14, lineHeight: 20}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-empty'}).props.style,
      ),
    ).toEqual(expect.objectContaining({width: '100%'}));
  });

  it('keeps archived Circle history readable without thread mutations', () => {
    const {tree} = renderSection({isArchived: true, isVisible: true});
    const output = outputOf(tree);

    expect(output).toContain('Archived Circle');
    expect(output).toContain('This feed is read-only.');
    expect(output).toContain('Maya');
    expect(output).toContain('tapped in');
    expect(output).not.toContain('Share a message...');
    expect(output).not.toContain('Send 👏 Nice');
    expect(mockMarkCircleThreadRead).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-archived'}).props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
      }),
    );

    const likeButton = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Like activity');

    expect(likeButton?.props.disabled).toBe(true);
    expect(likeButton?.props.onPress).toBeUndefined();
    expect(mockToggleCircleThreadItemLike).not.toHaveBeenCalled();
  });

  it('shows a compact load error when the thread fails to load', () => {
    mockThreadItems = [];
    mockThreadError = new Error('permission-denied');

    const {tree} = renderSection();
    const output = outputOf(tree);

    expect(output).toContain('Could not load Circle Feed');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-error-title'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 16, lineHeight: 21}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-error-body'}).props.style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 14, lineHeight: 20}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-error'}).props.style,
      ),
    ).toEqual(expect.objectContaining({width: '100%'}));
  });
});
