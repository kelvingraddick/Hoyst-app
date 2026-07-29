const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/firebase/functions', () => ({
  firebaseFunctions: jest.fn(() => ({
    httpsCallable: mockHttpsCallable,
  })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildHomeGreetingCacheKey,
  clearExpiredHomeGreetingCacheEntries,
  generateHomeGreeting,
  getCachedHomeGreeting,
  setCachedHomeGreeting,
} from '../src/features/home/services/home-greeting-service';
import type {HomeGreetingContext} from '../src/features/home/services/home-data-service';

const context: HomeGreetingContext = {
  circleSummary: {
    atRiskCount: 0,
    circleCount: 1,
    doneCount: 0,
    needsYouCount: 1,
    pendingCount: 0,
  },
  firstName: 'Aaron',
  primaryAction: {
    circleMode: 'group',
    circleTitle: 'Workout Circle',
    isAtRisk: false,
    kind: 'tap_in',
    remainingActionCount: 0,
    urgency: 'routine',
  },
  timeWindow: 'midday',
};

describe('Home greeting client cache', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
    await AsyncStorage.clear();
  });

  it('builds stable exact-context cache keys', () => {
    const cacheKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    const changedStatusKey = buildHomeGreetingCacheKey({
      context: {
        ...context,
        circleSummary: {
          ...context.circleSummary,
          doneCount: 1,
          needsYouCount: 0,
        },
      },
      dateKey: '2026-05-17',
      uid: 'user-1',
    });

    expect(cacheKey).toBe(
      '@hoyst/homeGreeting/v4/:user-1:2026-05-17:midday:Aaron:1:1:0:0:0:1:0:tap_in:Workout%20Circle:group:0:0:routine',
    );
    expect(changedStatusKey).not.toBe(cacheKey);
  });

  it('invalidates v4 cache entries when the primary action changes', () => {
    const tapInKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    const updateKey = buildHomeGreetingCacheKey({
      context: {
        ...context,
        primaryAction: {
          ...context.primaryAction!,
          kind: 'update_tap_in',
          remainingActionCount: 2,
        },
      },
      dateKey: '2026-05-17',
      uid: 'user-1',
    });

    expect(updateKey).not.toBe(tapInKey);
    expect(updateKey).toContain(':update_tap_in:');
    expect(updateKey).toContain(':2');
  });

  it('invalidates v4 cache entries when deadline urgency begins', () => {
    const routineKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    const deadlineKey = buildHomeGreetingCacheKey({
      context: {
        ...context,
        primaryAction: {
          ...context.primaryAction!,
          isAtRisk: true,
          urgency: 'deadline',
        },
      },
      dateKey: '2026-05-17',
      uid: 'user-1',
    });

    expect(deadlineKey).not.toBe(routineKey);
    expect(deadlineKey).toContain(':deadline');
  });

  it('reads and writes exact-key Gemini greetings', async () => {
    const cacheKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });

    await setCachedHomeGreeting(cacheKey, {
      headline: 'Aaron, cached and ready.',
      source: 'gemini',
    });

    await expect(getCachedHomeGreeting(cacheKey)).resolves.toEqual({
      headline: 'Aaron, cached and ready.',
      source: 'gemini',
    });
  });

  it('ignores fallback, stale, and malformed cached values', async () => {
    const cacheKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    const staleCacheKey = `${cacheKey}:stale`;
    const malformedCacheKey = `${cacheKey}:malformed`;

    await setCachedHomeGreeting(cacheKey, {
      headline: 'Aaron, local fallback should not persist.',
      source: 'fallback',
    });
    await AsyncStorage.setItem(
      staleCacheKey,
      JSON.stringify({
        cachedAt: Date.now() - 49 * 60 * 60 * 1000,
        headline: 'Aaron, stale but stylish.',
        source: 'gemini',
      }),
    );
    await AsyncStorage.setItem(
      malformedCacheKey,
      JSON.stringify({headline: 'Aaron, missing metadata.'}),
    );

    await expect(getCachedHomeGreeting(cacheKey)).resolves.toBeUndefined();
    await expect(getCachedHomeGreeting(staleCacheKey)).resolves.toBeUndefined();
    await expect(
      getCachedHomeGreeting(malformedCacheKey),
    ).resolves.toBeUndefined();
  });

  it('removes expired cache entries during best-effort cleanup', async () => {
    const freshCacheKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    const staleCacheKey = `${freshCacheKey}:stale`;

    await setCachedHomeGreeting(freshCacheKey, {
      headline: 'Aaron, still fresh.',
      source: 'gemini',
    });
    await AsyncStorage.setItem(
      staleCacheKey,
      JSON.stringify({
        cachedAt: Date.now() - 49 * 60 * 60 * 1000,
        headline: 'Aaron, stale now.',
        source: 'gemini',
      }),
    );

    await clearExpiredHomeGreetingCacheEntries();

    await expect(AsyncStorage.getItem(freshCacheKey)).resolves.toBeTruthy();
    await expect(AsyncStorage.getItem(staleCacheKey)).resolves.toBeNull();
  });

  it('treats cache write failures as non-fatal', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      setCachedHomeGreeting('cache-key', {
        headline: 'Aaron, this should not throw.',
        source: 'gemini',
      }),
    ).resolves.toBeUndefined();
  });

  it('shares one in-flight callable request for duplicate cache-key calls', async () => {
    const cacheKey = buildHomeGreetingCacheKey({
      context,
      dateKey: '2026-05-17',
      uid: 'user-1',
    });
    let resolveCallable: (value: {
      data: {headline: string; source: 'gemini'};
    }) => void;
    const callablePromise = new Promise<{
      data: {headline: string; source: 'gemini'};
    }>(resolve => {
      resolveCallable = resolve;
    });

    mockCallable.mockReturnValue(callablePromise);

    const firstRequest = generateHomeGreeting({
      cacheKey,
      context,
      dateKey: '2026-05-17',
    });
    const secondRequest = generateHomeGreeting({
      cacheKey,
      context,
      dateKey: '2026-05-17',
    });

    resolveCallable!({
      data: {
        headline: 'Aaron, one request did the work.',
        source: 'gemini',
      },
    });

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      {
        headline: 'Aaron, one request did the work.',
        source: 'gemini',
      },
      {
        headline: 'Aaron, one request did the work.',
        source: 'gemini',
      },
    ]);
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });
});
