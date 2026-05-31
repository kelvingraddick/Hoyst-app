import React from 'react';
import {Pressable, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {HoystChip} from '../src/design/components/HoystChip';
import {InboxScreen} from '../src/features/inbox/screens/InboxScreen';
import {
  markInboxEventRead,
  subscribeToInboxEvents,
} from '../src/features/settings/services/notification-settings-service';
import type {InboxEvent, InboxEventType} from '../src/types/models';

let mockInboxEvents: InboxEvent[];

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
      expect.objectContaining({label: 'Tapped in', tone: 'green'}),
      expect.objectContaining({label: 'At risk', tone: 'orange'}),
      expect.objectContaining({label: 'Reminder', tone: 'yellow'}),
      expect.objectContaining({label: 'Explore', tone: 'blue'}),
    ]);

    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain('#07763E');
    expect(output).toContain('#A83A00');
    expect(output).toContain('#7A5C00');
    expect(output).toContain('#086CA8');
    expect(output).not.toContain('Clark Digital Clark Digital');
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
        node => node.props.accessibilityLabel === 'Open Tap In reminder update',
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
