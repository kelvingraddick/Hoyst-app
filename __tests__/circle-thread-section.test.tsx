import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

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
    viewerUid: 'user-1',
    ...overrides,
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(<CircleThreadSection {...props} />);
  });

  return {
    rerender(nextProps: Partial<SectionProps>) {
      props = {...props, ...nextProps};
      act(() => {
        tree?.update(<CircleThreadSection {...props} />);
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

  it('renders mixed activity, left and right messages, images, likes, and composer chips', () => {
    const {tree} = renderSection();
    const output = outputOf(tree);

    expect(output).toContain('Circle Chat');
    expect(output).toContain('TODAY');
    expect(output).toContain('Maya tapped in');
    expect(output).toContain('Rough night but got it done');
    expect(output).toContain("Let's gooo 🔥 proud of everyone");
    expect(output).toContain("who's still up 👀");
    expect(output).toContain('Sam nudged Priya');
    expect(output).toContain('👏 Nice');
    expect(output).toContain("🙌 Let's go");
    expect(output).toContain('💪 You got this');
    expect(output).not.toContain('🔥 Streak');
    expect(output).not.toContain('💪 Push');
    expect(getDayMarkerIds(tree).size).toBe(1);
    expect(
      tree.root.findByProps({testID: 'circle-thread-activity-image'}),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'circle-thread-message-image'}),
    ).toBeTruthy();
    expect(
      tree.root
        .findAllByType(Image)
        .some(image =>
          JSON.stringify(image.props.source).includes('proof.jpg'),
        ),
    ).toBe(true);

    const currentMessage = tree.root
      .findAll(node => textContent(node).includes("Let's gooo"))
      .at(-1);
    const currentMessageAncestors = tree.root.findAll(node =>
      String(JSON.stringify(node.props?.style ?? {}) ?? '').includes('#2F6FED'),
    );

    expect(currentMessage).toBeTruthy();
    expect(currentMessageAncestors.length).toBeGreaterThan(0);
    expect(
      tree.root
        .findAllByType(ScrollView)
        .every(scrollView => scrollView.props.horizontal === true),
    ).toBe(true);
    expect(output.indexOf('Message the circle...')).toBeLessThan(
      output.indexOf('Sam nudged Priya'),
    );
    expect(output.indexOf('Sam nudged Priya')).toBeLessThan(
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
      {...olderItem, createdAtMs: now - 3 * 24 * 60 * 60_000, id: 'older'},
    ];

    const {tree} = renderSection();

    expect(getDayMarkerIds(tree).size).toBe(2);
    expect(outputOf(tree)).toContain('TODAY');
    expect(outputOf(tree).indexOf('Sam nudged Priya')).toBeLessThan(
      outputOf(tree).indexOf("who's still up 👀"),
    );
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
    expect(outputOf(tree)).toContain('Maya tapped in');
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

  it('uses compact sizing for the feed, quick chips, and composer', () => {
    const {tree} = renderSection();
    const activityCopy = findTextNode(tree, 'Maya tapped in');
    const messageCopy = findTextNode(tree, "Let's gooo 🔥 proud of everyone");
    const timestamp = findTextNode(tree, '8:40 AM');
    const messageImage = tree.root.findByProps({
      testID: 'circle-thread-message-image',
    });
    const quickChip = tree.root.findByProps({
      accessibilityLabel: 'Send 👏 Nice',
    });
    const quickPill = tree.root.findByProps({
      testID: 'circle-thread-quick-pill-nice',
    });
    const quickLabel = findTextNode(tree, '👏 Nice');
    const composerInput = tree.root.findByType(TextInput);
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

    expect(StyleSheet.flatten(activityCopy?.props.style)).toEqual(
      expect.objectContaining({fontSize: 13, lineHeight: 17}),
    );
    expect(StyleSheet.flatten(messageCopy?.props.style)).toEqual(
      expect.objectContaining({fontSize: 16, lineHeight: 21}),
    );
    expect(StyleSheet.flatten(timestamp?.props.style)).toEqual(
      expect.objectContaining({fontSize: 12, lineHeight: 15}),
    );
    expect(StyleSheet.flatten(messageImage.props.style)).toEqual(
      expect.objectContaining({height: 136, width: 220}),
    );
    expect(StyleSheet.flatten(quickChip.props.style({pressed: false}))).toEqual(
      expect.objectContaining({borderRadius: 999, opacity: 1}),
    );
    expect(StyleSheet.flatten(quickPill.props.style)).toEqual(
      expect.objectContaining({
        borderRadius: 999,
        borderWidth: 1,
        minHeight: 34,
        paddingHorizontal: 14,
        shadowRadius: 10,
      }),
    );
    expect(StyleSheet.flatten(quickLabel?.props.style)).toEqual(
      expect.objectContaining({fontSize: 13, lineHeight: 17}),
    );
    expect(StyleSheet.flatten(composerInput.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 15,
        lineHeight: 20,
        maxHeight: 96,
        minHeight: 38,
        textAlign: 'left',
        textAlignVertical: 'center',
      }),
    );
    expect(StyleSheet.flatten(composerRow.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 8,
        minHeight: 56,
      }),
    );
    expect(StyleSheet.flatten(composerActions.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        flexShrink: 0,
        gap: 8,
        width: 92,
      }),
    );
    expect(
      StyleSheet.flatten(imageButton.props.style({pressed: false})),
    ).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        height: 42,
        width: 42,
      }),
    );
    expect(StyleSheet.flatten(cameraCircle.props.style)).toEqual(
      expect.objectContaining({
        height: 42,
        width: 42,
      }),
    );
    expect(
      StyleSheet.flatten(sendButton.props.style({pressed: false})),
    ).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        height: 42,
        opacity: 1,
        width: 42,
      }),
    );
    expect(StyleSheet.flatten(sendCircle.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#2F6FED',
        height: 42,
        width: 42,
      }),
    );
    expect(sendButton.props.accessibilityState).toEqual({disabled: true});
  });

  it('sends quick preset messages and likes companion items', async () => {
    const {tree} = renderSection();
    const quickChip = tree.root.findByProps({
      accessibilityLabel: 'Send 👏 Nice',
    });

    await act(async () => {
      quickChip.props.onPress();
      await Promise.resolve();
    });

    expect(mockSendCircleThreadMessage).toHaveBeenCalledWith({
      circleId: 'circle-1',
      mediaImageUrl: undefined,
      messageId: 'new-message-id',
      text: '👏 Nice',
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

    expect(output).toContain('Start the circle chat');
    expect(output).toContain('Message the circle...');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-empty-title'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 16, lineHeight: 20}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-empty-body'}).props.style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 13, lineHeight: 19}));
  });

  it('keeps archived Circle history readable without thread mutations', () => {
    const {tree} = renderSection({isArchived: true, isVisible: true});
    const output = outputOf(tree);

    expect(output).toContain('Archived Circle');
    expect(output).toContain('This chat is read-only.');
    expect(output).toContain('Maya tapped in');
    expect(output).not.toContain('Message the circle...');
    expect(output).not.toContain('Send 👏 Nice');
    expect(mockMarkCircleThreadRead).not.toHaveBeenCalled();

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

    expect(output).toContain('Could not load circle chat');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-error-title'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 16, lineHeight: 20}));
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-thread-error-body'}).props.style,
      ),
    ).toEqual(expect.objectContaining({fontSize: 13, lineHeight: 19}));
  });
});
