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

import {CircleThreadScreen} from '../src/features/circles/screens/CircleThreadScreen';
import type {CircleDetailModel, CircleThreadItem} from '../src/types/models';

const mockSubscribeToCircleThreadItems = jest.fn();
const mockMarkCircleThreadRead = jest.fn();
const mockSendCircleThreadMessage = jest.fn();
const mockToggleCircleThreadItemLike = jest.fn();
const mockUploadCircleThreadImage = jest.fn();
const mockCreateCircleThreadMessageId = jest.fn();

let mockDetail: CircleDetailModel | undefined;
let mockThreadError: Error | undefined;
let mockThreadItems: CircleThreadItem[];
let mockSessionState: {
  status: 'authenticatedReady' | 'guest';
  user?: {providerIds: string[]; uid: string};
};
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
  launchImageLibrary: jest.fn(async () => ({assets: []})),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const MockReact = require('react');
    MockReact.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

jest.mock('../src/store/session-store', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (
    selector: (state: {profile: {name: string; timezone: string}}) => unknown,
  ) => selector({profile: {name: 'Kelvin', timezone: 'UTC'}}),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  subscribeToMemberCircleDetail: jest.fn(
    ({onDetail}: {onDetail: (detail: CircleDetailModel) => void}) => {
      if (mockDetail) {
        onDetail(mockDetail);
      }

      return jest.fn();
    },
  ),
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
      input.onItems(mockThreadItems);
    }
    return jest.fn();
  },
  toggleCircleThreadItemLike: (...args: unknown[]) =>
    mockToggleCircleThreadItemLike(...args),
  uploadCircleThreadImage: (...args: unknown[]) =>
    mockUploadCircleThreadImage(...args),
}));

function detail(overrides: Partial<CircleDetailModel> = {}): CircleDetailModel {
  return {
    activity: [],
    category: 'Wellness',
    commitment: 'Sleep 8 hours',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    commitmentLabel: 'Commitment: Sleep 8 hours',
    completionRate: 60,
    graceRules: {skip: {allowance: 0, windowDays: 7}},
    groupProgressDays: [],
    id: 'circle-1',
    joinLabel: 'Open seats',
    joinMode: 'open',
    maxSize: 5,
    memberCount: 5,
    members: [],
    monthProgress: [],
    privacy: 'private',
    progressPercent: 60,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 6,
    streakLabel: '6 day streak',
    title: 'Sleep 8 Hours',
    timezone: 'UTC',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    ...overrides,
  };
}

function threadItems(): CircleThreadItem[] {
  return [
    {
      activityType: 'tap_in',
      actor: {initials: 'MJ', name: 'Maya', uid: 'user-2'},
      createdAtLabel: '8:40 AM',
      createdAtMs: 1,
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
      createdAtMs: 2,
      id: 'message-1',
      isLikedByViewer: false,
      kind: 'message',
      likeCount: 0,
      text: "Let's gooo 🔥 proud of everyone",
    },
    {
      actor: {initials: 'PJ', name: 'Priya', uid: 'user-3'},
      createdAtLabel: '9:32 AM',
      createdAtMs: 3,
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
      createdAtMs: 4,
      id: 'activity-2',
      isLikedByViewer: false,
      kind: 'activity',
      likeCount: 0,
      text: 'Sam nudged Priya',
      tone: 'pending',
    },
  ];
}

function renderScreen() {
  const navigation = {
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleThreadScreen
        navigation={navigation as never}
        route={
          {
            key: 'CircleThread',
            name: 'CircleThread',
            params: {circleId: 'circle-1'},
          } as never
        }
      />,
    );
  });

  return {navigation, tree: tree!};
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

describe('CircleThreadScreen', () => {
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockDetail = detail();
    mockThreadError = undefined;
    mockThreadItems = threadItems();
    mockSessionState = {
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    };
    mockCreateCircleThreadMessageId.mockReturnValue('new-message-id');
    mockSendCircleThreadMessage.mockResolvedValue({itemId: 'new-message-id'});
    mockToggleCircleThreadItemLike.mockResolvedValue({
      liked: true,
      likeCount: 1,
    });
    mockUploadCircleThreadImage.mockResolvedValue(
      'https://example.com/uploaded.jpg',
    );
    mockMarkCircleThreadRead.mockResolvedValue({read: true});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('renders mixed activity, left and right messages, images, likes, and composer chips', () => {
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Sleep 8 Hours');
    expect(output).toContain('5 companions · 6 day streak');
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
  });

  it('uses compact sizing for the thread header, feed, quick chips, and composer', () => {
    const {tree} = renderScreen();
    const headerStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-thread-header'}).props.style,
    );
    const title = findTextNode(tree, 'Sleep 8 Hours');
    const subtitle = findTextNode(tree, '5 companions · 6 day streak');
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
    const backButton = tree.root.findByProps({
      accessibilityLabel: 'Go back',
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

    expect(headerStyle).toEqual(
      expect.objectContaining({
        minHeight: 78,
        paddingHorizontal: 20,
      }),
    );
    expect(StyleSheet.flatten(backButton.props.style({pressed: false}))).toEqual(
      expect.objectContaining({borderWidth: 1, height: 40, width: 40}),
    );
    expect(StyleSheet.flatten(title?.props.style)).toEqual(
      expect.objectContaining({fontSize: 20, lineHeight: 25}),
    );
    expect(StyleSheet.flatten(subtitle?.props.style)).toEqual(
      expect.objectContaining({fontSize: 13, lineHeight: 17}),
    );
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
    const {tree} = renderScreen();
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
      itemId: 'activity-1',
    });
  });

  it('shows the empty state when the thread has no items', () => {
    mockThreadItems = [];

    const {tree} = renderScreen();
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

  it('shows a compact load error when the thread fails to load', () => {
    mockThreadItems = [];
    mockThreadError = new Error('permission-denied');

    const {tree} = renderScreen();
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
