import {
  loadTapInStoryContext,
  unavailableTapInStoryContext,
} from '../src/features/check-in/services/tap-in-story-context';
import {
  circlePeriodForDate,
  type CircleProgressSummary,
} from '../src/shared/circle-progress';
import type {RootStackParamList} from '../src/navigation/types';

const mockRefresh = jest.fn();
const mockGet = jest.fn();
let mockRecords = new Map<string, unknown>();

jest.mock('../src/features/circles/services/circle-progress-service', () => ({
  refreshCircleProgress: (...args: unknown[]) => mockRefresh(...args),
}));
jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: () => {
    const ref = (path: string): unknown => ({
      collection: (name: string) => ref(`${path}/${name}`),
      doc: (name: string) => ref(`${path}/${name}`),
      get: (options: unknown) => mockGet(path, options),
    });
    return ref('');
  },
}));

const now = new Date('2026-10-17T12:00:00Z');
const base: RootStackParamList['TapInStoryShare'] = {
  circleId: 'circle-1',
  dateKey: '2026-10-17',
  timezone: 'America/New_York',
  status: 'partial',
  currentValue: 12,
  targetValue: 20,
  unitLabel: 'pages',
  source: 'home',
};
const path = (date: string) => `/circles/circle-1/days/${date}/checkIns/user-1`;
function summary(
  cadence: 'daily' | 'weekly' | 'monthly' = 'weekly',
  date = base.dateKey,
): CircleProgressSummary {
  return {
    version: 2,
    revision: 'v1',
    cadence,
    asOfDateKey: date,
    period: circlePeriodForDate(date, cadence),
    progress: {covered: 2, required: 4, outcome: 'open'},
    streak: {
      count: 3,
      unit:
        cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month',
      availability: 'ready',
    },
  };
}

beforeEach(() => {
  mockRecords = new Map();
  mockRefresh
    .mockReset()
    .mockResolvedValue({viewer: summary(), group: summary()});
  mockGet.mockReset().mockImplementation(async (key: string) => {
    const value = mockRecords.get(key);
    if (value instanceof Error) {
      throw value;
    }
    return {data: () => value};
  });
});

it('reads only the selected tap-in across a month boundary, with no history or membership queries', async () => {
  const dateKey = '2026-10-02';
  mockRecords.set(path(dateKey), {status: 'done'});
  const result = await loadTapInStoryContext({...base, dateKey}, 'user-1', now);
  expect(mockGet.mock.calls).toEqual([[path(dateKey), {source: 'server'}]]);
  expect(mockRefresh).toHaveBeenCalledWith('circle-1');
  expect(result.tapIn.dateKey).toBe(dateKey);
  expect(result).not.toHaveProperty('activity');
});

it('starts the selected-entry read and progress refresh in parallel', async () => {
  let finish: (value: unknown) => void = () => {};
  mockRefresh.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const pending = loadTapInStoryContext(base, 'user-1', now);
  expect(mockGet).toHaveBeenCalledTimes(1);
  finish({viewer: summary()});
  await pending;
});

it('uses the saved current entry when a partial tap-in was updated to complete', async () => {
  mockRecords.set(path(base.dateKey), {
    status: 'done',
    coverageStatus: 'covered',
    currentValue: 25,
  });
  const result = await loadTapInStoryContext(base, 'user-1', now);
  expect(result.tapIn).toEqual(
    expect.objectContaining({
      status: 'done',
      currentValue: 25,
      targetValue: 20,
    }),
  );
  expect(result).not.toHaveProperty('activity');
});

it('does not resurrect a removed entry from navigation data', async () => {
  const result = await loadTapInStoryContext(base, 'user-1', now);
  expect(result.tapIn).toEqual({dateKey: base.dateKey});
});

it('uses completion progress only if it still belongs to the current day and period', async () => {
  mockRefresh.mockRejectedValue(new Error('offline'));
  const valid = summary();
  const result = await loadTapInStoryContext(
    {
      ...base,
      circleProgress: {viewer: valid, group: summary('daily', '2026-10-16')},
    },
    'user-1',
    now,
  );
  expect(result.progress?.viewer).toBe(valid);
  expect(result.progress?.group).toBeUndefined();
});

it('prefers the fresh progress response to completion progress', async () => {
  const old = summary();
  old.progress = {covered: 1, required: 4, outcome: 'open'};
  const result = await loadTapInStoryContext(
    {...base, circleProgress: {viewer: old}},
    'user-1',
    now,
  );
  expect(result.progress?.viewer?.progress.covered).toBe(2);
});

it.each(['daily', 'weekly', 'monthly'] as const)(
  'does not carry %s progress across a period boundary',
  cadence => {
    const dateKey = '2026-11-01';
    const old = summary(cadence, dateKey);
    const result = unavailableTapInStoryContext(
      {...base, dateKey, circleProgress: {viewer: old}},
      new Date('2026-11-02T17:00:00Z'),
    );
    expect(result.progress?.viewer).toBeUndefined();
  },
);

it('validates fallback progress in the Circle timezone around UTC midnight', () => {
  const viewer = summary('daily', '2026-10-17');
  const result = unavailableTapInStoryContext(
    {...base, circleProgress: {viewer}},
    new Date('2026-10-18T02:00:00Z'),
  );
  expect(result.progress?.viewer).toBe(viewer);
});

it('keeps the saved tap-in fallback on a failed read without inventing progress', async () => {
  mockRefresh.mockRejectedValue(new Error('offline'));
  mockRecords.set(path(base.dateKey), new Error('offline'));
  const result = await loadTapInStoryContext(base, 'user-1', now);
  expect(result.tapIn.currentValue).toBe(12);
  expect(result.progress?.viewer).toBeUndefined();
  expect(result).not.toHaveProperty('activity');
});

it('does not query private data without a signed-in viewer', async () => {
  const result = await loadTapInStoryContext(base, undefined, now);
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(result.tapIn.status).toBe('partial');
});

it('settles a stalled refresh instead of leaving share actions blocked forever', async () => {
  jest.useFakeTimers();
  try {
    mockRefresh.mockReturnValue(new Promise(() => {}));
    const pending = loadTapInStoryContext(base, 'user-1', now);
    await jest.advanceTimersByTimeAsync(10000);
    const result = await pending;
    expect(result.progress?.viewer).toBeUndefined();
  } finally {
    jest.useRealTimers();
  }
});
