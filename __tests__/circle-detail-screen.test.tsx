import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import renderer, {act, type ReactTestInstance} from 'react-test-renderer';

import {TapInPulseButton} from '../src/design/components/TapInPulseButton';
import {CircleDetailScreen} from '../src/features/circles/screens/CircleDetailScreen';
import type {CircleDetailModel, CircleThreadItem} from '../src/types/models';

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
let mockPersistedGroupStreakDays = 3;
let mockAppearance: 'dark' | 'light' = 'light';
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
    useSafeAreaInsets: () => ({bottom: 0, left: 0, right: 0, top: 59}),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (
    selector: (state: {appearance: 'dark' | 'light'}) => unknown,
  ) => selector({appearance: mockAppearance}),
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
    onShareTapIn?: (item: CircleThreadItem) => void;
  }) => {
    const MockReact = require('react');
    const {Text: MockText, View: MockView} = require('react-native');
    mockCircleThreadSection(props);
    return MockReact.createElement(
      MockView,
      {onLayout: props.onLayout, testID: 'circle-thread-section'},
      MockReact.createElement(MockText, null, 'Circle Feed'),
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

jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => ({
    collection: () => ({
      doc: () => ({
        onSnapshot: (
          onSnapshot: (snapshot: {
            data: () => {groupStreakDays: number};
          }) => void,
        ) => {
          onSnapshot({
            data: () => ({groupStreakDays: mockPersistedGroupStreakDays}),
          });
          return jest.fn();
        },
      }),
    }),
  }),
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
    groupStreakDays: 3,
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

function getHeroTapInButton(tree: renderer.ReactTestRenderer) {
  const button = tree.root
    .findAllByType(TapInPulseButton)
    .find(candidate => candidate.props.variant === 'hero');

  if (!button) {
    throw new Error('Circle Detail hero Tap In button was not found');
  }

  return button;
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

function selectMember(tree: renderer.ReactTestRenderer, memberId: string) {
  const member = tree.root.findByProps({
    testID: `circle-member-strip-member-${memberId}`,
  });

  act(() => {
    member.props.onPress();
  });
}

describe('CircleDetailScreen reference redesign', () => {
  beforeEach(() => {
    mockAppearance = 'light';
    mockPersistedGroupStreakDays = 3;
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

  it('renders the Home-inspired identity, group progress, and member strip', () => {
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
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-home-canvas'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({backgroundColor: '#FAFAF7'}));
    const heroTintRegion = tree.root.findByProps({
      testID: 'circle-detail-hero-tint-region',
    });
    act(() => {
      heroTintRegion.props.onLayout({nativeEvent: {layout: {height: 241}}});
    });
    expect(
      tree.root.findByProps({testID: 'circle-detail-top-tint'}).props.colors,
    ).toEqual(['#10B96724', '#FAFAF7']);
    expect(
      tree.root.findByProps({testID: 'circle-detail-top-tint'}).props.locations,
    ).toEqual([0, 1]);
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-top-tint-frame'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({height: 300, top: 0}));
    expect(
      tree.root.findByProps({testID: 'circle-detail-background'}),
    ).toBeTruthy();
    expect(
      tree.root
        .findByProps({testID: 'circle-detail-background'})
        .findAllByProps({testID: 'circle-detail-top-tint-frame'}),
    ).not.toHaveLength(0);
    expect(
      heroTintRegion.findAllByProps({testID: 'circle-detail-top-tint'}),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'circle-detail-safe-area-tint'}),
    ).toHaveLength(0);
    expect(
      heroTintRegion.findAllByProps({
        testID: 'circle-detail-hero-primary-action',
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'circle-detail-hero-primary-action'})
        .parent,
    ).toBe(
      tree.root.findByProps({testID: 'circle-detail-hero-tint-region'}).parent,
    );
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-hero-content'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({gap: 10}));
    expect(StyleSheet.flatten(heroTintRegion.props.style)).toEqual(
      expect.objectContaining({paddingBottom: 8}),
    );
    const primaryAction = tree.root.findByProps({
      testID: 'circle-detail-hero-primary-action',
    });
    expect(StyleSheet.flatten(primaryAction.props.style)).toEqual(
      expect.not.objectContaining({marginTop: expect.anything()}),
    );
    expect(StyleSheet.flatten(primaryAction.parent?.props.style)).toEqual(
      expect.objectContaining({gap: 4}),
    );
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-body-stack'}).props.style,
      ),
    ).toEqual(expect.objectContaining({paddingTop: 20}));
    expect(
      tree.root.findAllByProps({testID: 'circle-detail-hero-surface'}),
    ).toHaveLength(0);
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-stats-content'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({gap: 8}));
    expect(
      tree.root.findAllByProps({testID: 'circle-detail-stats-surface'}),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'circle-group-week-path'}),
    ).toBeTruthy();
    const taskDescription = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Move for 30 minutes');
    expect(StyleSheet.flatten(taskDescription?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
      }),
    );
    const circleTitle = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Morning Movers');
    expect(StyleSheet.flatten(circleTitle?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 29,
      }),
    );
    const navigationTitle = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Circle');
    expect(StyleSheet.flatten(navigationTitle?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 17,
        fontWeight: '600',
        lineHeight: 21,
      }),
    );
    const categoryLabel = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'FITNESS');
    expect(StyleSheet.flatten(categoryLabel?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 15,
      }),
    );
    const publicMeta = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Public');
    expect(StyleSheet.flatten(publicMeta?.props.style)).toEqual(
      expect.objectContaining({
        color: '#4D5873',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    const membersMeta = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === '5/8');
    expect(StyleSheet.flatten(membersMeta?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    expect(
      tree.root.findAllByProps({testID: 'circle-detail-meta-divider'}),
    ).toHaveLength(6);
    expect(output).toContain('Daily pace');
    expect(output).toContain('Move for 30 minutes');
    expect(output.indexOf('Morning Movers')).toBeLessThan(
      output.indexOf('FITNESS'),
    );
    expect(output.indexOf('FITNESS')).toBeLessThan(
      output.indexOf('Move for 30 minutes'),
    );
    expect(output.indexOf('Move for 30 minutes')).toBeLessThan(
      output.indexOf('Daily pace'),
    );
    expect(output).not.toContain('Needs your Tap In');
    expect(output).toContain('Circle members');
    expect(output).toContain('5 members total');
    expect(output).toContain('Circle Feed');
    expect(output).toContain('1 of 4 members tapped in today');
    expect(output).not.toContain('Circle Progress');
    expect(output).toContain('Group progress');
    expect(output).toContain('Kelvin');
    expect(output).toContain('Ari');
    expect(output).toContain('Sky');
    expect(output).toContain('Moss');
    expect(output).toContain('Penny');
    expect(output).not.toContain('Review');
    expect(output).toContain('Tap In');
    expect(output).toContain('Log progress for this circle');
    expect(output.indexOf('Log progress for this circle')).toBeLessThan(
      output.indexOf('Group progress'),
    );
    expect(
      tree.root.findByProps({testID: 'circle-member-strip'}).props.horizontal,
    ).toBe(true);
    expect(
      tree.root.findAllByProps({testID: 'circle-member-strip-selected-action'}),
    ).toHaveLength(0);
    expect(output.indexOf('Group progress')).toBeLessThan(
      output.indexOf('1 of 4 members tapped in today'),
    );
    expect(output.indexOf('1 of 4 members tapped in today')).toBeLessThan(
      output.indexOf('3 days'),
    );
    expect(output.indexOf('1 of 4 members tapped in today')).toBeLessThan(
      output.indexOf('Circle members'),
    );
    expect(output).not.toContain('Last 7 days');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-week-history'}).props
          .style,
      ),
    ).toEqual(expect.objectContaining({paddingTop: 8}));
    expect(output).not.toContain('This week');
    expect(output).not.toContain('Completion');
    expect(output).toContain('Circle members');
    expect(output).not.toContain('Your last 7 days');
    expect(output).toContain('partial, 2 of 5 completed');
    expect(output).toContain('complete, 5 of 5 completed');
    expect(output).toContain('empty, 0 of 5 completed');
    expect(
      tree.root.findByProps({
        testID: 'circle-group-week-partial-2026-05-24',
      }),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-group-week-node-2026-05-25'})
          .props.style,
      ),
    ).toEqual(expect.objectContaining({backgroundColor: '#10B967'}));
    expect(output).not.toContain('M13 2L4 13.5h5.5L9 22l9-12h-6z');
    expect(output).not.toContain('M7 7 17 17M17 7 7 17');
    expect(
      tree.root
        .findAllByType(TapInPulseButton)
        .some(button => button.props.variant === 'hero'),
    ).toBe(true);
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
    expect(output).not.toContain('Invite Members');
    expect(
      StyleSheet.flatten(
        tree.root.findByProps({testID: 'circle-detail-body-stack'}).props.style,
      ),
    ).toEqual(expect.objectContaining({paddingTop: 20}));
    expect(output).toContain('Needs Tap In');
    expect(output).toContain('Tapped in');
  });

  it('derives the hero Tap In palette from every Circle category in both themes', () => {
    const categories = [
      {category: 'Deep Work', light: '#086CA8', dark: '#8FE2FF'},
      {category: 'Writing', light: '#086CA8', dark: '#8FE2FF'},
      {category: 'Fitness', light: '#07763E', dark: '#70E2A3'},
      {category: 'Sobriety', light: '#A83A00', dark: '#FFB36B'},
      {category: 'Wellness', light: '#5A1CFF', dark: '#B8A5FF'},
      {category: 'Custom', light: '#5A1CFF', dark: '#B8A5FF'},
      {category: 'General', light: '#4D5873', dark: '#B4BCD1'},
      {category: 'Unknown category', light: '#4D5873', dark: '#B4BCD1'},
    ] as const;

    for (const {category, dark, light} of categories) {
      mockMemberDetail = detail({category});
      mockAppearance = 'light';

      const lightButton = getHeroTapInButton(renderScreen().tree);

      expect(lightButton.props.heroPalette).toEqual({
        backgroundColor: light,
        chevronBackgroundColor: 'rgba(255,255,255,0.14)',
        foregroundColor: '#FFFFFF',
        supportingTextColor: 'rgba(255,255,255,0.78)',
      });

      mockAppearance = 'dark';

      const darkButton = getHeroTapInButton(renderScreen().tree);

      expect(darkButton.props.heroPalette).toEqual({
        backgroundColor: dark,
        chevronBackgroundColor: 'rgba(7,11,26,0.14)',
        foregroundColor: '#070B1A',
        supportingTextColor: 'rgba(7,11,26,0.72)',
      });
    }
  });

  it('embeds Circle Feed below the Member grid without navigation', () => {
    const {navigation, tree} = renderScreen();
    const output = outputOf(tree);
    const sectionProps = mockCircleThreadSection.mock.calls.at(-1)?.[0];

    expect(output.indexOf('Circle members')).toBeLessThan(
      output.indexOf('Circle Feed'),
    );
    expect(
      tree.root.findAllByProps({accessibilityLabel: 'Open Circle Feed'}),
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

  it('reveals the viewer Tap In action only after selecting their avatar', () => {
    const {navigation, tree} = renderScreen();

    expect(
      tree.root.findAllByProps({testID: 'circle-member-strip-selected-action'}),
    ).toHaveLength(0);

    selectMember(tree, 'user-1');

    const tapInAction = tree.root.findByProps({
      accessibilityLabel: 'Tap In for Kelvin',
    });
    expect(
      tree.root.findByProps({testID: 'circle-member-strip-selected-action'}),
    ).toBeTruthy();

    act(() => {
      tapInAction.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('TapInComposer', {
      circleId: 'circle-1',
      source: 'circle_detail',
    });
  });

  it('opens story sharing from the selected Circle Feed Tap In record', () => {
    const {navigation} = renderScreen();
    const sectionProps = mockCircleThreadSection.mock.calls.at(-1)?.[0];
    const item: CircleThreadItem = {
      activityType: 'tap_in',
      actor: {initials: 'KM', name: 'Kelvin', uid: 'user-1'},
      createdAtLabel: '8:40 AM',
      createdAtMs: Date.now(),
      id: 'tap-in-1',
      isLikedByViewer: false,
      kind: 'activity',
      likeCount: 0,
      mediaImageUrl: 'https://example.com/proof.jpg',
      note: 'Finished before work.',
      text: 'Kelvin tapped in',
      tone: 'success',
    };

    act(() => {
      sectionProps?.onShareTapIn?.(item);
    });

    expect(navigation.navigate).toHaveBeenCalledWith(
      'TapInStoryShare',
      expect.objectContaining({
        circleId: 'circle-1',
        circleTitle: 'Morning Movers',
        commitment: 'Move for 30 minutes',
        inviteUrl: 'https://hoyst.app/join/circle-1',
        memberCount: 5,
        note: 'Finished before work.',
        photoUri: 'https://example.com/proof.jpg',
        progressLabel: 'Today 60%',
        source: 'circle_detail',
        streakDays: 3,
        streakLabel: '3d streak',
      }),
    );
  });

  it('keeps the Home-style Nudge all row below members and above the feed', () => {
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
    const nudgeButton = tree.root
      .findAllByProps({testID: 'circle-nudge-all-action'})
      .find(node => node.props.style);

    expect(output).toContain('5 members total');
    expect(output).toContain('Remind everyone who still needs to Tap In');
    expect(output.indexOf('Ari')).toBeLessThan(output.indexOf('Nudge all'));
    expect(output.indexOf('Nudge all')).toBeLessThan(
      output.indexOf('Circle Feed'),
    );
    expect(StyleSheet.flatten(nudgeButton?.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 12,
        minHeight: 44,
      }),
    );
    expect(StyleSheet.flatten(nudgeButton?.parent?.props.style)).toEqual(
      expect.objectContaining({borderBottomWidth: StyleSheet.hairlineWidth}),
    );
    expect(
      tree.root.findByProps({testID: 'circle-nudge-all-action-chevron'}),
    ).toBeTruthy();
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

  it('shows the completed review action and remove action after today is counted', () => {
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

    expect(output).toContain('Review Tap In');
    expect(output).toContain("Review or share today's Tap In");
    expect(output).toContain('Remove Tap In');
    expect(output).not.toContain('Tapped in today');
    expect(output).not.toContain('View Today');
    expect(output).not.toContain('Circle Tools');
    expect(output.indexOf('Group progress')).toBeLessThan(
      output.indexOf('Remove Tap In'),
    );
    expect(output.indexOf('Remove Tap In')).toBeLessThan(
      output.indexOf('Circle Feed'),
    );
    const removeButton = tree.root
      .findAllByProps({testID: 'circle-remove-tap-in-action'})
      .find(node => node.props.style);
    const removeIconTile = tree.root.findByProps({
      testID: 'circle-remove-tap-in-icon-tile',
    });

    expect(StyleSheet.flatten(removeButton?.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        gap: 12,
        minHeight: 44,
      }),
    );
    expect(StyleSheet.flatten(removeButton?.parent?.props.style)).toEqual(
      expect.objectContaining({borderBottomWidth: StyleSheet.hairlineWidth}),
    );
    expect(StyleSheet.flatten(removeIconTile.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#D21F181A',
        height: 32,
        width: 32,
      }),
    );
    expect(
      tree.root.findByProps({testID: 'circle-remove-tap-in-action-chevron'}),
    ).toBeTruthy();
    expect(getHeroTapInButton(tree).props.heroTrailingState).toBe('success');
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
    expect(output).not.toContain('Review Tap In');
    expect(getHeroTapInButton(tree).props.heroTrailingState).toBeUndefined();

    const removeButton = tree.root
      .findAllByProps({testID: 'circle-remove-tap-in-action'})
      .find(node => node.props.style);

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

  it('uses success green for a completed current-day label in both themes', () => {
    const completedTodayDays = detail().groupProgressDays!.map(
      (day, index, days) =>
        index === days.length - 1
          ? {...day, coveredCount: day.totalCount, state: 'done' as const}
          : day,
    );

    for (const {accentForeground, appearance, successForeground} of [
      {
        appearance: 'light' as const,
        accentForeground: '#5A1CFF',
        successForeground: '#07763E',
      },
      {
        appearance: 'dark' as const,
        accentForeground: '#7A55FF',
        successForeground: '#4BE083',
      },
    ]) {
      mockAppearance = appearance;
      mockMemberDetail = detail({groupProgressDays: completedTodayDays});

      const {tree} = renderScreen();

      for (const label of ['Fri', '29', 'Today']) {
        const text = tree.root
          .findAllByType(Text)
          .find(node => textContent(node) === label);

        expect(StyleSheet.flatten(text?.props.style)).toEqual(
          expect.objectContaining({color: successForeground}),
        );
      }

      mockMemberDetail = detail();
      const {tree: incompleteTodayTree} = renderScreen();

      for (const label of ['Fri', '29', 'Today']) {
        const text = incompleteTodayTree.root
          .findAllByType(Text)
          .find(node => textContent(node) === label);

        expect(StyleSheet.flatten(text?.props.style)).toEqual(
          expect.objectContaining({color: accentForeground}),
        );
      }
    }
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
    expect(output).toContain('Circle members');
    expect(output).toContain('Invite Members');
    expect(output).toContain('0 of 0 members tapped in today');
    expect(output).not.toContain('Leaderboard');
    expect(output).not.toContain('Goals');
    expect(output).not.toContain('Review');
    expect(output).not.toContain('Edit Circle');
    expect(output).not.toContain('Delete Circle');
  });

  it('opens the pending request review sheet from the selected member row', () => {
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
    selectMember(tree, 'requester-1');
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

  it('approves a pending request from the selected member row', async () => {
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
    selectMember(tree, 'requester-1');
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

  it('denies a pending request from the selected member row', async () => {
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
    selectMember(tree, 'requester-1');
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

  it('shows the Nudge all row only when targets exist', async () => {
    let finishNudge!: () => void;
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
    mockNudgeCircleMembers.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishNudge = () => resolve({sentCount: 1});
        }),
    );

    const {tree} = renderScreen();
    const output = outputOf(tree);

    expect(output).toContain('Nudge all');
    const nudgeButton = tree.root
      .findAllByProps({testID: 'circle-nudge-all-action'})
      .find(node => node.props.style);

    expect(StyleSheet.flatten(nudgeButton?.props.style)).toEqual(
      expect.objectContaining({minHeight: 44}),
    );
    expect(output.indexOf('Group progress')).toBeLessThan(
      output.indexOf('Circle members'),
    );
    expect(output.indexOf('Circle members')).toBeLessThan(
      output.indexOf('Nudge all'),
    );
    expect(output).not.toContain('Send a Nudge');
    expect(output).not.toContain('Invite');

    act(() => {
      nudgeButton?.props.onPress();
    });
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Sending nudge to 1 member',
      }),
    ).toBeTruthy();
    expect(outputOf(tree)).toContain('Sending to 1 member...');
    expect(tree.root.findAllByType(ActivityIndicator)).not.toHaveLength(0);

    await act(async () => {
      finishNudge();
      await Promise.resolve();
    });

    expect(mockNudgeCircleMembers).toHaveBeenCalledWith('circle-1');
    expect(
      tree.root.findByProps({accessibilityLabel: 'Nudge sent to 1 member'}),
    ).toBeTruthy();
    expect(outputOf(tree)).toContain('Sent to 1 member');
  });

  it('targets a single member from the selected member action row', async () => {
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
    selectMember(tree, 'user-2');
    const nudgeButton = tree.root.findByProps({
      accessibilityLabel: 'Nudge Ari',
    });

    await act(async () => {
      await nudgeButton.props.onPress();
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
    expect(
      tree.root.findByProps({testID: 'circle-detail-pending-clock'}),
    ).toBeTruthy();
    expect(outputOf(tree)).not.toContain('Member Tools');
    expect(outputOf(tree)).not.toContain('Cancel Request');
    expect(outputOf(tree)).not.toContain('Circle Feed');
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
    expect(output).not.toContain('Circle Feed');
    expect(mockCircleThreadSection).not.toHaveBeenCalled();
  });

  it('renders member-first group progress and the compact streak header', () => {
    const {tree} = renderScreen();
    const output = outputOf(tree);
    const heading = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Group progress');
    const progressLabel = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === '1 of 4 members tapped in today');
    const streakCaption = tree.root
      .findAllByType(Text)
      .find(node => textContent(node) === 'Group streak');
    const streakValue = tree.root.findByProps({
      testID: 'circle-stats-streak-label',
    });
    const progressFillStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-stats-progress-fill'}).props.style,
    );
    const progressTrackStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'circle-stats-progress-track'}).props
        .style,
    );

    expect(output).toContain('Group progress');
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(StyleSheet.flatten(heading?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 23,
      }),
    );
    expect(StyleSheet.flatten(streakValue.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 22,
      }),
    );
    expect(StyleSheet.flatten(streakCaption?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 11,
        fontWeight: '400',
        lineHeight: 15,
      }),
    );
    expect(StyleSheet.flatten(progressLabel?.props.style)).toEqual(
      expect.objectContaining({
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    expect(progressTrackStyle).toEqual(
      expect.objectContaining({backgroundColor: '#E9E9ED', height: 5}),
    );
    expect(output).toContain('1 of 4 members tapped in today');
    expect(
      tree.root.findAllByProps({testID: 'circle-stats-progress-value'}),
    ).toHaveLength(0);
    expect(progressFillStyle).toEqual(
      expect.objectContaining({
        height: 5,
        width: '60%',
      }),
    );
    expect(output).toContain('3 days');
    expect(output).not.toContain('Completion');
    expect(output).toContain('Circle members');
    expect(output).not.toContain('This week');
  });

  it.each([
    [0, '0 days'],
    [1, '1 day'],
    [3, '3 days'],
  ] as const)(
    'formats a %i-day group streak as %s',
    (groupStreakDays, expectedLabel) => {
      mockMemberDetail = detail({groupStreakDays, streakDays: 9});
      mockPersistedGroupStreakDays = groupStreakDays;

      const {tree} = renderScreen();
      const streakLabel = tree.root
        .findAllByProps({testID: 'circle-stats-streak-label'})
        .find(node => textContent(node) === expectedLabel);

      expect(streakLabel).toBeTruthy();
      expect(
        tree.root.findByProps({testID: 'circle-stats-streak-pill'}).props
          .accessibilityLabel,
      ).toBe(`Group streak ${expectedLabel}`);
    },
  );

  it('uses the persisted group streak instead of the viewer streak data', () => {
    mockMemberDetail = detail({groupStreakDays: 12, streakDays: 9});
    mockPersistedGroupStreakDays = 2;

    const {tree} = renderScreen();

    expect(
      textContent(tree.root.findByProps({testID: 'circle-stats-streak-label'})),
    ).toBe('2 days');
    expect(
      tree.root.findByProps({testID: 'circle-stats-streak-pill'}).props
        .accessibilityLabel,
    ).toBe('Group streak 2 days');
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
    expect(output).toContain('FITNESS');
    expect(output).not.toContain('PERSONAL COMMITMENT');
    expect(output).toContain('Personal');
    expect(output).toContain('Personal progress');
    expect(output).toContain('Current streak');
    expect(output).not.toContain('Group streak');
    expect(
      textContent(
        tree.root.findByProps({testID: 'circle-stats-progress-value'}),
      ),
    ).toBe('60%');
    expect(output.indexOf('Personal progress')).toBeLessThan(
      output.indexOf('3 days'),
    );
    expect(output.lastIndexOf('Personal progress')).toBeLessThan(
      output.indexOf('3 days'),
    );
    expect(output).not.toContain('Last 7 days');
    expect(output).not.toContain('Circle members');
    expect(output).not.toContain('Circle Feed');
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
    expect(output).toContain('Circle Feed');
    expect(output).not.toContain('Log your progress for today');
    expect(output).not.toContain('Nudge');
    expect(output).not.toContain('Invite Members');
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
      tree.root.findAllByProps({accessibilityLabel: 'Invite Members'}),
    ).toHaveLength(0);

    act(() => {
      settingsButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('CircleTools', {
      circleId: 'circle-1',
    });
  });
});
