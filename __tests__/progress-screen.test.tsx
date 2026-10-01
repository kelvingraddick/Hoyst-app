import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ProgressScreen} from '../src/features/progress/screens/ProgressScreen';
import {DSButton, DSSurface, minimumTarget} from '../src/design/system';
import {FastForward, RotateCcw} from 'lucide-react-native';
import {brandColors} from '../src/design/tokens/colors';
import type {ProgressSummary} from '../src/features/progress/services/progress-service';

let mockHistoryState: 'ready' | 'empty' | 'loading' | 'error' = 'ready';
const mockHistoryRefresh = jest.fn();
let mockProfileError = false;
let mockMomentumError = false;
let mockAppearance: 'light' | 'dark' = 'light';
let mockDimensions = {width: 402, height: 874, scale: 3, fontScale: 1};
let mockInsets = {top: 62, bottom: 34, left: 0, right: 0};

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));

jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockProfileError
      ? undefined
      : {personalStreakDays: 2, longestStreakDays: 12, totalTapIns: 147},
    isError: mockProfileError,
  }),
}));
jest.mock('../src/features/progress/hooks/useProgressHistory', () => ({
  useProgressHistory: (
    _uid: unknown,
    _timezone: unknown,
    monthKey: string,
    dateKey: string,
  ) => {
    const {
      historyFixture,
    } = require('../src/features/progress/components/ProgressStatsSection');
    const fixture = historyFixture(monthKey, 'UTC');
    return {
      month: {
        data:
          mockHistoryState === 'error' || mockHistoryState === 'loading'
            ? undefined
            : mockHistoryState === 'empty'
            ? {...fixture.month, tapIns: 0, activeDays: 0}
            : fixture.month,
        isPending: mockHistoryState === 'loading',
        isError: mockHistoryState === 'error',
      },
      day: {
        data:
          mockHistoryState === 'error' || mockHistoryState === 'loading'
            ? undefined
            : {
                ...fixture.day,
                dateKey,
                entries:
                  mockHistoryState === 'empty' ? [] : fixture.day.entries,
              },
        isPending: mockHistoryState === 'loading',
        isError: mockHistoryState === 'error',
      },
      refresh: mockHistoryRefresh,
    };
  },
}));
jest.mock('../src/features/profile/services/profile-summary-service', () => ({
  getProfileSummary: jest.fn(),
}));
jest.mock('../src/features/momentum/services/momentum-service', () => ({
  subscribeToMomentumSummary: ({onError}: {onError: () => void}) => {
    if (mockMomentumError) {
      onError();
    }
    return jest.fn();
  },
  getMomentumDisplayModel: jest.fn(),
}));
jest.mock('../src/lib/firebase/auth', () => ({firebaseAuth: jest.fn()}));
jest.mock('../src/lib/firebase/app', () => ({getFirebaseApp: jest.fn()}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: jest.fn(),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) =>
    select({appearance: mockAppearance}),
}));
const mockStartWizard = jest.fn();
jest.mock('../src/store/onboarding-store', () => ({
  useOnboardingStore: {
    getState: () => ({startOnboardingWizard: mockStartWizard}),
  },
}));
const mockBeginAuth = jest.fn();
jest.mock('../src/store/session-store', () => ({
  useSessionStore: {
    getState: () => ({
      beginAuthFlow: mockBeginAuth,
      clearPendingAction: jest.fn(),
    }),
  },
}));
const initial: ProgressSummary = {
  totalXP: 120,
  level: 2,
  levelXP: 50,
  requiredXP: 70,
  remainingXP: 20,
  inventory: {skips: 3, restores: 1},
  tasks: {
    profile: true,
    commitment: true,
    first_tap_in: true,
    second_day: true,
  },
  milestones: {},
  routineRemainingXP: 30,
  flags: {earning: true, inventory: true, restoring: true, buying: true},
};
let mockProgress: {
  summary?: ProgressSummary;
  uid?: string;
  loading: boolean;
  error?: string;
  refresh: jest.Mock;
};
jest.mock('../src/features/progress/hooks/useProgress', () => ({
  useProgress: () => mockProgress,
}));
let screen: renderer.ReactTestRenderer;
let navigate: jest.Mock;
const mount = () =>
  act(() => {
    navigate = jest.fn();
    screen = renderer.create(
      <ProgressScreen
        navigation={{getParent: () => ({navigate}), navigate} as never}
        route={{} as never}
      />,
    );
  });
const text = () =>
  screen.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => ['string', 'number'].includes(typeof value))
    .join(' ');
const button = (label: string) =>
  screen.root
    .findAllByType(Pressable)
    .find(node => node.props.accessibilityLabel === label)!;
beforeEach(() => {
  mockProfileError = false;
  mockMomentumError = false;
  mockAppearance = 'light';
  mockDimensions = {width: 402, height: 874, scale: 3, fontScale: 1};
  mockInsets = {top: 62, bottom: 34, left: 0, right: 0};
  mockProgress = {
    summary: initial,
    uid: 'one',
    loading: false,
    refresh: jest.fn(),
  };
  mockBeginAuth.mockReset();
  mockStartWizard.mockReset();
});
afterEach(() => act(() => screen?.unmount()));
afterEach(() => jest.restoreAllMocks());
it('separates reward usage from purchase targets', () => {
  mount();
  act(() =>
    screen.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === '3 Skips. Use reward.')!
      .props.onPress(),
  );
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'skips',
    packType: undefined,
  });
  act(() => button('Buy skips').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'packs',
    packType: 'skips',
  });
  act(() => button('Buy restores').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'packs',
    packType: 'restores',
  });
});
it('expands checklist and takes the next task directly to Explore', () => {
  mount();
  expect(text()).toContain('Earn more XP');
  expect(text()).toContain('Join a Circle');
  act(() => button('Explore circles').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('Explore');
  act(() =>
    screen.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityState?.expanded === false)!
      .props.onPress(),
  );
  expect(text()).toContain('Choose your reminders · +10 XP');
});
it('describes earned and upcoming restore rewards and opens level details', () => {
  mockProgress.summary = {
    ...initial,
    level: 3,
    totalXP: 140,
    levelXP: 0,
    remainingXP: 70,
  };
  mount();
  const levels = screen.root.findAllByType(Pressable);
  const earned = levels.find(
    node =>
      node.props.accessibilityLabel === 'Level 3. Earned. View level details.',
  );
  expect(earned).toBeDefined();
  expect(
    levels.some(
      node =>
        node.props.accessibilityLabel ===
        'Level 4. 70 XP away. 1 skip and 1 restore. View level details.',
    ),
  ).toBe(true);
  act(() => earned!.props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'xp',
    packType: undefined,
  });
});
it('starts at Level 1 without claiming an earned level-up', () => {
  mockProgress.summary = {
    ...initial,
    level: 1,
    totalXP: 0,
    levelXP: 0,
    remainingXP: 70,
  };
  mount();
  expect(
    screen.root
      .findAllByType(Pressable)
      .some(
        node =>
          node.props.accessibilityLabel ===
          'Level 1. Your journey starts here. View level details.',
      ),
  ).toBe(true);
});
it('keeps routine earning and milestone destinations after checklist completion', () => {
  mockProgress.summary = {
    ...initial,
    tasks: {
      profile: true,
      commitment: true,
      first_tap_in: true,
      second_day: true,
      circle: true,
      share_invite: true,
      reminders: true,
    },
  };
  mount();
  expect(text()).toContain('30 routine XP available today');
  act(() => button('Tap In').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('TapInPicker');
  act(() => screen.unmount());
  mockProgress.summary = {...mockProgress.summary!, routineRemainingXP: 0};
  mount();
  expect(text()).toContain('Reach a 3-day personal streak');
  act(() => button('View milestones').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'xp',
    packType: undefined,
  });
});
it('retains streak and momentum detail destinations', () => {
  mount();
  const streak = screen.root
    .findAllByType(Pressable)
    .find(
      node =>
        node.props.accessibilityLabel ===
        '2 days. Current streak. View details.',
    )!;
  act(() => streak.props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'streak',
    packType: undefined,
  });
  const momentum = screen.root
    .findAllByType(Pressable)
    .find(node =>
      node.props.accessibilityLabel?.endsWith('14-day momentum. View details.'),
    )!;
  act(() => momentum.props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'momentum',
    packType: undefined,
  });
});
it('labels unavailable stats instead of substituting zero', () => {
  mockProfileError = true;
  mockMomentumError = true;
  mount();
  const labels = screen.root
    .findAllByType(Pressable)
    .map(node => node.props.accessibilityLabel);
  expect(labels).toContain('Unavailable. Current streak. View details.');
  expect(labels).toContain('Unavailable. 14-day momentum. View details.');
});
it('explains when the cap and all milestone bonuses are exhausted', () => {
  mockProgress.summary = {
    ...initial,
    tasks: {
      profile: true,
      commitment: true,
      first_tap_in: true,
      second_day: true,
      circle: true,
      share_invite: true,
      reminders: true,
    },
    routineRemainingXP: 0,
    milestones: {
      streak_3: true,
      streak_7: true,
      momentum_strong: true,
      streak_14: true,
      momentum_peak: true,
      streak_30: true,
      tap_ins_50: true,
    },
  };
  mount();
  expect(text()).toContain('No further XP available today');
  expect(button('Tap In')).toBeUndefined();
});
it('keeps zero balance actions available and never renders a previous balance', () => {
  mockProgress.summary = {...initial, inventory: {skips: 0, restores: 0}};
  mount();
  expect(
    screen.root
      .findAllByType(Pressable)
      .some(node => node.props.accessibilityLabel === '0 Skips. Use reward.'),
  ).toBe(true);
  expect(button('Buy skips')).toBeDefined();
});
it('shows loading and retry states without invented balances', () => {
  mockProgress.summary = undefined;
  mockProgress.loading = true;
  mount();
  expect(text()).toContain('Loading your progress');
  expect(screen.root.findAllByType(DSButton)).toHaveLength(0);
  act(() => screen.unmount());
  mockProgress.loading = false;
  mockProgress.error = 'Offline';
  mount();
  expect(text()).toContain('Offline');
  act(() => button('Try again').props.onPress());
  expect(mockProgress.refresh).toHaveBeenCalledTimes(1);
});
it('gives guests a real authentication destination', () => {
  mockProgress.uid = undefined;
  mockProgress.summary = undefined;
  mount();
  expect(text()).toContain('Get started');
  expect(text()).toContain('Create a Circle. Invite your people.');
  act(() =>
    screen.root
      .findAllByType(Pressable)
      .find(
        node => node.props.accessibilityLabel === 'Already a member? Log in',
      )!
      .props.onPress(),
  );
  expect(mockBeginAuth).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('Auth', {
    screen: 'SignIn',
  });
});

it('starts the same onboarding flow as the Home guest action', () => {
  mockProgress.uid = undefined;
  mockProgress.summary = undefined;
  mount();
  act(() =>
    screen.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Start your commitment')!
      .props.onPress(),
  );
  expect(mockStartWizard).toHaveBeenCalledTimes(1);
  expect(mockBeginAuth).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('Auth', {screen: 'Welcome'});
});

it('puts safe-area spacing in scrolling content without a static top strip', () => {
  mount();
  const scroll = screen.root.findByType(ScrollView);
  expect(StyleSheet.flatten(scroll.props.style)).toEqual({
    flex: 1,
    marginBottom: 34,
  });
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
  expect(scroll.props.automaticallyAdjustContentInsets).toBe(false);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
    paddingTop: 78,
    paddingBottom: 134,
    paddingLeft: 22,
    paddingRight: 22,
  });
  for (const section of ['xp', 'history']) {
    act(() =>
      screen.root
        .findByProps({testID: `progress-option-${section}`})
        .props.onPress(),
    );
    expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
      section,
      packType: undefined,
    });
  }
});

it('uses current device insets once for initial content and scroll indicators', () => {
  mockInsets = {top: 24, bottom: 16, left: 44, right: 44};
  mount();
  const scroll = screen.root.findByType(ScrollView);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
    paddingTop: 40,
    paddingBottom: 134,
    paddingLeft: 66,
    paddingRight: 66,
  });
  expect(StyleSheet.flatten(scroll.props.style).marginBottom).toBe(16);
  expect(scroll.props.scrollIndicatorInsets).toEqual({top: 24, bottom: 0});
  expect(scroll.props.automaticallyAdjustsScrollIndicatorInsets).toBe(false);
});

it('shows the starting marker in green without claiming an earned level-up', () => {
  mockProgress.summary = {
    ...initial,
    level: 1,
    totalXP: 0,
    levelXP: 0,
    remainingXP: 70,
  };
  mount();
  const level = screen.root
    .findAllByType(Pressable)
    .find(
      node =>
        node.props.accessibilityLabel ===
        'Level 1. Your journey starts here. View level details.',
    )!;
  expect(
    level
      .findAllByType(View)
      .some(
        node =>
          StyleSheet.flatten(node.props.style)?.backgroundColor ===
          brandColors.green,
      ),
  ).toBe(true);
  expect(text()).not.toContain('Earned');
});

it('uses an arrow-only earning action with a descriptive accessible destination', () => {
  mount();
  const action = button('Explore circles');
  expect(action).toBeDefined();
  expect(action.findAllByType(Text)).toHaveLength(0);
  expect(StyleSheet.flatten(action.props.style)).toMatchObject({
    width: minimumTarget(),
    height: minimumTarget(),
  });
  act(() => action.props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('Explore');
});

it('keeps the checklist footer visually slim with an expanded touch area', () => {
  mount();
  const footer = screen.root
    .findAllByType(Pressable)
    .find(node => node.props.accessibilityState?.expanded === false)!;
  expect(StyleSheet.flatten(footer.props.style).minHeight).toBe(32);
  expect(32 + footer.props.hitSlop.top + footer.props.hitSlop.bottom).toBe(
    minimumTarget(),
  );
  act(() => footer.props.onPress());
  expect(text()).toContain('Choose your reminders · +10 XP');
});

it.each(['light', 'dark'] as const)(
  'uses matching reward icons, bright buy fills and white labels in %s mode',
  appearance => {
    mockAppearance = appearance;
    mount();
    for (const [label, color] of [
      ['Buy skips', brandColors.green],
      ['Buy restores', brandColors.orangeStrong],
    ]) {
      const purchase = button(label);
      expect(
        purchase
          .findAllByType(View)
          .some(
            node =>
              StyleSheet.flatten(node.props.style)?.backgroundColor === color,
          ),
      ).toBe(true);
      expect(
        purchase
          .findAllByType(Text)
          .some(
            node =>
              StyleSheet.flatten(node.props.style)?.color === brandColors.white,
          ),
      ).toBe(true);
      act(() => purchase.props.onPressIn());
      expect(StyleSheet.flatten(purchase.props.style).opacity).toBe(0.7);
      act(() => purchase.props.onPressOut());
      expect(StyleSheet.flatten(purchase.props.style).opacity).toBeUndefined();
    }
    expect(
      screen.root
        .findAllByType(FastForward)
        .every(node => node.props.color === brandColors.green),
    ).toBe(true);
    const restore = screen.root
      .findAllByType(Pressable)
      .find(
        node =>
          node.props.accessibilityLabel === '1 Streak restore. Use reward.',
      )!;
    expect(restore.findByType(RotateCcw).props.color).toBe(
      brandColors.orangeStrong,
    );
  },
);

it.each(['light', 'dark'] as const)(
  'keeps the current level number white in %s mode',
  appearance => {
    mockAppearance = appearance;
    mount();
    const level = screen.root
      .findAllByType(Pressable)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'Level 2. Earned. View level details.',
      )!;
    expect(
      level
        .findAllByType(Text)
        .some(
          node =>
            node.props.children === 2 &&
            StyleSheet.flatten(node.props.style).color === brandColors.white,
        ),
    ).toBe(true);
  },
);

it.each([316, 358, 760])(
  'bounds both reward cards within a measured %s-point row',
  rowWidth => {
    mockDimensions = {
      width: rowWidth + 44,
      height: 874,
      scale: 3,
      fontScale: 1,
    };
    mockProgress.summary = {
      ...initial,
      inventory: {skips: 1234, restores: 1234},
    };
    mount();
    act(() =>
      screen.root
        .findByProps({testID: 'progress-reward-grid'})
        .props.onLayout({nativeEvent: {layout: {width: rowWidth}}}),
    );
    const cards = screen.root
      .findAllByType(DSSurface)
      .filter(node => node.props.testID?.startsWith('progress-reward-'));
    expect(cards).toHaveLength(2);
    const widths = cards.map(
      node => StyleSheet.flatten(node.props.style).width,
    );
    expect(widths).toEqual([(rowWidth - 12) / 2, (rowWidth - 12) / 2]);
    expect(widths[0] + widths[1] + 12).toBe(rowWidth);
    for (const card of cards) {
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({
        minWidth: 0,
        flexShrink: 1,
      });
    }
    expect(StyleSheet.flatten(button('Buy skips').props.style).width).toBe(
      '100%',
    );
    expect(StyleSheet.flatten(button('Buy restores').props.style).width).toBe(
      '100%',
    );
  },
);

it.each([
  {width: 359, fontScale: 1},
  {width: 402, fontScale: 1.5},
])(
  'stacks bounded reward cards at $width points with $fontScale text scaling',
  dimensions => {
    mockDimensions = {height: 874, scale: 3, ...dimensions};
    mount();
    act(() =>
      screen.root.findByProps({testID: 'progress-reward-grid'}).props.onLayout({
        nativeEvent: {layout: {width: dimensions.width - 44}},
      }),
    );
    const cards = screen.root
      .findAllByType(DSSurface)
      .filter(node => node.props.testID?.startsWith('progress-reward-'));
    expect(cards).toHaveLength(2);
    expect(
      cards.every(
        node => StyleSheet.flatten(node.props.style).width === '100%',
      ),
    ).toBe(true);
    expect(
      StyleSheet.flatten(
        screen.root.findByProps({testID: 'progress-reward-grid'}).props.style,
      ).flexDirection,
    ).not.toBe('row');
  },
);

it('places selected day directly after the calendar, ahead of monthly and lifetime totals', () => {
  mount();
  const section = screen.root.findByProps({testID: 'progress-your-stats'});
  const children = section
    .findAll(
      node =>
        typeof node.type === 'string' &&
        [
          'progress-calendar',
          'progress-selected-day',
          'progress-month-totals',
          'progress-personal-bests',
        ].includes(node.props.testID),
    )
    .map(node => node.props.testID);
  expect(children).toEqual([
    'progress-calendar',
    'progress-selected-day',
    'progress-month-totals',
    'progress-personal-bests',
  ]);
  expect(text()).toContain('Your stats');
});
it('opens selected-day activity, read-only details, and achievements independently', () => {
  mount();
  const dateKey = require('luxon').DateTime.now().setZone('UTC').toISODate();
  act(() => button(`View all activity for ${dateKey}`).props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'dayActivity',
    dateKey,
  });
  act(() =>
    button(
      'Read every day. Completed · 20 pages. View activity details.',
    ).props.onPress(),
  );
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'activity',
    dateKey,
    activityId: 'preview-read',
    ownerUid: 'one',
  });
  act(() => button('View achievements').props.onPress());
  expect(navigate).toHaveBeenLastCalledWith('ProgressDetails', {
    section: 'achievements',
    packType: undefined,
  });
});
it('browses earlier months and selects their last day while disabling future months', () => {
  mount();
  expect(button('Next month').props.disabled).toBe(true);
  act(() => button('Previous month').props.onPress());
  const last = require('luxon')
    .DateTime.now()
    .setZone('UTC')
    .minus({months: 1})
    .endOf('month')
    .toISODate();
  expect(button(`View all activity for ${last}`)).toBeTruthy();
  expect(button('Next month').props.disabled).toBe(false);
});
it('keeps green successes inside blue today/selection rings and removes connectors at enlarged text', () => {
  mount();
  expect(
    screen.root.findAllByProps({testID: 'progress-calendar-connector'}).length,
  ).toBeGreaterThan(0);
  act(() => screen.unmount());
  mockDimensions.fontScale = 1.5;
  mount();
  expect(
    screen.root.findAllByProps({testID: 'progress-calendar-connector'}),
  ).toHaveLength(0);
});

it('renders empty history and retry states without displaying false totals', () => {
  mockHistoryState = 'empty';
  mount();
  expect(text()).toContain('No recorded activity on this day.');
  expect(text()).toContain('No successful Tap Ins recorded this month yet.');
  act(() => screen.unmount());
  mockHistoryState = 'error';
  mount();
  expect(text()).toContain('Tap In history is unavailable.');
  act(() => button('Retry history').props.onPress());
  expect(mockHistoryRefresh).toHaveBeenCalled();
  act(() => button('Retry day').props.onPress());
  expect(mockHistoryRefresh).toHaveBeenCalledTimes(2);
  mockHistoryState = 'ready';
});
it('aligns leap-month weekdays and includes all month days', () => {
  const {
    calendarWeeks,
  } = require('../src/features/progress/components/ProgressCalendar');
  const february = calendarWeeks('2024-02');
  expect(february[0].slice(0, 4)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  expect(february.flat().filter(Boolean)).toHaveLength(29);
  expect(february.at(-1)[4]).toBe('2024-02-29');
  expect(calendarWeeks('2026-02').flat().filter(Boolean)).toHaveLength(28);
  expect(calendarWeeks('2026-08').flat().filter(Boolean)).toHaveLength(31);
});

it.each([316, 358, 760])(
  'keeps calendar connector geometry outside all markers at width %i',
  width => {
    const {
      calendarWeeks,
      calendarConnectorSegments,
    } = require('../src/features/progress/components/ProgressCalendar');
    const offsets = [0, 3, 0, 5, 2, 0, 3];
    for (const week of calendarWeeks('2026-10')) {
      const centers = week.flatMap((day: string | undefined, i: number) =>
        day ? [{x: (width / 7) * (i + 0.5), y: 17 + offsets[i]}] : [],
      );
      const paths = calendarConnectorSegments(week, width);
      for (const path of paths) {
        const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
        const points = Array.from({length: numbers.length / 2}, (_, i) => ({
          x: numbers[i * 2],
          y: numbers[i * 2 + 1],
        }));
        for (const point of points) {
          for (const center of centers) {
            expect(Math.abs(point.x - center.x)).toBeGreaterThanOrEqual(
              19 - 0.000001,
            );
          }
        }
        // Endpoint tangents follow each marker's actual vertical center.
        for (const endpoint of [points[0], points[points.length - 1]]) {
          const nearest = centers.reduce(
            (a: typeof endpoint, b: typeof endpoint) =>
              Math.abs(a.x - endpoint.x) < Math.abs(b.x - endpoint.x) ? a : b,
          );
          expect(endpoint.y).toBe(nearest.y);
        }
        expect(points[0].x).toBeLessThan(points[points.length - 1].x);
      }
      expect(paths).toHaveLength(
        centers.length - 1 + (week[0] ? 1 : 0) + (week[6] ? 1 : 0),
      );
    }
  },
);

it('omits connectors when columns have insufficient clearance', () => {
  const {
    calendarWeeks,
    calendarConnectorSegments,
  } = require('../src/features/progress/components/ProgressCalendar');
  expect(calendarConnectorSegments(calendarWeeks('2026-10')[1], 250)).toEqual(
    [],
  );
});

it('advances the default selected day at midnight and refreshes history', () => {
  let tick = () => {};
  const clock = jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2026-09-30T23:59:30Z'));
  const interval = jest
    .spyOn(global, 'setInterval')
    .mockImplementation(callback => {
      tick = callback as () => void;
      return 999 as never;
    });
  mockHistoryRefresh.mockClear();
  mount();
  expect(button('View all activity for 2026-09-30')).toBeTruthy();
  clock.mockReturnValue(Date.parse('2026-10-01T00:00:30Z'));
  act(() => tick());
  expect(button('View all activity for 2026-10-01')).toBeTruthy();
  expect(text()).toContain('October 2026');
  expect(mockHistoryRefresh).toHaveBeenCalled();
  clock.mockRestore();
  interval.mockRestore();
});
