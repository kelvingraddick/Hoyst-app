import React from 'react';
import {Alert, Pressable, Share, StyleSheet} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {CircleToolsScreen} from '../src/features/circles/screens/CircleToolsScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockDeleteCircle = jest.fn();
const mockLeaveCircle = jest.fn();
const mockRotateCircleInvite = jest.fn();

let mockMemberDetail: CircleDetailModel | undefined;
let mockSessionState: {
  status: 'authenticatedReady' | 'guest';
  user?: {providerIds: string[]; uid: string};
};
let alertSpy: jest.SpyInstance;

type AlertButton = {
  onPress?: () => void;
  text?: string;
};

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
      if (mockMemberDetail) {
        onDetail(mockMemberDetail);
      }

      return jest.fn();
    },
  ),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  deleteCircle: (...args: unknown[]) => mockDeleteCircle(...args),
  leaveCircle: (...args: unknown[]) => mockLeaveCircle(...args),
}));

jest.mock('../src/features/circle-invites/services/invite-service', () => ({
  rotateCircleInvite: (...args: unknown[]) => mockRotateCircleInvite(...args),
}));

function detail(overrides: Partial<CircleDetailModel> = {}): CircleDetailModel {
  return {
    activity: [],
    category: 'Fitness',
    commitment: 'Move for 30 minutes',
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    commitmentLabel: 'Commitment: Move for 30 minutes',
    completionRate: 60,
    graceRules: {skip: {allowance: 0, windowDays: 7}},
    groupProgressDays: [],
    id: 'circle-1',
    inviteUrl: 'https://hoyst.app/join/circle-1',
    joinLabel: 'Open seats',
    joinMode: 'open',
    matchCopy: 'A steady crew for morning movement.',
    maxSize: 8,
    memberCount: 5,
    members: [],
    monthProgress: [],
    nudgeTargetCount: 0,
    privacy: 'public',
    progressLabel: 'Today 60%',
    progressPercent: 60,
    remainingCheckIns: 2,
    state: 'active',
    streakDays: 3,
    streakLabel: '3d streak',
    title: 'Morning Movers',
    timezone: 'UTC',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'owner',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

function renderScreen() {
  const navigation = {
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    navigate: jest.fn(),
    popToTop: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleToolsScreen
        navigation={navigation as never}
        route={
          {
            key: 'CircleTools',
            name: 'CircleTools',
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

function pressByAccessibilityLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
) {
  const match = tree.root.findByProps({accessibilityLabel: label});

  act(() => {
    match.props.onPress();
  });
}

function pressButtonText(tree: renderer.ReactTestRenderer, label: string) {
  const match = tree.root
    .findAll(
      node =>
        node.type === Pressable &&
        !node.props.accessibilityLabel &&
        textContent(node).includes(label),
    )
    .at(-1);

  if (!match) {
    throw new Error(`Could not find button with label ${label}`);
  }

  act(() => {
    match.props.onPress();
  });
}

function getLatestAlertButtons(title: string): AlertButton[] {
  const calls = alertSpy.mock.calls.filter(call => call[0] === title);
  const latestCall = calls[calls.length - 1];
  const buttons = latestCall?.[2] as AlertButton[] | undefined;

  if (!buttons) {
    throw new Error(`Could not find alert buttons for ${title}`);
  }

  return buttons;
}

function pressAlertButton(title: string, buttonText: string) {
  const button = getLatestAlertButtons(title).find(
    item => item.text === buttonText,
  );

  if (!button) {
    throw new Error(`Could not find alert button ${buttonText}`);
  }

  act(() => {
    button.onPress?.();
  });
}

describe('CircleToolsScreen', () => {
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockMemberDetail = detail();
    mockSessionState = {
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    };
    mockDeleteCircle.mockResolvedValue(undefined);
    mockLeaveCircle.mockResolvedValue({status: 'left'});
    mockRotateCircleInvite.mockResolvedValue({
      inviteCode: 'abcdef1234567890',
      inviteUrl: 'https://hoyst.app/join/abcdef1234567890',
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('shows redesigned owner settings and opens edit circle', () => {
    const {navigation, tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle Settings');
    expect(output).not.toContain('SETTINGS');
    expect(output).not.toContain('Morning Movers');
    expect(output).not.toContain('CIRCLE');
    expect(output).toContain('Edit Circle');
    expect(output).toContain(
      'Change the name, rules, access, timing, and capacity.',
    );
    expect(output).toContain('Delete Circle');
    expect(output).toContain('Permanently remove this circle and its history.');
    expect(output).not.toContain('Leave Circle');
    expect(output).not.toContain('Circle Tools');

    const editRow = tree.root.findByProps({accessibilityLabel: 'Edit Circle'});
    const editRowStyle = editRow.props.style({pressed: false});
    expect(editRowStyle.some(Array.isArray)).toBe(false);
    expect(StyleSheet.flatten(editRowStyle)).toEqual(
      expect.objectContaining({
        width: '100%',
      }),
    );
    const editRowLayout = editRow.findAll(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.flexDirection === 'row';
    })[0];

    expect(editRowLayout).toBeTruthy();
    expect(StyleSheet.flatten(editRowLayout?.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        minHeight: 76,
        paddingHorizontal: 16,
      }),
    );

    pressByAccessibilityLabel(tree, 'Edit Circle');

    expect(navigation.navigate).toHaveBeenCalledWith('EditCircle', {
      circleId: 'circle-1',
    });
  });

  it('deletes an owner circle and exits the circle flow', async () => {
    const {navigation, tree} = renderScreen();

    pressByAccessibilityLabel(tree, 'Delete Circle');
    act(() => {
      tree.root
        .findByProps({accessibilityLabel: 'Confirm circle name'})
        .props.onChangeText('Morning Movers');
    });
    pressButtonText(tree, 'Delete Circle');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDeleteCircle).toHaveBeenCalledWith('circle-1');
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Circle deleted',
      'Morning Movers has been deleted.',
    );
  });

  it('resets and shares an owner invite link after confirmation', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({action: Share.sharedAction});
    const {tree} = renderScreen();

    pressByAccessibilityLabel(tree, 'Reset Invite Link');
    expect(alertSpy).toHaveBeenCalledWith(
      'Reset invite link?',
      'The current link will stop working immediately. Existing members are not affected.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Keep Current Link'}),
        expect.objectContaining({
          style: 'destructive',
          text: 'Reset Link',
        }),
      ]),
    );

    pressAlertButton('Reset invite link?', 'Reset Link');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRotateCircleInvite).toHaveBeenCalledWith('circle-1');
    expect(shareSpy).toHaveBeenCalledWith({
      message:
        'Join Morning Movers on Hoyst: https://hoyst.app/join/abcdef1234567890',
      title: 'Join Morning Movers on Hoyst',
      url: 'https://hoyst.app/join/abcdef1234567890',
    });
    shareSpy.mockRestore();
  });

  it('offers edit, conversion, and delete actions for a personal commitment', () => {
    mockMemberDetail = detail({
      circleMode: 'personal',
      commitment: 'Read every day',
      inviteUrl: undefined,
      joinMode: 'invite_only',
      maxSize: 1,
      memberCount: 1,
      privacy: 'private',
      title: 'Read every day',
    });
    const {navigation, tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Commitment Settings');
    expect(output).toContain('Edit Commitment');
    expect(output).toContain(
      'Change the Commitment, rules, rhythm, timing, and skips.',
    );
    expect(output).toContain('Invite someone');
    expect(output).toContain('Delete Commitment');
    expect(output).not.toContain('Leave Circle');

    pressByAccessibilityLabel(tree, 'Invite someone');
    expect(navigation.navigate).toHaveBeenCalledWith('ConvertPersonalCircle', {
      circleId: 'circle-1',
    });
  });

  it('shows active member leave settings', async () => {
    mockMemberDetail = detail({viewerRole: 'member'});
    const {navigation, tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle Settings');
    expect(output).not.toContain('MEMBERSHIP');
    expect(output).toContain('Leave Circle');
    expect(output).toContain('Remove your membership and Tap In history.');
    expect(output).not.toContain('Edit Circle');
    expect(output).not.toContain('Delete Circle');

    pressByAccessibilityLabel(tree, 'Leave Circle');
    expect(alertSpy).toHaveBeenCalledWith(
      'Leave circle?',
      'You will stop future Tap Ins and reminders. Your past Tap Ins and shared media will remain in the Circle history.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Keep'}),
        expect.objectContaining({style: 'destructive', text: 'Leave'}),
      ]),
    );
    pressAlertButton('Leave circle?', 'Leave');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLeaveCircle).toHaveBeenCalledWith('circle-1');
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('shows pending member cancel request settings', () => {
    mockMemberDetail = detail({
      viewerMembershipStatus: 'pending',
      viewerRole: 'member',
    });
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle Settings');
    expect(output).not.toContain('MEMBERSHIP');
    expect(output).toContain('Cancel Request');
    expect(output).toContain('Cancel your pending join request.');
    expect(output).not.toContain('Leave Circle');
    expect(output).not.toContain('Edit Circle');
    expect(output).not.toContain('Delete Circle');
  });

  it('shows an empty state for a guest viewer', () => {
    mockMemberDetail = undefined;
    mockSessionState = {status: 'guest'};
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle Settings');
    expect(output).toContain('No settings yet');
    expect(output).toContain('No circle settings are available yet.');
    expect(output).not.toContain('Edit Circle');
    expect(output).not.toContain('Delete Circle');
    expect(output).not.toContain('Leave Circle');
    expect(output).not.toContain('Cancel Request');
  });

  it('shows a loading state while authenticated settings load', () => {
    mockMemberDetail = undefined;
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle Settings');
    expect(output).toContain('Loading circle settings...');
    expect(output).not.toContain('No circle settings are available yet.');
  });
});
