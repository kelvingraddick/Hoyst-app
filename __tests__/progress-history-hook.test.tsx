import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useProgressHistory} from '../src/features/progress/hooks/useProgressHistory';
import {
  getProgressMonth,
  getProgressDayActivity,
  subscribeHistoryChanges,
} from '../src/features/progress/services/history-service';
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('../src/features/progress/services/history-service', () => ({
  getProgressMonth: jest.fn(async (monthKey: string) => ({
    monthKey,
    timezone: 'UTC',
    days: [],
    tapIns: 0,
    activeDays: 0,
  })),
  getProgressDayActivity: jest.fn(async (dateKey: string) => ({
    dateKey,
    timezone: 'UTC',
    entries: [],
    nextCursor: null,
  })),
  subscribeHistoryChanges: jest.fn(() => jest.fn()),
}));
const client = new QueryClient({
  defaultOptions: {queries: {retry: false, gcTime: Infinity}},
});
function Probe({
  uid,
  zone = 'UTC',
  preview = false,
}: {
  uid?: string;
  zone?: string;
  preview?: boolean;
}) {
  useProgressHistory(uid, zone, '2026-09', '2026-09-29', preview);
  return null;
}
const element = (uid?: string, zone = 'UTC', preview = false) => (
  <QueryClientProvider client={client}>
    <Probe uid={uid} zone={zone} preview={preview} />
  </QueryClientProvider>
);
let screen: renderer.ReactTestRenderer;
beforeEach(() => {
  client.clear();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => screen.unmount());
  client.clear();
});
it('keys history by account and timezone and clears the prior owner on account changes', async () => {
  await act(async () => {
    screen = renderer.create(element('first'));
  });
  expect(getProgressMonth).toHaveBeenCalledWith('2026-09');
  expect(getProgressDayActivity).toHaveBeenCalledWith('2026-09-29');
  expect(
    client
      .getQueryCache()
      .findAll({queryKey: ['progressHistory', 'first', 'UTC']}),
  ).toHaveLength(2);
  await act(async () => {
    screen.update(element('second', 'America/New_York'));
  });
  expect(
    client.getQueryCache().findAll({queryKey: ['progressHistory', 'first']}),
  ).toHaveLength(0);
  expect(
    client
      .getQueryCache()
      .findAll({queryKey: ['progressHistory', 'second', 'America/New_York']}),
  ).toHaveLength(2);
  const unsubscribe = (subscribeHistoryChanges as jest.Mock).mock.results[0]
    .value;
  expect(unsubscribe).toHaveBeenCalled();
  await act(async () => {
    screen.update(element());
  });
  expect(
    client.getQueryCache().findAll({queryKey: ['progressHistory', 'second']}),
  ).toHaveLength(0);
});
it('does not read or subscribe for guests or presentation fixtures', async () => {
  await act(async () => {
    screen = renderer.create(element());
  });
  await act(async () => {
    screen.update(element('first', 'UTC', true));
  });
  expect(getProgressMonth).not.toHaveBeenCalled();
  expect(getProgressDayActivity).not.toHaveBeenCalled();
  expect(subscribeHistoryChanges).not.toHaveBeenCalled();
});
it('refreshes both day and month after relevant history changes', async () => {
  jest.useFakeTimers();
  await act(async () => {
    screen = renderer.create(element('first'));
  });
  const listener = (subscribeHistoryChanges as jest.Mock).mock.calls.at(-1)[1];
  const before = (getProgressMonth as jest.Mock).mock.calls.length;
  await act(async () => {
    listener();
    jest.advanceTimersByTime(400);
  });
  expect((getProgressMonth as jest.Mock).mock.calls.length).toBeGreaterThan(
    before,
  );
  expect(getProgressDayActivity).toHaveBeenCalled();
  jest.useRealTimers();
});
