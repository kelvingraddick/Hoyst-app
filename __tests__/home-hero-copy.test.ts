import {getHomeHeroCopy} from '../src/features/home/services/home-hero-copy';
import type {HomeGreetingTimeWindow} from '../src/features/home/services/home-data-service';

const timeWindows: readonly HomeGreetingTimeWindow[] = [
  'morning',
  'midday',
  'afternoon',
  'evening',
];

const personalizedHeadlines: Record<HomeGreetingTimeWindow, string> = {
  morning: 'Set the tone, Kelvin.',
  midday: 'Keep it moving, Kelvin.',
  afternoon: 'Make the next move count, Kelvin.',
  evening: 'One last push, Kelvin.',
};

const genericHeadlines: Record<HomeGreetingTimeWindow, string> = {
  morning: 'Set the tone.',
  midday: 'Keep it moving.',
  afternoon: 'Make the next move count.',
  evening: 'One last push.',
};

function getHeadline({
  dateKey = '2026-01-01',
  firstName,
  timeWindow,
}: {
  dateKey?: string;
  firstName?: string;
  timeWindow: HomeGreetingTimeWindow;
}) {
  return getHomeHeroCopy({
    dateKey,
    firstName,
    momentumStatus: 'getting_started',
    streakDays: 0,
    timeWindow,
  }).headline;
}

describe('getHomeHeroCopy', () => {
  it.each(timeWindows)('personalizes the named %s headline', timeWindow => {
    expect(getHeadline({firstName: 'Kelvin', timeWindow})).toBe(
      personalizedHeadlines[timeWindow],
    );
  });

  it.each(timeWindows)(
    'uses the generic %s headline without a usable first name',
    timeWindow => {
      expect(getHeadline({firstName: '  ', timeWindow})).toBe(
        genericHeadlines[timeWindow],
      );
    },
  );

  it('keeps all twelve daily headline options reachable and unique', () => {
    const dateKeys = ['2026-01-01', '2026-01-02', '2026-01-03'];
    const headlines = timeWindows.flatMap(timeWindow =>
      dateKeys.map(dateKey =>
        getHeadline({dateKey, firstName: 'Kelvin', timeWindow}),
      ),
    );

    expect(new Set(headlines).size).toBe(12);
    expect(headlines).not.toContain('Today shows your commitment.');
  });

  it('keeps the date-based selection deterministic', () => {
    expect(
      getHeadline({
        dateKey: '2026-01-02',
        firstName: 'Kelvin',
        timeWindow: 'morning',
      }),
    ).toBe(
      getHeadline({
        dateKey: '2026-01-02',
        firstName: 'Kelvin',
        timeWindow: 'morning',
      }),
    );
  });
});
