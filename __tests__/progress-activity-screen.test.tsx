import React from 'react';
import {Image, Pressable, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {DesignSystemProvider} from '../src/design/system';
import {ProgressActivityScreen} from '../src/features/progress/screens/ProgressActivityScreen';
let mockUid: string | undefined = 'owner';
let mockError = false;
const mockRefresh = jest.fn();
const mockMore = jest.fn();
const mockQuery = jest.fn();
const mockInfiniteQuery = jest.fn();
const entry = {
  id: 'one',
  circleId: 'circle',
  title: 'Read every day',
  category: 'Writing',
  status: 'completed',
  description: 'Completed · 20 pages',
  dateKey: '2026-09-29',
  cadence: 'weekly',
  periodKey: '2026-W40',
  note: 'A chapter before bed',
  photoUrl: 'https://example.com/photo.jpg',
  sortKey: '1',
};
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('../src/store/session-store', () => ({
  useSessionStore: (select: (state: unknown) => unknown) =>
    select({
      status: mockUid ? 'authenticatedReady' : 'guest',
      user: mockUid ? {uid: mockUid} : undefined,
    }),
}));
jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: (select: (state: unknown) => unknown) =>
    select({profile: {timezone: 'America/New_York'}}),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) =>
    select({appearance: 'light'}),
}));
jest.mock('../src/features/progress/services/history-service', () => ({
  getProgressDayActivity: jest.fn(),
}));
jest.mock('../src/navigation/auth-modal-navigation', () => ({
  navigateToAuthSignIn: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    mockQuery(options);
    return {
      data: entry,
      isPending: false,
      isError: mockError,
      refetch: mockRefresh,
    };
  },
  useInfiniteQuery: (options: unknown) => {
    mockInfiniteQuery(options);
    return {
      data: {pages: [{entries: [entry]}]},
      isPending: false,
      isError: mockError,
      isFetchNextPageError: mockError,
      hasNextPage: true,
      fetchNextPage: mockMore,
      refetch: mockRefresh,
    };
  },
}));
let screen: renderer.ReactTestRenderer;
const navigation = {goBack: jest.fn(), push: jest.fn()};
const mount = (section = 'dayActivity', ownerUid = 'owner') =>
  act(() => {
    screen = renderer.create(
      <DesignSystemProvider scheme="light">
        <ProgressActivityScreen
          navigation={navigation as never}
          route={
            {
              params: {
                section,
                dateKey: '2026-09-29',
                activityId: 'one',
                ownerUid,
              },
            } as never
          }
        />
      </DesignSystemProvider>,
    );
  });
const text = () =>
  screen.root
    .findAllByType(Text)
    .map(n => n.props.children)
    .flat(Infinity)
    .join(' ')
    .replace(/\s+/g, ' ');
const button = (label: string) =>
  screen.root
    .findAllByType(Pressable)
    .find(n => n.props.accessibilityLabel === label)!;
beforeEach(() => {
  mockUid = 'owner';
  mockError = false;
  jest.clearAllMocks();
});
afterEach(() => act(() => screen.unmount()));
it('opens separate read-only details and loads another day page', () => {
  mount();
  expect(mockInfiniteQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: [
        'progressHistory',
        'owner',
        'America/New_York',
        'fullDay',
        '2026-09-29',
      ],
      enabled: true,
    }),
  );
  act(() =>
    button(
      'Read every day. Completed · 20 pages. View activity details.',
    ).props.onPress(),
  );
  expect(navigation.push).toHaveBeenCalledWith('ProgressDetails', {
    section: 'activity',
    dateKey: '2026-09-29',
    activityId: 'one',
    ownerUid: 'owner',
  });
  act(() => button('Load more activity').props.onPress());
  expect(mockMore).toHaveBeenCalled();
});
it('renders saved notes and photos with no mutation controls and handles unavailable photos', () => {
  mount('activity');
  expect(text()).toContain('A chapter before bed');
  expect(text()).toContain('Weekly commitment');
  expect(screen.root.findByType(Image).props.source.uri).toBe(entry.photoUrl);
  act(() => screen.root.findByType(Image).props.onError());
  expect(text()).toContain('Photo is unavailable.');
  expect(
    screen.root.findAllByType(Pressable).map(n => n.props.accessibilityLabel),
  ).toEqual(['Back']);
});
it('blocks stale account routes and disables their reads after an account change', () => {
  mockUid = 'other';
  mount('activity');
  expect(text()).toContain('unavailable for the current account');
  expect(mockQuery).toHaveBeenCalledWith(
    expect.objectContaining({enabled: false}),
  );
  expect(mockInfiniteQuery).toHaveBeenCalledWith(
    expect.objectContaining({enabled: false}),
  );
  expect(mockRefresh).not.toHaveBeenCalled();
});
it('retains loaded entries when another page fails and offers retry', () => {
  mockError = true;
  mount();
  expect(text()).toContain('Read every day');
  act(() => button('Retry more activity').props.onPress());
  expect(mockMore).toHaveBeenCalled();
});
