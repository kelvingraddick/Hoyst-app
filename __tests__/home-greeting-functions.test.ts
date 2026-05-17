import {
  buildHomeGreetingCacheKey,
  buildHomeGreetingFallback,
  parseGeminiHomeGreetingResponse,
  resolveHomeGreeting,
  validateHomeGreetingHeadline,
  type HomeGreetingInput,
} from '../functions/src/homeGreeting';

const input: HomeGreetingInput = {
  circleSummary: {
    atRiskCount: 0,
    circleCount: 1,
    doneCount: 0,
    needsYouCount: 1,
    pendingCount: 0,
  },
  dateKey: '2026-05-17',
  firstName: 'Aaron',
  timeWindow: 'midday',
};

describe('Home greeting function helpers', () => {
  function makeCacheStore({
    cachedGreeting,
    reservation = 'allowed',
  }: {
    cachedGreeting?: {headline: string; source: 'gemini'};
    reservation?: 'allowed' | 'global-cap' | 'user-cap';
  } = {}) {
    return {
      getCachedGreeting: jest.fn().mockResolvedValue(cachedGreeting),
      reserveGeneration: jest.fn().mockResolvedValue(reservation),
      setCachedGreeting: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('builds a deterministic fallback when Gemini is unavailable', async () => {
    await expect(resolveHomeGreeting({apiKey: '', input})).resolves.toEqual(
      buildHomeGreetingFallback(input),
    );
  });

  it('accepts a valid Gemini headline', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    headline: 'Aaron, midpoint check. Busy, or dangerous?',
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
      }),
    ).resolves.toEqual({
      headline: 'Aaron, midpoint check. Busy, or dangerous?',
      source: 'gemini',
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: {
          properties: {
            headline: {type: 'STRING'},
          },
          type: 'OBJECT',
        },
      },
    });
  });

  it('falls back when Gemini omits the name or returns invalid text', async () => {
    const missingName = validateHomeGreetingHeadline({
      firstName: 'Aaron',
      headline: 'Midday check. Busy, or dangerous?',
    });
    const tooLong = validateHomeGreetingHeadline({
      firstName: 'Aaron',
      headline:
        'Aaron, this sentence is intentionally far too long to fit comfortably inside the compact Home header view.',
    });
    const malformedPayload = parseGeminiHomeGreetingResponse({
      candidates: [{content: {parts: [{text: 'not json'}]}}],
    });

    expect(missingName).toBeUndefined();
    expect(tooLong).toBeUndefined();
    expect(malformedPayload).toBeUndefined();
  });

  it('falls back when Gemini returns malformed JSON through the resolver', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({
        candidates: [{content: {parts: [{text: 'nope'}]}}],
      }),
      ok: true,
    });

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
      }),
    ).resolves.toEqual(buildHomeGreetingFallback(input));
  });

  it('returns a cached Gemini greeting without calling Gemini or reserving budget', async () => {
    const cacheStore = makeCacheStore({
      cachedGreeting: {
        headline: 'Aaron, cached and still sharp.',
        source: 'gemini',
      },
    });
    const fetchImpl = jest.fn();

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        cacheStore,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
        uid: 'user-1',
      }),
    ).resolves.toEqual({
      headline: 'Aaron, cached and still sharp.',
      source: 'gemini',
    });
    expect(cacheStore.reserveGeneration).not.toHaveBeenCalled();
    expect(cacheStore.setCachedGreeting).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stores a validated Gemini greeting on cache miss', async () => {
    const cacheStore = makeCacheStore();
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    headline: 'Aaron, fresh status. Handle it cleanly.',
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        cacheStore,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
        uid: 'user-1',
      }),
    ).resolves.toEqual({
      headline: 'Aaron, fresh status. Handle it cleanly.',
      source: 'gemini',
    });
    expect(cacheStore.reserveGeneration).toHaveBeenCalledWith(
      'user-1',
      '2026-05-17',
    );
    expect(cacheStore.setCachedGreeting).toHaveBeenCalledWith(
      buildHomeGreetingCacheKey({input, uid: 'user-1'}),
      input,
      {
        headline: 'Aaron, fresh status. Handle it cleanly.',
        source: 'gemini',
      },
    );
  });

  it('uses circle status counts in the cache key', () => {
    const changedStatusInput: HomeGreetingInput = {
      ...input,
      circleSummary: {
        ...input.circleSummary,
        doneCount: 1,
        needsYouCount: 0,
      },
    };

    expect(buildHomeGreetingCacheKey({input, uid: 'user-1'})).not.toEqual(
      buildHomeGreetingCacheKey({
        input: changedStatusInput,
        uid: 'user-1',
      }),
    );
  });

  it('falls back when the per-user daily budget is reached', async () => {
    const cacheStore = makeCacheStore({reservation: 'user-cap'});
    const fetchImpl = jest.fn();

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        cacheStore,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
        uid: 'user-1',
      }),
    ).resolves.toEqual(buildHomeGreetingFallback(input));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cacheStore.setCachedGreeting).not.toHaveBeenCalled();
  });

  it('falls back when the global daily budget is reached', async () => {
    const cacheStore = makeCacheStore({reservation: 'global-cap'});
    const fetchImpl = jest.fn();

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        cacheStore,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
        uid: 'user-1',
      }),
    ).resolves.toEqual(buildHomeGreetingFallback(input));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cacheStore.setCachedGreeting).not.toHaveBeenCalled();
  });

  it('falls back when Gemini returns an HTTP error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(
      resolveHomeGreeting({
        apiKey: 'gemini-key',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        input,
      }),
    ).resolves.toEqual(buildHomeGreetingFallback(input));
  });
});
