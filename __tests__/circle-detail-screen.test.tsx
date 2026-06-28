import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {FrostedBackdrop} from '../src/design/components/FrostedBackdrop';
import {SectionEyebrowTrailing} from '../src/design/components/SectionEyebrow';
import {StatBarCard} from '../src/design/components/StatBarCard';
import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {CircleDetailScreen} from '../src/features/circles/screens/CircleDetailScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockJoinCircle = jest.fn();
const mockLeaveCircle = jest.fn();
const mockNudgeCircleMembers = jest.fn();
const mockReviewJoinRequest = jest.fn();
const mockDeleteCircle = jest.fn();
const mockRemoveTapIn = jest.fn();
const mockRequireAccount = jest.fn(
  (_pendingAction: unknown, callback: () => void) => callback(),
);

let mockMemberDetail: CircleDetailModel | undefined;
let mockPublicDetail: CircleDetailModel | undefined;
let mockSessionState: {
  status: 'authenticatedReady' | 'guest';
  user?: {providerIds: string[]; uid: string};
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

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
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

jest.mock('../src/features/auth/hooks/useProtectedAction', () => ({
  useProtectedAction: () => mockRequireAccount,
}));

jest.mock('../src/features/check-in/services/check-in-service', () => ({
  removeTapIn: (...args: unknown[]) => mockRemoveTapIn(...args),
}));

jest.mock('../src/features/circles/mockData', () => ({
  getCircleDetail: jest.fn(() => undefined),
}));

jest.mock('../src/features/circles/services/circle-service', () => ({
  deleteCircle: (...args: unknown[]) => mockDeleteCircle(...args),
  joinCircle: (...args: unknown[]) => mockJoinCircle(...args),
  leaveCircle: (...args: unknown[]) => mockLeaveCircle(...args),
  nudgeCircleMembers: (...args: unknown[]) => mockNudgeCircleMembers(...args),
  reviewJoinRequest: (...args: unknown[]) => mockReviewJoinRequest(...args),
}));

jest.mock('../src/features/circles/services/public-circle-service', () => ({
  subscribeToPublicCircle: jest.fn(
    (
      _circleId: string,
      onCircle: (circle: CircleDetailModel) => void,
      onError: () => void,
    ) => {
      if (mockPublicDetail) {
        onCircle(mockPublicDetail);
      } else {
        onError();
      }

      return jest.fn();
    },
  ),
}));

jest.mock('../src/features/home/services/home-data-service', () => ({
  buildPublicCircleDetail: jest.fn(() => mockPublicDetail),
  subscribeToMemberCircleDetail: jest.fn(
    ({onDetail}: {onDetail: (detail: CircleDetailModel) => void}) => {
      if (mockMemberDetail) {
        onDetail(mockMemberDetail);
      }

      return jest.fn();
    },
  ),
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
    id: 'circle-1',
    inviteUrl: 'https://hoyst.app/join/circle-1',
    joinLabel: 'Open seats',
    joinMode: 'open',
    maxSize: 8,
    memberCount: 5,
    members: [
      {
        id: 'user-1',
        initials: 'KM',
        name: 'Kelvin',
        state: 'pending',
      },
      {
        id: 'user-2',
        initials: 'AR',
        name: 'Ari',
        state: 'done',
      },
      {
        id: 'user-3',
        initials: 'SK',
        name: 'Sky',
        state: 'skipped',
      },
      {
        id: 'user-4',
        initials: 'MS',
        name: 'Moss',
        state: 'missed',
      },
      {
        id: 'user-5',
        initials: 'PN',
        membershipStatus: 'pending',
        name: 'Penny',
        state: 'pending',
      },
    ],
    monthProgress: [
      {day: 27, state: 'done'},
      {day: 28, state: 'missed'},
      {day: 29, state: 'today'},
      {day: 30, state: 'future'},
      {day: 31, state: 'future'},
      {day: 1, state: 'future'},
      {day: 2, state: 'future'},
    ],
    privacy: 'public',
    progressLabel: 'Today 60%',
    progressPercent: 60,
    remainingCheckIns: 1,
    state: 'active',
    streakDays: 3,
    streakLabel: '3d streak',
    title: 'Morning Movers',
    viewerHasCheckedIn: false,
    viewerHasTappedInToday: false,
    viewerMembershipStatus: 'active',
    viewerRemainingTapIns: 1,
    viewerRole: 'member',
    viewerTodayStatus: 'rest',
    ...overrides,
  };
}

function renderScreen() {
  const navigation = {
    canGoBack: jest.fn(() => false),
    goBack: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  };
  let tree: renderer.ReactTestRenderer | undefined;

  act(() => {
    tree = renderer.create(
      <CircleDetailScreen
        navigation={navigation as never}
        route={
          {
            key: 'CircleDetail',
            name: 'CircleDetail',
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

function pressByLabel(tree: renderer.ReactTestRenderer, label: string) {
  const match = tree.root.findAll(
    node => node.type === Pressable && textContent(node).includes(label),
  )[0];

  if (!match) {
    throw new Error(`Could not find pressable with label ${label}`);
  }

  act(() => {
    match.props.onPress();
  });
}

describe('CircleDetailScreen reference redesign', () => {
  beforeEach(() => {
    mockMemberDetail = detail();
    mockPublicDetail = undefined;
    mockSessionState = {
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    };
    mockJoinCircle.mockResolvedValue({status: 'active'});
    mockLeaveCircle.mockResolvedValue({status: 'left'});
    mockNudgeCircleMembers.mockResolvedValue({nudged: 1});
    mockReviewJoinRequest.mockResolvedValue({status: 'approved'});
    mockDeleteCircle.mockResolvedValue(undefined);
    mockRemoveTapIn.mockResolvedValue({dateKey: '2026-05-29', removed: true});
    mockRequireAccount.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders reference identity and companion progress for an active member', () => {
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output.indexOf('Circle')).toBeLessThan(
      output.indexOf('Morning Movers'),
    );
    expect(output).toContain('Morning Movers');
    expect(output).toContain('FITNESS');
    expect(
      tree.root.findByProps({testID: 'circle-detail-title-category-icon'}),
    ).toBeTruthy();
    expect(tree.root.findByType(FrostedBackdrop).props.topAccentColor).toBe(
      '#10B967',
    );
    expect(
      tree.root.findAll(node => {
        const style = StyleSheet.flatten(node.props.style);
        return (
          style?.backgroundColor === '#E7F8EF' &&
          style?.borderRadius === 14 &&
          style?.height === 52 &&
          style?.width === 52
        );
      }).length,
    ).toBeGreaterThan(0);
    const taskDescription = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Move for 30 minutes');
    expect(StyleSheet.flatten(taskDescription?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 15,
        lineHeight: 20,
      }),
    );
    const publicMeta = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Public');
    expect(StyleSheet.flatten(publicMeta?.props.style)).toEqual(
      expect.objectContaining({color: '#817FA2', fontWeight: '500'}),
    );
    const membersMeta = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === '5/8');
    expect(StyleSheet.flatten(membersMeta?.props.style)).toEqual(
      expect.objectContaining({fontWeight: '500'}),
    );
    expect(output).toContain('Daily Task');
    expect(output).toContain('Move for 30 minutes');
    expect(output.indexOf('Morning Movers')).toBeLessThan(
      output.indexOf('Move for 30 minutes'),
    );
    expect(output.indexOf('Move for 30 minutes')).toBeLessThan(
      output.indexOf('FITNESS'),
    );
    expect(output.indexOf('FITNESS')).toBeLessThan(
      output.indexOf('Daily Task'),
    );
    expect(output.indexOf('Daily Task')).toBeLessThan(
      output.indexOf('Needs You'),
    );
    expect(output).toContain('Needs You');
    expect(output).toContain('Circle Companions');
    expect(output).toContain('1 of 4 today');
    expect(output).not.toContain('Circle Companions · 1 of 4 today');
    expect(output).not.toContain("Today's Progress");
    expect(output).toContain('Needs Tap In');
    expect(output).toContain('Done');
    expect(output).toContain('Skipped');
    expect(output).toContain('Missed');
    expect(output).toContain('Pending');
    expect(output).toContain('Tap In');
    expect(output).toContain('Log your progress for today');
    expect(output.indexOf('Log your progress for today')).toBeLessThan(
      output.indexOf('Circle progression'),
    );
    expect(output.indexOf('Circle progression')).toBeLessThan(
      output.indexOf('Circle Companions'),
    );
    const firstCompanionPage = textContent(
      tree.root.findByProps({testID: 'circle-companion-grid-page-0'}),
    );
    expect(firstCompanionPage.indexOf('Kelvin')).toBeLessThan(
      firstCompanionPage.indexOf('Ari'),
    );
    expect(firstCompanionPage.indexOf('Ari')).toBeLessThan(
      firstCompanionPage.indexOf('Sky'),
    );
    expect(firstCompanionPage.indexOf('Sky')).toBeLessThan(
      firstCompanionPage.indexOf('Moss'),
    );
    expect(firstCompanionPage).not.toContain('Penny');
    expect(output.indexOf('Circle Companions')).toBeLessThan(
      output.indexOf('This week'),
    );
    expect(output.indexOf('Circle Companions')).toBeLessThan(
      output.indexOf('Stats'),
    );
    expect(output.indexOf('Stats')).toBeLessThan(output.indexOf('This week'));
    expect(output.indexOf('This week')).toBeLessThan(
      output.indexOf('Completion'),
    );
    expect(
      tree.root
        .findAllByType(TapInPulseButton)
        .some(button => button.props.variant === 'hero'),
    ).toBe(true);
    expect(
      tree.root.findAll(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.marginTop === 6;
      }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findAllByType(StatBarCard)).toHaveLength(3);
    const completionIcons = tree.root.findAllByProps({
      testID: 'circle-detail-completion-icon',
    });
    const streakIcons = tree.root.findAllByProps({
      testID: 'circle-detail-streak-icon',
    });
    expect(
      completionIcons.some(
        icon => icon.props.height === 26 && icon.props.width === 26,
      ),
    ).toBe(true);
    expect(
      streakIcons.some(
        icon => icon.props.height === 26 && icon.props.width === 26,
      ),
    ).toBe(true);
    const hasArtworkSize = (testID: string, size: number) =>
      tree.root.findAllByProps({testID}).some(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.height === size && style?.width === size;
      });
    expect(
      hasArtworkSize('circle-detail-artwork-members', 26),
    ).toBe(true);
    expect(
      hasArtworkSize('circle-detail-artwork-members', 24),
    ).toBe(true);
    expect(
      hasArtworkSize('circle-detail-artwork-leaderboard', 24),
    ).toBe(true);
    expect(
      hasArtworkSize('circle-detail-artwork-goals', 24),
    ).toBe(true);
    expect(
      hasArtworkSize('circle-detail-artwork-settings', 24),
    ).toBe(true);
    expect(output).not.toContain('Invite companions');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-body-stack'}).props.style,
      ),
    ).toEqual(expect.objectContaining({paddingTop: 8}));
    const trailingLabels = tree.root
      .findAllByType(SectionEyebrowTrailing)
      .map(textContent);

    expect(trailingLabels).toEqual(
      expect.arrayContaining(['1 of 4 today', 'This week']),
    );
  });

  it('shows view and remove actions after today is counted', () => {
    mockMemberDetail = detail({
      completionRate: 100,
      progressLabel: 'Today 100%',
      remainingCheckIns: 0,
      state: 'done',
      streakLabel: 'Already tapped in',
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerRole: 'owner',
      viewerTodayStatus: 'done',
    });

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('View Today');
    expect(output).toContain('Remove Tap In');
    expect(output).toContain('Tapped today');
    expect(output.indexOf('Circle Tools')).toBeLessThan(
      output.indexOf('Remove Tap In'),
    );
  });

  it('keeps owner tools nested under manage', () => {
    mockMemberDetail = detail({
      commitmentCadence: 'weekly',
      members: [
        {
          id: 'requester-1',
          initials: 'JR',
          membershipStatus: 'pending',
          name: 'Jordan',
          state: 'pending',
        },
      ],
      viewerRole: 'owner',
    });

    const {tree} = renderScreen();

    expect(outputOf(tree)).toContain('Circle Tools');
    expect(outputOf(tree)).toContain('Circle Companions');
    expect(outputOf(tree)).toContain('0 of 0 this week');
    expect(outputOf(tree)).toContain('Invite companions');
    expect(outputOf(tree)).not.toContain(
      'Circle Companions · 0 of 0 this week',
    );
    expect(outputOf(tree)).toContain('Members');
    expect(outputOf(tree)).toContain('Leaderboard');
    expect(outputOf(tree)).toContain('Goals');
    expect(outputOf(tree)).toContain('Settings');
    expect(outputOf(tree)).not.toContain('Edit Circle');
    const toolSubtitle = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'View all');
    expect(StyleSheet.flatten(toolSubtitle?.props.style)).toEqual(
      expect.objectContaining({color: '#9491B2'}),
    );

    pressByLabel(tree, 'Settings');

    const output = outputOf(tree);
    expect(output).toContain('Wants to join');
    expect(output).toContain('Edit Circle');
    expect(output).toContain('Delete Circle');
  });

  it('shows secondary nudge action only when targets exist', () => {
    mockMemberDetail = detail({
      members: [
        {
          id: 'user-1',
          initials: 'KM',
          name: 'Kelvin',
          state: 'done',
        },
        {
          id: 'user-2',
          initials: 'AR',
          name: 'Ari',
          state: 'pending',
        },
      ],
      nudgeTargetCount: 1,
    });

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Send a Nudge');
    expect(output).toContain('1 member to nudge');
    expect(output).toContain('rgba(122,85,255,0.11)');
    expect(output).toContain('rgba(122,85,255,0.12)');
    const nudgeButton = tree.root.findByProps({
      accessibilityLabel: 'Send a Nudge. 1 member to nudge',
    });
    expect(
      StyleSheet.flatten(nudgeButton.props.style({pressed: false})),
    ).toEqual(expect.objectContaining({borderRadius: 20}));
    expect(output.indexOf('Circle Companions')).toBeLessThan(
      output.indexOf('Send a Nudge'),
    );
    expect(output.indexOf('Send a Nudge')).toBeLessThan(
      output.indexOf('Stats'),
    );
    expect(output).not.toContain('Send Nudge');
    expect(output).not.toContain('Invite');
  });

  it('targets a single companion from the member card nudge action', async () => {
    mockMemberDetail = detail({
      members: [
        {
          id: 'user-1',
          initials: 'KM',
          name: 'Kelvin',
          state: 'done',
        },
        {
          id: 'user-2',
          initials: 'AR',
          name: 'Ari',
          state: 'pending',
        },
      ],
      nudgeTargetCount: 1,
    });

    const {tree} = renderScreen();
    const nudgeButtons = tree.root.findAll(
      node =>
        node.type === Pressable &&
        node.props.accessibilityLabel === 'Nudge 1 member',
    );

    expect(nudgeButtons).toHaveLength(1);

    act(() => {
      nudgeButtons[0].props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockNudgeCircleMembers).toHaveBeenCalledWith('circle-1', 'user-2');
    expect(outputOf(tree)).toContain('Nudged');
  });

  it('shows pending membership and cancel request tools', () => {
    mockMemberDetail = detail({
      streakLabel: 'Pending approval',
      viewerMembershipStatus: 'pending',
      viewerRole: 'member',
    });

    const {tree} = renderScreen();

    expect(outputOf(tree)).toContain('Pending approval');
    expect(outputOf(tree)).toContain('Pending');

    pressByLabel(tree, 'Settings');

    expect(outputOf(tree)).toContain('Cancel Request');
  });

  it('renders public preview copy and join action', () => {
    mockMemberDetail = undefined;
    mockPublicDetail = detail({
      matchCopy: 'A steady crew for morning movement.',
      viewerHasCheckedIn: undefined,
      viewerMembershipStatus: undefined,
      viewerRole: undefined,
      viewerTodayStatus: undefined,
    });
    mockSessionState = {status: 'guest'};

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('A steady crew for morning movement.');
    expect(output).toContain('Join Circle');
    expect(output).not.toContain('Needs You');
  });

  it('renders stats from existing progress data', () => {
    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Stats');
    expect(output).toContain('Completion');
    expect(output).toContain('60%');
    expect(output).toContain('Streak');
    expect(output).toContain('3');
    expect(output).toContain('Members');
    expect(output).toContain('5/8');
  });

  it('opens the Inbox from the header bell', () => {
    const {navigation, tree} = renderScreen();
    const inboxButton = tree.root.findByProps({
      accessibilityLabel: 'Open Inbox',
    });

    act(() => {
      inboxButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('Inbox');
  });
});
