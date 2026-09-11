import React from 'react';
import {Image, Pressable, StyleSheet} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ChevronRight} from 'lucide-react-native';
// Register the same native styling interop used by Metro in the running app.
import 'react-native-css-interop/dist/runtime/components';

import {HoystChip} from '../src/design/components/HoystChip';
import {DSText} from '../src/design/system';
import {clearDeliveredNotifications} from '../src/lib/notifications';
import {InboxScreen} from '../src/features/inbox/screens/InboxScreen';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../src/features/settings/services/notification-settings-service';
import type {InboxEvent, InboxEventType} from '../src/types/models';

let mockInboxEvents: InboxEvent[];
let mockAppearance: 'light' | 'dark' = 'light';
let emitInboxEvents: ((events: InboxEvent[]) => void) | undefined;
let emitInboxError: (() => void) | undefined;

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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const MockReact = require('react');
    MockReact.useEffect(() => callback(), [callback]);
  },
}));

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

jest.mock('../src/lib/notifications', () => ({
  clearDeliveredNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock(
  '../src/features/settings/services/notification-settings-service',
  () => ({
    markAllInboxEventsRead: jest.fn(() => Promise.resolve({read: 1})),
    markInboxEventRead: jest.fn(() => Promise.resolve({read: true})),
    subscribeToInboxEvents: jest.fn(({onEvents, onError}) => {
      emitInboxEvents = onEvents;
      emitInboxError = onError;
      onEvents(mockInboxEvents);
      return jest.fn();
    }),
  }),
);

function inboxEvent(overrides: Partial<InboxEvent>): InboxEvent {
  return {
    body: 'Workout Circle needs an update.',
    createdAtLabel: '11h ago',
    deeplink: {circleId: 'circle-1', screen: 'CircleDetail'},
    id: 'event-1',
    isRead: false,
    title: 'Circle check-in',
    type: 'circle_at_risk',
    ...overrides,
  };
}

function eventForType(type: InboxEventType): InboxEvent {
  return inboxEvent({
    actor:
      type === 'companion_tapped_in'
        ? {
            avatarUrl: 'https://example.com/avatar.jpg',
            displayName: 'Clark Digital',
            uid: 'user-2',
          }
        : undefined,
    body:
      type === 'companion_tapped_in'
        ? 'Clark Digital tapped in for Workout Circle.'
        : type === 'tap_in_midday_reminder'
        ? 'Workout Circle is halfway through today.'
        : type === 'circle_discovery_suggestion'
        ? 'A new Circle matches your Commitment.'
        : 'Workout Circle is not far off.',
    id: type,
    title:
      type === 'companion_tapped_in'
        ? 'A Member tapped in'
        : type === 'tap_in_midday_reminder'
        ? 'Midday reminder'
        : type === 'circle_discovery_suggestion'
        ? 'Circle discovery'
        : 'Circle check-in',
    type,
  });
}

function renderInbox() {
  const navigation = {
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <InboxScreen navigation={navigation as never} route={{} as never} />,
    );
  });

  return {navigation, tree: tree!};
}

function nativeNodes(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  );
}

describe('InboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitInboxEvents = undefined;
    emitInboxError = undefined;
    mockInboxEvents = [];
    mockAppearance = 'light';
  });

  it('uses compact activity rows with semantic message accents', () => {
    mockInboxEvents = [
      eventForType('companion_tapped_in'),
      eventForType('circle_at_risk'),
      eventForType('tap_in_midday_reminder'),
      eventForType('circle_discovery_suggestion'),
    ];

    const {tree} = renderInbox();
    const rows = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('inbox-event-row-'),
    );

    const output = JSON.stringify(tree.toJSON());
    expect(rows).toHaveLength(4);
    expect(output).toContain('#07763E');
    expect(output).toContain('#A83A00');
    expect(output).toContain('#086CA8');
    expect(tree.root.findAllByType(HoystChip)).toHaveLength(0);
    expect(output).not.toContain('Clark Digital Clark Digital');
  });

  it('renders legacy Circle activity event types as compact rows', () => {
    mockInboxEvents = [
      eventForType('companion_circle_created'),
      eventForType('companion_skipped'),
      eventForType('companion_momentum_level_up'),
      eventForType('companion_streak_milestone'),
    ];

    const {tree} = renderInbox();
    const rows = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('inbox-event-row-'),
    );

    expect(rows).toHaveLength(4);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders stored notification media thumbnails', () => {
    mockInboxEvents = [eventForType('companion_tapped_in')].map(event => ({
      ...event,
      mediaImageUrl: 'https://example.com/tap-in.jpg',
    }));

    const {tree} = renderInbox();

    expect(
      tree.root.findAllByProps({testID: 'inbox-media-image'}).length,
    ).toBeGreaterThan(0);
  });

  it('shows unread rows with a status-colored dot and stronger text', () => {
    mockInboxEvents = [
      inboxEvent({
        id: 'at-risk-unread',
        isRead: false,
        type: 'circle_at_risk',
      }),
    ];

    const {tree} = renderInbox();
    const unreadDots = tree.root.findAll(
      node => node.props.testID === 'inbox-unread-dot',
    );
    const message = tree.root
      .findAll(node => typeof node.type === 'string')
      .find(node => node.props.children === 'Workout Circle needs an update.');
    const timestamp = tree.root
      .findAll(node => typeof node.type === 'string')
      .find(node => node.props.children === '11h ago');
    const messageStyle = StyleSheet.flatten(message?.props.style);
    const timestampStyle = StyleSheet.flatten(timestamp?.props.style);

    expect(unreadDots.length).toBeGreaterThan(0);
    expect(
      unreadDots.some(dot =>
        JSON.stringify(dot.props.style).includes('#A83A00'),
      ),
    ).toBe(true);
    expect(messageStyle).toMatchObject({
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 20,
    });
    expect(timestampStyle).toMatchObject({
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 16,
    });
    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(1);
    expect(clearDeliveredNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not render an unread marker for read rows', () => {
    mockInboxEvents = [
      inboxEvent({
        id: 'already-read',
        isRead: true,
      }),
    ];

    const {tree} = renderInbox();
    const unreadDots = tree.root.findAll(
      node => node.props.testID === 'inbox-unread-dot',
    );

    expect(unreadDots).toHaveLength(0);
  });

  it('keeps a row visually unread for the current Inbox visit', () => {
    const unreadEvent = inboxEvent({
      id: 'current-visit-unread',
      isRead: false,
    });
    mockInboxEvents = [unreadEvent];

    const {tree} = renderInbox();

    expect(
      tree.root.findAll(node => node.props.testID === 'inbox-unread-dot'),
    ).not.toHaveLength(0);

    act(() => {
      emitInboxEvents?.([{...unreadEvent, isRead: true}]);
    });

    expect(
      tree.root.findAll(node => node.props.testID === 'inbox-unread-dot'),
    ).not.toHaveLength(0);
  });

  it('marks new unread rows that arrive while the Inbox is open', () => {
    const readEvent = inboxEvent({
      id: 'already-visible',
      isRead: true,
    });
    const incomingUnreadEvent = inboxEvent({
      id: 'incoming-unread',
      isRead: false,
      title: 'Fresh reminder',
    });
    mockInboxEvents = [readEvent];

    const {tree} = renderInbox();

    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(1);

    act(() => {
      emitInboxEvents?.([readEvent, incomingUnreadEvent]);
    });

    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(2);
    expect(
      tree.root.findAll(node => node.props.testID === 'inbox-unread-dot'),
    ).not.toHaveLength(0);
  });

  it('marks an event read and follows Tap In reminder deeplinks', () => {
    mockInboxEvents = [
      inboxEvent({
        deeplink: {
          circleId: 'circle-1',
          screen: 'TapInComposer',
          source: 'notification',
        },
        id: 'due-1',
        title: 'Tap In reminder',
        type: 'member_due_prompt',
      }),
    ];

    const {navigation, tree} = renderInbox();
    const reminderButton = tree.root
      .findAllByType(Pressable)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'Unread, open Tap In reminder update',
      );

    expect(subscribeToInboxEvents).toHaveBeenCalledWith(
      expect.objectContaining({uid: 'user-1'}),
    );
    expect(reminderButton).toBeDefined();

    act(() => {
      reminderButton!.props.onPress();
    });

    expect(markInboxEventRead).toHaveBeenCalledWith('due-1');
    expect(navigation.navigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'circle-1',
      source: 'notification',
    });
  });

  it('renders divider-separated activity rows with avatars and chevrons', () => {
    mockInboxEvents = [
      eventForType('companion_tapped_in'),
      eventForType('circle_at_risk'),
    ];

    const {tree} = renderInbox();
    const rows = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('inbox-event-row-'),
    );
    const firstRowStyle = StyleSheet.flatten(rows[0]?.props.style);

    expect(firstRowStyle).toMatchObject({
      borderBottomWidth: StyleSheet.hairlineWidth,
      minHeight: 56,
      paddingVertical: 8,
    });
    const avatars = nativeNodes(tree, 'inbox-avatar');

    expect(avatars).toHaveLength(2);
    expect(StyleSheet.flatten(avatars[0]?.props.style)).toMatchObject({
      alignSelf: 'flex-start',
      height: 28,
      width: 28,
    });
    expect(tree.root.findAllByType(ChevronRight)).toHaveLength(2);
  });

  it('uses the Circle Detail-style centered navigation header', () => {
    const {tree} = renderInbox();
    const header = tree.root.findByProps({testID: 'inbox-header'});
    const title = tree.root
      .findAllByType(DSText)
      .find(node => node.props.children === 'Inbox');

    expect(StyleSheet.flatten(header.props.style)).toMatchObject({
      flexDirection: 'row',
      minHeight: 44,
    });
    expect(StyleSheet.flatten(title?.props.style)).toMatchObject({
      flex: 1,
      fontSize: 17,
      lineHeight: 21,
      textAlign: 'center',
    });
  });

  it('uses a full-crop avatar image when available and initials fallback otherwise', () => {
    mockInboxEvents = [
      eventForType('companion_tapped_in'),
      inboxEvent({id: 'without-actor', isRead: true}),
    ];

    const {tree} = renderInbox();

    expect(nativeNodes(tree, 'inbox-avatar')).toHaveLength(2);
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
  });

  it('keeps long activity copy flexible beside the optional thumbnail', () => {
    mockInboxEvents = [
      inboxEvent({
        body: 'A long activity update that should wrap naturally without squeezing the timestamp, thumbnail, or navigation affordance.',
        mediaImageUrl: 'https://example.com/tap-in.jpg',
      }),
    ];

    const {tree} = renderInbox();
    const copy = tree.root.findByProps({testID: 'inbox-event-copy'});
    const copyStyle = StyleSheet.flatten(copy.props.style);
    expect(copyStyle).toMatchObject({
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    });
    expect(nativeNodes(tree, 'inbox-media-image')).toHaveLength(1);
  });

  it.each(['light', 'dark'] as const)(
    'retains native row geometry through styling interop and press feedback in %s mode',
    appearance => {
      mockAppearance = appearance;
      mockInboxEvents = [inboxEvent({isRead: true})];
      const {tree} = renderInbox();
      const row = () => nativeNodes(tree, 'inbox-event-row-event-1')[0]!;
      const button = tree.root
        .findAllByType(Pressable)
        .find(node => node.props.testID === 'inbox-event-row-event-1')!;
      const geometry = {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        minHeight: 56,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor:
          appearance === 'light'
            ? 'rgba(16,24,40,0.08)'
            : 'rgba(255,255,255,0.10)',
      };

      expect(StyleSheet.flatten(row().props.style)).toMatchObject({
        ...geometry,
        opacity: 1,
      });
      act(() => button.props.onPressIn());
      expect(StyleSheet.flatten(row().props.style)).toMatchObject({
        ...geometry,
        opacity: 0.72,
      });
      act(() => button.props.onPressOut());
      expect(StyleSheet.flatten(row().props.style)).toMatchObject({
        ...geometry,
        opacity: 1,
      });
      const message = row()
        .findAll(node => typeof node.type === 'string')
        .find(node => node.props.children === mockInboxEvents[0]?.body);
      expect(StyleSheet.flatten(message?.props.style)).toMatchObject({
        fontWeight: '400',
      });
    },
  );

  it('shows two initials after an avatar failure and retries a changed URL', () => {
    const event = eventForType('companion_tapped_in');
    mockInboxEvents = [event];
    const {tree} = renderInbox();
    const photo = () =>
      tree.root
        .findAllByType(Image)
        .find(node => node.props.testID === 'inbox-avatar-image');
    expect(photo()?.props.resizeMode).toBe('cover');
    act(() => photo()!.props.onError());
    expect(photo()).toBeUndefined();
    expect(
      tree.root
        .findAllByType(DSText)
        .some(node => node.props.children === 'CD'),
    ).toBe(true);
    act(() =>
      emitInboxEvents?.([
        {
          ...event,
          actor: {
            ...event.actor!,
            avatarUrl: 'https://example.com/replacement.jpg',
          },
        },
      ]),
    );
    expect(photo()?.props.source).toEqual({
      uri: 'https://example.com/replacement.jpg',
    });
  });

  it('preserves empty, error, and recovered feed states', () => {
    const {tree} = renderInbox();
    expect(JSON.stringify(tree.toJSON())).toContain('No updates yet');
    act(() => emitInboxError?.());
    expect(JSON.stringify(tree.toJSON())).toContain('Could not load Inbox');
    act(() => emitInboxEvents?.([inboxEvent({isRead: true})]));
    expect(nativeNodes(tree, 'inbox-event-row-event-1')).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Could not load Inbox');
    act(() => emitInboxError?.());
    expect(nativeNodes(tree, 'inbox-event-row-event-1')).toHaveLength(1);
  });

  it.each([true, false])(
    'preserves back navigation with history: %s',
    canGoBack => {
      const {tree, navigation} = renderInbox();
      navigation.canGoBack.mockReturnValue(canGoBack);
      const back = tree.root
        .findAllByType(Pressable)
        .find(node => node.props.accessibilityLabel === 'Back')!;
      act(() => back.props.onPress());
      if (canGoBack) {
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
      } else {
        expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', {
          screen: 'Home',
        });
      }
    },
  );

  it.each([
    {screen: 'TapInPicker'} as const,
    {screen: 'CircleDetail', circleId: 'circle-1'} as const,
  ])('preserves the $screen route and read receipt', deeplink => {
    mockInboxEvents = [inboxEvent({deeplink})];
    const {tree, navigation} = renderInbox();
    const button = tree.root
      .findAllByType(Pressable)
      .find(node => node.props.testID === 'inbox-event-row-event-1')!;
    act(() => button.props.onPress());
    expect(markInboxEventRead).toHaveBeenCalledWith('event-1');
    if (deeplink.screen === 'CircleDetail') {
      expect(navigation.navigate).toHaveBeenCalledWith('CircleDetail', {
        circleId: 'circle-1',
      });
    } else {
      expect(navigation.navigate).toHaveBeenCalledWith('TapInPicker');
    }
  });
});
