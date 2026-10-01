import React from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ExploreScreen} from '../src/features/explore/screens/ExploreScreen';
import {DSButton} from '../src/design/system';
import {ExploreSearchingHoy} from '../src/features/explore/components/ExploreSearchingHoy';
import {
  searchPublicCircles,
  formatPublicTapInTime,
  type ExplorePage,
} from '../src/features/explore/services/explore-service';

let mockFocused = true;
let mockAppearance = 'light';
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      ReactModule.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 34, top: 59, left: 0, right: 0}),
  };
});
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: (state: {appearance: string}) => unknown) =>
    select({appearance: mockAppearance}),
}));
jest.mock('../src/features/explore/services/explore-service', () => ({
  ...jest.requireActual('../src/features/explore/services/explore-service'),
  searchPublicCircles: jest.fn(),
}));
jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(),
}));
const search = jest.mocked(searchPublicCircles);
const result: ExplorePage = {
  categories: ['Fitness', 'Deep Work'],
  total: 1,
  circles: [
    {
      id: 'one',
      title: 'Builders',
      category: 'Deep Work',
      commitment: 'A focused hour every morning',
      memberCount: 4,
      maxSize: 8,
      groupStreakDays: 3,
      joinMode: 'open',
    },
  ],
};
let screen: renderer.ReactTestRenderer;
let navigate: jest.Mock;
async function mount() {
  navigate = jest.fn();
  await act(async () => {
    screen = renderer.create(
      <ExploreScreen
        navigation={{getParent: () => ({navigate})} as never}
        route={{} as never}
      />,
    );
  });
  await tick(0);
}
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
const output = () =>
  screen.root
    .findAllByType(require('react-native').Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ');
function button(label: string) {
  return screen.root.findAll(
    node =>
      String(node.type) === 'View' &&
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label,
  )[0];
}
beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  mockAppearance = 'light';
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  search.mockReset().mockResolvedValue(result);
});
afterEach(() => {
  act(() => screen?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('renders all public results with real facts and details navigation', async () => {
  await mount();
  expect(
    screen.root.findByProps({testID: 'explore-subtitle'}).props
      .accessibilityLabel,
  ).toBe('Find circles moving at your pace.');
  expect(output()).toContain('Builders');
  expect(output()).toContain('3-day group streak');
  expect(output()).not.toContain('2 min ago');
  expect(output()).not.toContain('FOR YOU');
  act(() => screen.root.findByType(DSButton).props.onPress());
  expect(navigate).toHaveBeenCalledWith('CircleDetail', {circleId: 'one'});
  expect(button('Create a circle')).toBeUndefined();
});

it('shows a coming soon alert from the icon-only Friends button', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await mount();
  expect(output()).not.toContain('Friends');
  act(() => button('Friends').props.onClick());
  expect(alert).toHaveBeenCalledWith('Friends', 'Coming soon', [{text: 'OK'}]);
  expect(navigate).not.toHaveBeenCalled();
});

it.each([
  ['light', '#18B9FF80'],
  ['dark', '#18B9FF38'],
])(
  'keeps the %s tint behind the full scroll viewport with one top inset',
  async (appearance, color) => {
    mockAppearance = appearance;
    await mount();
    const tint = screen.root.findByProps({testID: 'explore-top-tint'});
    expect(tint.props.colors).toEqual([color, '#18B9FF00']);
    expect(tint.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(tint.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      height: 240,
    });
    const list = screen.root.findByType(FlatList);
    expect(
      StyleSheet.flatten(list.props.contentContainerStyle).paddingTop,
    ).toBe(75);
    expect(list.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(list.props.automaticallyAdjustContentInsets).toBe(false);
    expect(list.props.scrollIndicatorInsets.top).toBe(59);
    expect(list.props.progressViewOffset).toBe(59);
    const safeArea = screen.root.findByType(
      require('react-native-safe-area-context').SafeAreaView,
    );
    expect(safeArea.props.edges).toEqual(['left', 'right']);
  },
);

it('moves Hoy only for active requests and stops for errors and navigation away', async () => {
  await mount();
  const searching = () =>
    screen.root.findByType(ExploreSearchingHoy).props.searching;
  let reject!: (error: Error) => void;
  search.mockImplementationOnce(
    () => new Promise((_resolve, rejectRequest) => (reject = rejectRequest)),
  );
  act(() => screen.root.findByType(TextInput).props.onChangeText('slow'));
  await tick(299);
  expect(searching()).toBe(false);
  await tick(1);
  expect(searching()).toBe(true);
  await act(async () => reject(new Error('offline')));
  expect(searching()).toBe(false);
  search.mockImplementationOnce(() => new Promise(() => {}));
  act(() => screen.root.findByType(DSButton).props.onPress());
  await tick(300);
  expect(searching()).toBe(true);
  mockFocused = false;
  act(() =>
    screen.update(
      <ExploreScreen
        navigation={{getParent: () => ({navigate})} as never}
        route={{} as never}
      />,
    ),
  );
  expect(searching()).toBe(false);
});

it('moves Hoy during pagination and stops when the page arrives', async () => {
  search.mockResolvedValueOnce({...result, nextCursor: 'two'});
  await mount();
  let resolve!: (page: ExplorePage) => void;
  search.mockImplementationOnce(
    () => new Promise(resolveRequest => (resolve = resolveRequest)),
  );
  act(() =>
    screen.root
      .findByType(require('react-native').FlatList)
      .props.onEndReached(),
  );
  expect(screen.root.findByType(ExploreSearchingHoy).props.searching).toBe(
    true,
  );
  await act(async () => resolve(result));
  expect(screen.root.findByType(ExploreSearchingHoy).props.searching).toBe(
    false,
  );
});
it('debounces search and passes category selection to the full-index service', async () => {
  await mount();
  act(() => screen.root.findByType(TextInput).props.onChangeText('focus'));
  await tick(299);
  expect(search).toHaveBeenCalledTimes(1);
  await tick(1);
  expect(search).toHaveBeenLastCalledWith({query: 'focus', category: 'All'});
  act(() => button('Fitness circles').props.onClick());
  await tick(300);
  expect(search).toHaveBeenLastCalledWith({
    query: 'focus',
    category: 'Fitness',
  });
});
it('discards old requests when search changes', async () => {
  let resolveOld!: (page: ExplorePage) => void;
  search.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      }),
  );
  await mount();
  act(() => screen.root.findByType(TextInput).props.onChangeText('new'));
  await tick(300);
  await act(async () =>
    resolveOld({
      ...result,
      circles: [{...result.circles[0], title: 'Stale result'}],
    }),
  );
  expect(output()).not.toContain('Stale result');
  expect(output()).toContain('Builders');
});
it('shows truthful empty and error states without sample circles', async () => {
  search.mockResolvedValueOnce({...result, total: 0, circles: []});
  await mount();
  expect(output()).toContain('No public circles yet');
  expect(output()).not.toContain('Builders');
  search.mockRejectedValueOnce(new Error('offline'));
  act(() => screen.root.findByType(TextInput).props.onChangeText('abc'));
  await tick(300);
  expect(output()).toContain("Couldn't load circles");
  expect(output()).not.toContain('Builders');
  expect(screen.root.findByType(DSButton).props.label).toBe('Try again');
});
it('shows only the explicit public event with relative time in text and accessibility', async () => {
  jest.setSystemTime(new Date('2026-09-26T14:00:00Z'));
  search.mockResolvedValueOnce({
    ...result,
    circles: [
      {
        ...result.circles[0],
        latestPublicTapIn: {
          eventId: 'new',
          uid: 'ava',
          displayName: 'Ava',
          occurredAt: '2026-09-26T12:00:00Z',
        },
      },
    ],
  });
  await mount();
  expect(output()).toContain('Ava');
  expect(output()).toContain('tapped in');
  expect(output()).toContain('2 hours ago');
  expect(output()).not.toContain('2026');
  expect(
    screen.root.findAllByProps({
      accessibilityLabel: 'Ava tapped in, 2 hours ago',
    }).length,
  ).toBeGreaterThan(0);
});

it('formats actual elapsed time with singular/plural units and safe timestamp fallbacks', () => {
  const now = Date.parse('2026-09-29T22:00:00Z');
  const examples: [number, string][] = [
    [0, 'Just now'],
    [59, 'Just now'],
    [60, '1 minute ago'],
    [120, '2 minutes ago'],
    [3600, '1 hour ago'],
    [86400, '1 day ago'],
    [2 * 86400, '2 days ago'],
    [7 * 86400, '1 week ago'],
    [30 * 86400, '1 month ago'],
    [365 * 86400, '1 year ago'],
  ];
  for (const [seconds, expected] of examples) {
    expect(
      formatPublicTapInTime(new Date(now - seconds * 1000).toISOString(), now),
    ).toBe(expected);
  }
  expect(formatPublicTapInTime('invalid', now)).toBe('');
  expect(formatPublicTapInTime(new Date(now + 60_000).toISOString(), now)).toBe(
    'Just now',
  );
});
it('appends another page and retains existing cards when loading more fails', async () => {
  search.mockResolvedValueOnce({...result, total: 22, nextCursor: 'page-two'});
  await mount();
  search.mockRejectedValueOnce(new Error('offline'));
  const list = screen.root.findByType(require('react-native').FlatList);
  await act(async () => list.props.onEndReached());
  expect(output()).toContain('Builders');
  expect(output()).toContain("Couldn't load more circles.");
  search.mockResolvedValueOnce({
    ...result,
    circles: [{...result.circles[0], id: 'two', title: 'Next group'}],
  });
  await act(async () =>
    screen.root
      .findAllByType(DSButton)
      .find(node => node.props.label === 'Retry loading more')!
      .props.onPress(),
  );
  expect(search).toHaveBeenLastCalledWith({
    query: '',
    category: 'All',
    cursor: 'page-two',
  });
  expect(output()).toContain('Next group');
  expect(output()).toContain('Builders');
});
