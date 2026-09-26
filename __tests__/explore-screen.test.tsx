import React from 'react';
import {AccessibilityInfo, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {ExploreScreen} from '../src/features/explore/screens/ExploreScreen';
import {DSButton} from '../src/design/system';
import {ExploreSearchingHoy} from '../src/features/explore/components/ExploreSearchingHoy';
import {
  searchPublicCircles,
  type ExplorePage,
} from '../src/features/explore/services/explore-service';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const {View} = require('react-native');
  return {
    SafeAreaView: ({children, ...props}: {children?: React.ReactNode}) =>
      ReactModule.createElement(View, props, children),
    useSafeAreaInsets: () => ({bottom: 34, top: 0, left: 0, right: 0}),
  };
});
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: (state: {appearance: string}) => unknown) =>
    select({appearance: 'light'}),
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
  act(() => button('Create a circle').props.onClick());
  expect(navigate).toHaveBeenCalledWith('CreateCircle');
});

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
    screen.root.findByType(require('react-native').FlatList).props.onEndReached(),
  );
  expect(screen.root.findByType(ExploreSearchingHoy).props.searching).toBe(true);
  await act(async () => resolve(result));
  expect(screen.root.findByType(ExploreSearchingHoy).props.searching).toBe(false);
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
it('shows only the explicit public event and its absolute time', async () => {
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
  expect(output()).toContain('2026');
  expect(output()).not.toContain('ago');
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
