import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystChip} from '../src/design/components/HoystChip';
import {HoystText} from '../src/design/components/HoystText';
import {InboxScreen} from '../src/features/inbox/screens/InboxScreen';
import {
  markAllInboxEventsRead,
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../src/features/settings/services/notification-settings-service';
import type {InboxEvent, InboxEventType} from '../src/types/models';

let mockInboxEvents: InboxEvent[];
let emitInboxEvents: ((events: InboxEvent[]) => void) | undefined;

jest.mock('@react-native-community/blur', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');

  return {
    BlurView: ({children, ...props}: {children?: React.ReactNode}) =>
      MockReact.createElement(MockView, props, children),
  };
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

jest.mock('../src/lib/notifications', () => ({
  clearDeliveredNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock(
  '../src/features/settings/services/notification-settings-service',
  () => ({
    markAllInboxEventsRead: jest.fn(() => Promise.resolve({read: 1})),
    markInboxEventRead: jest.fn(() => Promise.resolve({read: true})),
    subscribeToInboxEvents: jest.fn(({onEvents}) => {
      emitInboxEvents = onEvents;
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
        ? 'A new circle matches your rhythm.'
        : 'Workout Circle is not far off.',
    id: type,
    title:
      type === 'companion_tapped_in'
        ? 'A companion tapped in'
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

describe('InboxScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitInboxEvents = undefined;
    mockInboxEvents = [];
  });

  it('uses status-matched chip tones for notification types', () => {
    mockInboxEvents = [
      eventForType('companion_tapped_in'),
      eventForType('circle_at_risk'),
      eventForType('tap_in_midday_reminder'),
      eventForType('circle_discovery_suggestion'),
    ];

    const {tree} = renderInbox();
    const chips = tree.root.findAllByType(HoystChip);

    expect(chips.map(chip => chip.props)).toEqual([
      expect.objectContaining({
        density: 'compact',
        label: 'Tapped in',
        tone: 'green',
      }),
      expect.objectContaining({
        density: 'compact',
        label: 'At risk',
        tone: 'orange',
      }),
      expect.objectContaining({
        density: 'compact',
        label: 'Reminder',
        tone: 'yellow',
      }),
      expect.objectContaining({
        density: 'compact',
        label: 'Explore',
        tone: 'blue',
      }),
    ]);

    const firstChipLabel = tree.root
      .findAllByType(HoystText)
      .find(node => node.props.children === 'Tapped in');
    const firstChipLabelStyle = StyleSheet.flatten(firstChipLabel?.props.style);

    expect(firstChipLabelStyle).toMatchObject({
      fontSize: 10,
      lineHeight: 12,
    });

    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain('#07763E');
    expect(output).toContain('#A83A00');
    expect(output).toContain('#7A5C00');
    expect(output).toContain('#086CA8');
    expect(output).not.toContain('Clark Digital Clark Digital');
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
      .findAllByType(HoystText)
      .find(node => node.props.children === 'Workout Circle needs an update.');
    const timestamp = tree.root
      .findAllByType(HoystText)
      .find(node => node.props.children === '11h ago');
    const messageStyle = StyleSheet.flatten(message?.props.style);
    const timestampStyle = StyleSheet.flatten(timestamp?.props.style);

    expect(unreadDots.length).toBeGreaterThan(0);
    expect(
      unreadDots.some(dot =>
        JSON.stringify(dot.props.style).includes('#A83A00'),
      ),
    ).toBe(true);
    expect(message?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({fontWeight: '700'})]),
    );
    expect(messageStyle).toMatchObject({
      fontSize: 14,
      lineHeight: 19,
    });
    expect(timestamp?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({fontWeight: '700'})]),
    );
    expect(timestampStyle).toMatchObject({
      fontSize: 12,
      lineHeight: 15,
    });
    expect(markAllInboxEventsRead).toHaveBeenCalledTimes(1);
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

  it('renders notification rows in one compact list container', () => {
    mockInboxEvents = [
      eventForType('companion_tapped_in'),
      eventForType('circle_at_risk'),
    ];

    const {tree} = renderInbox();
    const compactList = tree.root
      .findAllByType(View)
      .find(node => node.props.style?.gap === 10);

    expect(compactList).toBeDefined();
  });
});
