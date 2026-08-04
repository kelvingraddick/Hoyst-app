import React from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {FrostedBackdrop} from '../src/design/components/FrostedBackdrop';
import {SectionEyebrowTrailing} from '../src/design/components/SectionEyebrow';
import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {CircleDetailScreen} from '../src/features/circles/screens/CircleDetailScreen';
import type {CircleDetailModel} from '../src/types/models';

const mockJoinCircle = jest.fn();
const mockNudgeCircleMembers = jest.fn();
const mockReviewJoinRequest = jest.fn();
const mockRemoveTapIn = jest.fn();
const mockCircleThreadSection = jest.fn();
const mockRequireAccount = jest.fn(
  (_pendingAction: unknown, callback: () => void) => callback(),
);

let mockMemberDetail: CircleDetailModel | undefined;
let mockPublicDetail: CircleDetailModel | undefined;
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
  joinCircle: (...args: unknown[]) => mockJoinCircle(...args),
  nudgeCircleMembers: (...args: unknown[]) => mockNudgeCircleMembers(...args),
  reviewJoinRequest: (...args: unknown[]) => mockReviewJoinRequest(...args),
}));

jest.mock('../src/features/circles/components/CircleThreadSection', () => ({
  CircleThreadSection: (props: {
    isArchived: boolean;
    isVisible: boolean;
    loadMoreRequestToken: number;
    onLayout?: (event: unknown) => void;
  }) => {
    const MockReact = require('react');
    const {Text: MockText, View: MockView} = require('react-native');
    mockCircleThreadSection(props);
    return MockReact.createElement(
      MockView,
      {onLayout: props.onLayout, testID: 'circle-thread-section'},
      MockReact.createElement(MockText, null, 'Circle Chat'),
    );
  },
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
    groupProgressDays: [
      {
        coveredCount: 0,
        dateKey: '2026-05-23',
        label: '23',
        state: 'future',
        totalCount: 5,
      },
      {
        coveredCount: 2,
        dateKey: '2026-05-24',
        label: '24',
        state: 'future',
        totalCount: 5,
      },
      {
        coveredCount: 5,
        dateKey: '2026-05-25',
        label: '25',
        state: 'done',
        totalCount: 5,
      },
      {
        coveredCount: 0,
        dateKey: '2026-05-26',
        label: '26',
        state: 'future',
        totalCount: 5,
      },
      {
        coveredCount: 0,
        dateKey: '2026-05-27',
        label: '27',
        state: 'future',
        totalCount: 5,
      },
      {
        coveredCount: 0,
        dateKey: '2026-05-28',
        label: '28',
        state: 'future',
        totalCount: 5,
      },
      {
        coveredCount: 0,
        dateKey: '2026-05-29',
        label: '29',
        state: 'future',
        totalCount: 5,
      },
    ],
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

describe('CircleDetailScreen reference redesign', () => {
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockMemberDetail = detail();
    mockPublicDetail = undefined;
    mockSessionState = {
      status: 'authenticatedReady',
      user: {providerIds: [], uid: 'user-1'},
    };
    mockJoinCircle.mockResolvedValue({status: 'active'});
    mockNudgeCircleMembers.mockResolvedValue({nudged: 1});
    mockReviewJoinRequest.mockResolvedValue({status: 'approved'});
    mockRemoveTapIn.mockResolvedValue({dateKey: '2026-05-29', removed: true});
    mockRequireAccount.mockClear();
  });

  afterEach(() => {
    alertSpy.mockRestore();
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
    expect(output).toContain('Circle Chat');
    expect(output).toContain('1 of 4 today');
    expect(output).not.toContain('Circle Companions · 1 of 4 today');
    expect(output).not.toContain("Today's Progress");
    expect(output).toContain('Needs Tap In');
    expect(output).toContain('Done');
    expect(output).toContain('Skipped');
    expect(output).toContain('Missed');
    expect(output).toContain('Pending');
    expect(output).not.toContain('Review');
    expect(output).toContain('Tap In');
    expect(output).toContain('Log your progress for today');
    expect(output.indexOf('Log your progress for today')).toBeLessThan(
      output.indexOf('Stats'),
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
    expect(output.indexOf('Stats')).toBeLessThan(output.indexOf('3 days'));
    expect(output.indexOf('3 days')).toBeLessThan(
      output.indexOf('Circle progression'),
    );
    expect(output.indexOf('Circle progression')).toBeLessThan(
      output.indexOf('LAST 7 DAYS'),
    );
    expect(output.indexOf('LAST 7 DAYS')).toBeLessThan(
      output.indexOf('Circle Companions'),
    );
    expect(output).toContain('LAST 7 DAYS');
    expect(output).not.toContain('This week');
    expect(output).not.toContain('Completion');
    expect(output).not.toContain('Members');
    expect(output).not.toContain('Your last 7 days');
    expect(output).toContain('partial, 2 of 5 completed');
    expect(output).toContain('complete, 5 of 5 completed');
    expect(output).toContain('empty, 0 of 5 completed');
    expect(
      tree.root.findByProps({
        testID: 'week-progress-2026-05-24-partial-ring',
      }),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'week-progress-2026-05-25-chip'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({backgroundColor: '#22A565'}));
    expect(output).not.toContain('M13 2L4 13.5h5.5L9 22l9-12h-6z');
    expect(output).not.toContain('M7 7 17 17M17 7 7 17');
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
    expect(
      tree.root.findByProps({testID: 'circle-stats-streak-pill'}).props
        .accessibilityLabel,
    ).toBe('Streak 3 days');
    expect(
      tree.root
        .findAllByProps({testID: 'circle-stats-streak-icon'})
        .some(icon => icon.props.size === 16 || icon.props.height === 16),
    ).toBe(true);
    expect(output).not.toContain('Circle Tools');
    expect(output).not.toContain('Member Tools');
    expect(output).not.toContain('Leaderboard');
    expect(output).not.toContain('Goals');
    expect(output).not.toContain('Invite companions');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-body-stack'}).props.style,
      ),
    ).toEqual(expect.objectContaining({paddingTop: 8}));
    const trailingLabels = tree.root
      .findAllByType(SectionEyebrowTrailing)
      .map(textContent);

    expect(trailingLabels).toEqual(expect.arrayContaining(['1 of 4 today']));
    expect(trailingLabels).not.toContain('This week');
  });

  it('embeds circle chat below the companion grid without navigation', () => {
    const {navigation, tree} = renderScreen();
    const output = outputOf(tree);
    const sectionProps = mockCircleThreadSection.mock.calls.at(-1)?.[0];

    expect(output.indexOf('Circle Companions')).toBeLessThan(
      output.indexOf('Circle Chat'),
    );
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Open circle chat'}),
    ).toHaveLength(0);
    expect(sectionProps).toEqual(
      expect.objectContaining({
        circleId: 'circle-1',
        isArchived: false,
        isVisible: false,
        loadMoreRequestToken: 0,
        timezone: 'UTC',
        viewerUid: 'user-1',
      }),
    );
    expect(navigation.navigate).not.toHaveBeenCalledWith(
      'CircleThread',
      expect.anything(),
    );
  });

  it('keeps the nudge directly above the embedded chat', () => {
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
    const actionStackStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-detail-companion-actions'}).props
        .style,
    );
    const nudgeFrameStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-detail-nudge-panel-frame'}).props
        .style,
    );

    expect(output.indexOf('Send a Nudge')).toBeLessThan(
      output.indexOf('Circle Chat'),
    );
    expect(actionStackStyle).toEqual(expect.objectContaining({gap: 10}));
    expect(nudgeFrameStyle).toEqual(expect.objectContaining({minHeight: 58}));
  });

  it('marks chat visible and requests pagination from outer page scrolling', () => {
    const {tree} = renderScreen();
    const outerScroll = tree.root
      .findAllByType(ScrollView)
      .find(node => node.props.horizontal !== true);
    const body = tree.root.findByProps({testID: 'circle-detail-body-stack'});
    const thread = tree.root.findByProps({testID: 'circle-thread-section'});

    act(() => {
      outerScroll?.props.onLayout({nativeEvent: {layout: {height: 600}}});
      outerScroll?.props.onContentSizeChange(390, 2000);
      body.props.onLayout({nativeEvent: {layout: {y: 400}}});
      thread.props.onLayout({nativeEvent: {layout: {y: 800}}});
    });

    expect(mockCircleThreadSection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        isVisible: false,
        loadMoreRequestToken: 0,
      }),
    );

    act(() => {
      outerScroll?.props.onScroll({
        nativeEvent: {
          contentOffset: {y: 650},
          contentSize: {height: 2000},
          layoutMeasurement: {height: 600},
        },
      });
    });

    expect(mockCircleThreadSection.mock.calls.at(-1)?.[0].isVisible).toBe(true);
    expect(
      mockCircleThreadSection.mock.calls.at(-1)?.[0].loadMoreRequestToken,
    ).toBe(0);

    act(() => {
      outerScroll?.props.onScroll({
        nativeEvent: {
          contentOffset: {y: 1200},
          contentSize: {height: 2000},
          layoutMeasurement: {height: 600},
        },
      });
    });

    expect(
      mockCircleThreadSection.mock.calls.at(-1)?.[0].loadMoreRequestToken,
    ).toBe(1);

    act(() => {
      outerScroll?.props.onScroll({
        nativeEvent: {
          contentOffset: {y: 1210},
          contentSize: {height: 2000},
          layoutMeasurement: {height: 600},
        },
      });
    });

    expect(
      mockCircleThreadSection.mock.calls.at(-1)?.[0].loadMoreRequestToken,
    ).toBe(1);
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
    expect(output).not.toContain('Circle Tools');
    expect(output.indexOf('Stats')).toBeLessThan(
      output.indexOf('Remove Tap In'),
    );
    expect(output.indexOf('Remove Tap In')).toBeLessThan(
      output.indexOf('Circle Chat'),
    );
  });

  it('shows remove alongside Update Tap In for saved quantity circles', async () => {
    mockMemberDetail = detail({
      commitmentType: 'build',
      currentValue: 5,
      completionRate: 100,
      progressLabel: 'Today 100%',
      remainingCheckIns: 0,
      state: 'done',
      targetValue: 5,
      unitLabel: 'pages',
      viewerCanUpdateTapIn: true,
      viewerHasCheckedIn: true,
      viewerHasTappedInToday: true,
      viewerRemainingTapIns: 0,
      viewerRole: 'owner',
      viewerTodayCheckIn: {
        coverageStatus: 'covered',
        currentValue: 5,
        status: 'done',
      },
      viewerTodayStatus: 'done',
    });

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Update Tap In');
    expect(output).toContain('Remove Tap In');
    expect(output).not.toContain('View Today');

    const removeButton = tree.root
      .findAllByType(Pressable)
      .find(node => textContent(node).includes('Remove Tap In'));

    if (!removeButton) {
      throw new Error('Remove Tap In button was not found');
    }

    act(() => {
      removeButton.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Remove today?',
      "This will delete today's saved quantity and reopen this Tap In.",
      expect.arrayContaining([
        expect.objectContaining({text: 'Keep'}),
        expect.objectContaining({style: 'destructive', text: 'Remove'}),
      ]),
    );

    pressAlertButton('Remove today?', 'Remove');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRemoveTapIn).toHaveBeenCalledWith({circleId: 'circle-1'});
  });

  it('keeps owner settings off the detail body', () => {
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
    const output = outputOf(tree);

    expect(output).not.toContain('Circle Tools');
    expect(output).toContain('Circle Companions');
    expect(output).toContain('0 of 0 this week');
    expect(output).toContain('Invite companions');
    expect(output).not.toContain('Circle Companions · 0 of 0 this week');
    expect(output).not.toContain('Leaderboard');
    expect(output).not.toContain('Goals');
    expect(output).toContain('Review');
    expect(output).not.toContain('Edit Circle');
    expect(output).not.toContain('Delete Circle');
  });

  it('opens the pending request review sheet from the companion card', () => {
    mockMemberDetail = detail({
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
    const reviewButton = tree.root.findByProps({
      accessibilityLabel: "Review Jordan's join request",
    });

    act(() => {
      reviewButton.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Review join request',
      "Approve or deny Jordan's request to join Morning Movers?",
      expect.arrayContaining([
        expect.objectContaining({text: 'Cancel'}),
        expect.objectContaining({style: 'destructive', text: 'Deny'}),
        expect.objectContaining({text: 'Approve'}),
      ]),
    );
  });

  it('approves a pending request from the companion card sheet', async () => {
    mockMemberDetail = detail({
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
    const reviewButton = tree.root.findByProps({
      accessibilityLabel: "Review Jordan's join request",
    });

    act(() => {
      reviewButton.props.onPress();
    });
    pressAlertButton('Review join request', 'Approve');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReviewJoinRequest).toHaveBeenCalledWith({
      approved: true,
      circleId: 'circle-1',
      requesterId: 'requester-1',
    });
  });

  it('denies a pending request from the companion card sheet', async () => {
    mockMemberDetail = detail({
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
    mockReviewJoinRequest.mockResolvedValueOnce({status: 'declined'});

    const {tree} = renderScreen();
    const reviewButton = tree.root.findByProps({
      accessibilityLabel: "Review Jordan's join request",
    });

    act(() => {
      reviewButton.props.onPress();
    });
    pressAlertButton('Review join request', 'Deny');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReviewJoinRequest).toHaveBeenCalledWith({
      approved: false,
      circleId: 'circle-1',
      requesterId: 'requester-1',
    });
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
    const nudgeFrameStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-detail-nudge-panel-frame'}).props
        .style,
    );
    const nudgeIconStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-detail-nudge-icon'}).props.style,
    );
    const nudgeActionStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-detail-nudge-action'}).props.style,
    );
    const nudgeTitle = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Send a Nudge');
    const nudgeSubtitle = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === '1 member to nudge');

    expect(
      StyleSheet.flatten(nudgeButton.props.style({pressed: false})),
    ).toEqual(expect.objectContaining({borderRadius: 20}));
    expect(nudgeFrameStyle).toEqual(
      expect.objectContaining({
        borderWidth: 1,
        minHeight: 58,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }),
    );
    expect(nudgeIconStyle).toEqual(
      expect.objectContaining({height: 40, width: 40}),
    );
    expect(nudgeActionStyle).toEqual(
      expect.objectContaining({height: 30, width: 30}),
    );
    expect(StyleSheet.flatten(nudgeTitle?.props.style)).toEqual(
      expect.objectContaining({fontSize: 15, lineHeight: 19}),
    );
    expect(StyleSheet.flatten(nudgeSubtitle?.props.style)).toEqual(
      expect.objectContaining({fontSize: 13, lineHeight: 17}),
    );
    expect(output.indexOf('Stats')).toBeLessThan(
      output.indexOf('Circle Companions'),
    );
    expect(output.indexOf('Circle Companions')).toBeLessThan(
      output.indexOf('Send a Nudge'),
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

  it('shows pending membership without member tools', () => {
    mockMemberDetail = detail({
      streakLabel: 'Pending approval',
      viewerMembershipStatus: 'pending',
      viewerRole: 'member',
    });

    const {tree} = renderScreen();

    expect(outputOf(tree)).toContain('Pending approval');
    expect(outputOf(tree)).toContain('Pending');
    expect(outputOf(tree)).not.toContain('Member Tools');
    expect(outputOf(tree)).not.toContain('Cancel Request');
    expect(outputOf(tree)).not.toContain('Circle Chat');
    expect(mockCircleThreadSection).not.toHaveBeenCalled();
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
    expect(output).not.toContain('Circle Chat');
    expect(mockCircleThreadSection).not.toHaveBeenCalled();
  });

  it('renders progression and the compact streak header from existing data', () => {
    const {tree} = renderScreen();
    const output = outputOf(tree);
    const progressValue = tree.root.findByProps({
      testID: 'circle-stats-progress-value',
    });
    const progressValueStyle = StyleSheet.flatten(progressValue.props.style);
    const progressFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-stats-progress-fill'}).props.style,
    );

    expect(output).toContain('Stats');
    expect(textContent(progressValue)).toBe('60%');
    expect(progressFillStyle).toEqual(
      expect.objectContaining({
        backgroundColor: progressValueStyle.color,
        height: 10,
        width: '60%',
      }),
    );
    expect(output).toContain('3 days');
    expect(output).not.toContain('Completion');
    expect(output).not.toContain('Members');
    expect(output).not.toContain('This week');
  });

  it.each([
    [0, '0 days'],
    [1, '1 day'],
    [3, '3 days'],
  ] as const)('formats a %i-day streak as %s', (streakDays, expectedLabel) => {
    mockMemberDetail = detail({streakDays});

    const {tree} = renderScreen();
    const streakLabel = tree.root
      .findAllByProps({testID: 'circle-stats-streak-label'})
      .find(node => textContent(node) === expectedLabel);

    expect(streakLabel).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'circle-stats-streak-pill'}).props
        .accessibilityLabel,
    ).toBe(`Streak ${expectedLabel}`);
  });

  it('keeps personal commitment details private and free of group surfaces', () => {
    mockMemberDetail = detail({
      circleMode: 'personal',
      commitment: 'Move for 30 minutes',
      inviteUrl: undefined,
      maxSize: 1,
      memberCount: 1,
      members: [
        {
          id: 'user-1',
          initials: 'KM',
          name: 'Kelvin',
          state: 'pending',
        },
      ],
      nudgeTargetCount: 0,
      privacy: 'private',
      title: 'Move for 30 minutes',
      viewerRole: 'owner',
    });

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Personal Commitment');
    expect(output).toContain('Personal commitment');
    expect(output).toContain('Personal progress');
    expect(output.indexOf('Stats')).toBeLessThan(output.indexOf('3 days'));
    expect(output.indexOf('3 days')).toBeLessThan(
      output.indexOf('Personal progress'),
    );
    expect(output.indexOf('Personal progress')).toBeLessThan(
      output.indexOf('LAST 7 DAYS'),
    );
    expect(output).not.toContain('Circle Companions');
    expect(output).not.toContain('Circle Chat');
    expect(output).not.toContain('Completion');
    expect(output).not.toContain('Members');
    expect(output).toContain('3 days');
    expect(
      tree.root
        .findAllByProps({testID: 'circle-stats-streak-label'})
        .some(node => textContent(node) === '3 days'),
    ).toBe(true);
    expect(mockCircleThreadSection).not.toHaveBeenCalled();
  });

  it('renders archived Circle history without active controls', () => {
    mockMemberDetail = detail({
      archivedAt: new Date('2026-08-04T12:00:00Z'),
      lifecycleStatus: 'archived',
      viewerRole: 'owner',
    });

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Circle archived');
    expect(output).toContain('Read-only history');
    expect(output).toContain('Archived Aug 4, 2026');
    expect(output).toContain('Circle Chat');
    expect(output).not.toContain('Log your progress for today');
    expect(output).not.toContain('Send a Nudge');
    expect(output).not.toContain('Invite companions');
    expect(tree.root.findAllByType(TapInPulseButton)).toHaveLength(0);
    expect(mockCircleThreadSection.mock.calls.at(-1)?.[0].isArchived).toBe(
      true,
    );
  });

  it('opens circle settings from the header gear', () => {
    const {navigation, tree} = renderScreen();
    const settingsButton = tree.root.findByProps({
      accessibilityLabel: 'Open circle settings',
    });

    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Open Inbox'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Invite members'}),
    ).toHaveLength(0);

    act(() => {
      settingsButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('CircleTools', {
      circleId: 'circle-1',
    });
  });
});
