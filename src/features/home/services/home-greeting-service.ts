import AsyncStorage from '@react-native-async-storage/async-storage';

import {firebaseFunctions} from '../../../lib/firebase/functions';
import type {HomeGreetingContext} from './home-data-service';

export type GenerateHomeGreetingResult = {
  headline: string;
  source: 'fallback' | 'gemini';
};

type BuildHomeGreetingCacheKeyInput = {
  context: HomeGreetingContext;
  dateKey: string;
  uid: string;
};

type CachedHomeGreeting = {
  cachedAt: number;
  headline: string;
  source: 'gemini';
};

const homeGreetingCachePrefix = '@hoyst/homeGreeting/v1/';
const homeGreetingCacheMaxAgeMs = 48 * 60 * 60 * 1000;
const inFlightHomeGreetingRequests = new Map<
  string,
  Promise<GenerateHomeGreetingResult>
>();

function encodeCachePart(value: string) {
  return encodeURIComponent(value).replace(/\./g, '%2E');
}

function isCachedHomeGreeting(value: unknown): value is CachedHomeGreeting {
  const cached = value as Partial<CachedHomeGreeting> | undefined;

  return (
    typeof cached?.cachedAt === 'number' &&
    typeof cached.headline === 'string' &&
    cached.headline.trim().length > 0 &&
    cached.source === 'gemini'
  );
}

export function buildHomeGreetingCacheKey({
  context,
  dateKey,
  uid,
}: BuildHomeGreetingCacheKeyInput) {
  const {circleSummary, firstName, timeWindow} = context;

  return [
    homeGreetingCachePrefix,
    encodeCachePart(uid),
    dateKey,
    timeWindow,
    encodeCachePart(firstName ?? 'anon'),
    circleSummary.circleCount,
    circleSummary.needsYouCount,
    circleSummary.atRiskCount,
    circleSummary.doneCount,
    circleSummary.pendingCount,
  ].join(':');
}

export async function getCachedHomeGreeting(
  cacheKey: string,
): Promise<GenerateHomeGreetingResult | undefined> {
  try {
    const rawValue = await AsyncStorage.getItem(cacheKey);

    if (!rawValue) {
      return undefined;
    }

    const cachedValue = JSON.parse(rawValue) as unknown;

    if (!isCachedHomeGreeting(cachedValue)) {
      return undefined;
    }

    if (Date.now() - cachedValue.cachedAt > homeGreetingCacheMaxAgeMs) {
      return undefined;
    }

    return {
      headline: cachedValue.headline.trim(),
      source: 'gemini',
    };
  } catch {
    return undefined;
  }
}

export async function setCachedHomeGreeting(
  cacheKey: string,
  result: GenerateHomeGreetingResult,
): Promise<void> {
  if (result.source !== 'gemini') {
    return;
  }

  try {
    const cachedValue: CachedHomeGreeting = {
      cachedAt: Date.now(),
      headline: result.headline,
      source: 'gemini',
    };

    await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedValue));
  } catch {
    // Cache writes are a UI enhancement only.
  }
}

export async function clearExpiredHomeGreetingCacheEntries(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const greetingKeys = keys.filter(key =>
      key.startsWith(homeGreetingCachePrefix),
    );
    const now = Date.now();
    const keysToRemove: string[] = [];

    await Promise.all(
      greetingKeys.map(async key => {
        try {
          const rawValue = await AsyncStorage.getItem(key);
          const cachedValue = rawValue ? JSON.parse(rawValue) : undefined;

          if (
            !isCachedHomeGreeting(cachedValue) ||
            now - cachedValue.cachedAt > homeGreetingCacheMaxAgeMs
          ) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }),
    );

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export async function generateHomeGreeting({
  cacheKey,
  context,
  dateKey,
}: {
  cacheKey?: string;
  context: HomeGreetingContext;
  dateKey: string;
}): Promise<GenerateHomeGreetingResult> {
  if (cacheKey) {
    const inFlightRequest = inFlightHomeGreetingRequests.get(cacheKey);

    if (inFlightRequest) {
      return inFlightRequest;
    }
  }

  const callable = firebaseFunctions().httpsCallable('generateHomeGreeting');
  const request = callable({...context, dateKey}).then(result => {
    const data = result.data as Partial<GenerateHomeGreetingResult> | undefined;

    if (
      typeof data?.headline !== 'string' ||
      (data.source !== 'fallback' && data.source !== 'gemini')
    ) {
      throw new Error('Could not generate Home greeting.');
    }

    return {
      headline: data.headline,
      source: data.source,
    };
  });

  if (!cacheKey) {
    return request;
  }

  const trackedRequest = request.finally(() => {
    inFlightHomeGreetingRequests.delete(cacheKey);
  });

  inFlightHomeGreetingRequests.set(cacheKey, trackedRequest);

  return trackedRequest;
}
