import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {useProgress} from '../src/features/progress/hooks/useProgress';
let mockSession = {status: 'authenticatedReady', user: {uid: 'one'}};
const mockStore = Object.assign(
  (select: (state: typeof mockSession) => unknown) => select(mockSession),
  {getState: () => mockSession},
);
jest.mock('../src/store/session-store', () => ({
  useSessionStore: Object.assign((...args: [never]) => mockStore(...args), {
    getState: () => mockSession,
  }),
}));
const mockEnsure = jest.fn();
const mockSubscribers: Record<string, (summary: unknown) => void> = {};
jest.mock('../src/features/progress/services/progress-service', () => ({
  ensureProgress: (...args: unknown[]) => mockEnsure(...args),
  subscribeProgress: (uid: string, callback: (summary: unknown) => void) => {
    mockSubscribers[uid] = callback;
    return jest.fn();
  },
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
let value: ReturnType<typeof useProgress>;
function Harness() {
  value = useProgress();
  return null;
}
let screen: renderer.ReactTestRenderer;
const base = {
  totalXP: 10,
  level: 1,
  levelXP: 10,
  requiredXP: 70,
  remainingXP: 60,
  inventory: {skips: 3, restores: 1},
  tasks: {},
  milestones: {},
  routineRemainingXP: 30,
  flags: {earning: true, inventory: true, restoring: true, buying: false},
  window: {closesAt: Date.now() + 100000, earned: 0},
};
afterEach(() => {
  act(() => screen?.unmount());
  jest.useRealTimers();
  mockEnsure.mockReset();
});
it('clears account data immediately and ignores old initialization and subscription results', async () => {
  mockSession = {status: 'authenticatedReady', user: {uid: 'one'}};
  let finishOld!: (result: unknown) => void;
  mockEnsure
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValueOnce({...base, totalXP: 20});
  await act(async () => {
    screen = renderer.create(<Harness />);
  });
  expect(value!.loading).toBe(true);
  mockSession = {...mockSession, user: {uid: 'two'}};
  await act(async () => {
    screen.update(<Harness />);
  });
  expect(value!.summary?.totalXP).toBe(20);
  await act(async () => {
    finishOld({...base, totalXP: 999});
    mockSubscribers.one({totalXP: 999});
  });
  expect(value!.uid).toBe('two');
  expect(value!.summary?.totalXP).toBe(20);
  mockSession = {status: 'guest', user: {uid: ''}};
  await act(async () => {
    screen.update(<Harness />);
  });
  expect(value!.summary).toBeUndefined();
  expect(value!.uid).toBeUndefined();
});
it('refreshes the daily earning window while the screen remains open', async () => {
  jest.useFakeTimers();
  mockSession = {status: 'authenticatedReady', user: {uid: 'one'}};
  const expires = Date.now() + 2000;
  mockEnsure.mockResolvedValue({
    ...base,
    window: {closesAt: expires, earned: 30},
    routineRemainingXP: 0,
  });
  await act(async () => {
    screen = renderer.create(<Harness />);
  });
  mockEnsure.mockResolvedValue({
    ...base,
    window: {closesAt: expires + 86400000, earned: 0},
  });
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(mockEnsure).toHaveBeenCalledTimes(2);
  expect(value!.summary?.routineRemainingXP).toBe(30);
});
