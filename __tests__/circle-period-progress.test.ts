import {
  circleDateKey,
  circleDates,
  circlePeriodForDate,
  circleStreakUnit,
  countCirclePeriodStreak,
  evaluateMemberPeriod,
  formatCircleStreak,
  groupPeriodOutcome,
} from '../functions/src/shared/circle-progress';

const period = circlePeriodForDate('2026-10-16', 'weekly');
const spans = [{uid: 'me', start: '2026-10-12', runId: 'initial'}];
const intervals = [{start: '2026-10-12'}];
const member = (dates: string[], today = '2026-10-16', overrides = {}) =>
  evaluateMemberPeriod({
    period,
    uid: 'me',
    spans,
    intervals,
    target: 3,
    coveredDates: new Set(dates),
    today,
    ...overrides,
  });

describe('cadence-based Circle goals', () => {
  it('uses Monday boundaries and calendar months including leap February', () => {
    expect(period).toEqual({
      key: '2026-10-12',
      start: '2026-10-12',
      end: '2026-10-18',
    });
    expect(circlePeriodForDate('2028-02-29', 'monthly')).toEqual({
      key: '2028-02',
      start: '2028-02-01',
      end: '2028-02-29',
    });
    expect(circlePeriodForDate('2026-12-31', 'daily').end).toBe('2026-12-31');
  });
  it('uses local dates across DST and UTC midnight', () => {
    expect(
      circleDateKey('America/New_York', new Date('2026-11-01T04:30:00Z')),
    ).toBe('2026-11-01');
    expect(
      circleDateKey('America/New_York', new Date('2026-11-02T04:30:00Z')),
    ).toBe('2026-11-01');
    expect(circleDates('2026-10-31', '2026-11-02')).toHaveLength(3);
  });
  it('credits three distinct days even inside the same old scheduled window', () => {
    expect(member(['2026-10-12', '2026-10-13', '2026-10-14']).outcome).toBe(
      'secured',
    );
    expect(member(['2026-10-12', '2026-10-12']).covered).toBe(1);
  });
  it('keeps achievable periods open and detects failure before the deadline', () => {
    expect(member(['2026-10-12'], '2026-10-16').outcome).toBe('open');
    expect(member([], '2026-10-17').outcome).toBe('broken');
    expect(member(['2026-10-12', '2026-10-14'], '2026-10-18').outcome).toBe(
      'open',
    );
    expect(member(['2026-10-12', '2026-10-14'], '2026-10-19').outcome).toBe(
      'broken',
    );
  });
  it('caps entry targets without lowering them as days pass', () => {
    const late = {spans: [{uid: 'me', start: '2026-10-17', runId: 'late'}]};
    expect(member([], '2026-10-17', late).required).toBe(2);
    expect(member([], '2026-10-18', late).required).toBe(2);
    expect(member([], '2026-10-18', late).outcome).toBe('broken');
    expect(
      member(['2026-10-17', '2026-10-18'], '2026-10-18', late).outcome,
    ).toBe('secured');
  });
  it('requires the full target for a partial period that still has enough days', () => {
    expect(
      member([], '2026-10-16', {
        spans: [{uid: 'me', start: '2026-10-16', runId: 'late'}],
      }).required,
    ).toBe(3);
  });
  it('does not award a free period on leaving or archiving', () => {
    expect(
      member(['2026-10-12'], '2026-10-16', {
        spans: [{...spans[0], end: '2026-10-14'}],
      }).outcome,
    ).toBe('neutral');
    expect(
      member(['2026-10-12'], '2026-10-16', {
        intervals: [{start: '2026-10-12', end: '2026-10-14'}],
      }).outcome,
    ).toBe('neutral');
  });
  it('freezes already earned coverage on the archive date without awarding an unfinished goal', () => {
    const daily = circlePeriodForDate('2026-10-12', 'daily');
    const archived = {
      period: daily,
      intervals: [{start: '2026-10-12', end: '2026-10-12'}],
      target: 1,
    };
    expect(member(['2026-10-12'], '2026-10-13', archived).outcome).toBe(
      'secured',
    );
    expect(member([], '2026-10-13', archived).outcome).toBe('neutral');
  });
  it('does not count noneligible activity or empty cohorts', () => {
    expect(
      member(['2026-10-12'], '2026-10-16', {
        spans: [{uid: 'me', start: '2026-10-17', runId: 'late'}],
      }).covered,
    ).toBe(0);
    expect(groupPeriodOutcome([], true)).toBe('neutral');
    expect(groupPeriodOutcome([], false)).toBe('unknown');
  });
  it('keeps personal success independent of a failed group member', () => {
    const success = member(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect(
      groupPeriodOutcome(
        [success, {...success, uid: 'other', outcome: 'broken'}],
        true,
      ),
    ).toBe('broken');
    expect(success.outcome).toBe('secured');
  });
  it('recalculates after removal and target/cadence changes', () => {
    expect(member(['2026-10-12', '2026-10-13'], '2026-10-16').outcome).toBe(
      'open',
    );
    expect(
      member(['2026-10-12', '2026-10-13'], '2026-10-16', {target: 2}).outcome,
    ).toBe('secured');
    expect(circleStreakUnit('monthly')).toBe('month');
  });
  it('holds open periods, skips neutral archive gaps, and stops at broken or unknown history', () => {
    const streak = countCirclePeriodStreak(
      [
        {outcome: 'secured'},
        {outcome: 'neutral'},
        {outcome: 'secured'},
        {outcome: 'open'},
      ],
      'week',
    );
    expect(streak.count).toBe(2);
    expect(
      countCirclePeriodStreak(
        [{outcome: 'secured'}, {outcome: 'broken'}],
        'week',
      ).count,
    ).toBe(0);
    expect(
      countCirclePeriodStreak(
        [{outcome: 'unknown'}, {outcome: 'secured'}],
        'week',
      ).count,
    ).toBeNull();
    expect(
      countCirclePeriodStreak(
        [{outcome: 'unknown'}, {outcome: 'broken'}, {outcome: 'secured'}],
        'week',
      ).count,
    ).toBe(1);
  });
  it.each([
    ['day', 1, '1 day'],
    ['week', 2, '2 weeks'],
    ['month', 1, '1 month'],
  ] as const)(
    'formats units without day-only assumptions',
    (unit, count, expected) => {
      expect(formatCircleStreak({unit, count, availability: 'ready'})).toBe(
        expected,
      );
      expect(
        formatCircleStreak({unit, count: null, availability: 'unavailable'}),
      ).toBe('—');
    },
  );
});
