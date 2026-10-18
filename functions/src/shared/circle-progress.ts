/** Pure period-goal rules shared by Functions, native presentation and migrations. */
export type CircleCadence = 'daily' | 'weekly' | 'monthly';
export type StreakUnit = 'day' | 'week' | 'month';
export type PeriodOutcome =
  | 'secured'
  | 'open'
  | 'broken'
  | 'neutral'
  | 'unknown';
export type CirclePeriod = {key: string; start: string; end: string};
export type MembershipSpan = {
  uid: string;
  start: string;
  end?: string;
  runId: string;
};
export type ActivityInterval = {start: string; end?: string};
export type MemberPeriodResult = CirclePeriod & {
  uid: string;
  required: number;
  covered: number;
  remaining: number;
  outcome: PeriodOutcome;
};
export type CircleStreak = {
  count: number | null;
  unit: StreakUnit;
  availability: 'ready' | 'unavailable' | 'recalculating';
};
export type CircleProgressSummary = {
  version: 2;
  revision: string;
  asOfDateKey: string;
  cadence: CircleCadence;
  period: CirclePeriod;
  streak: CircleStreak;
  progress: {covered: number; required: number; outcome: PeriodOutcome};
};
export type CircleProgressResult = {
  viewer?: CircleProgressSummary;
  group?: CircleProgressSummary;
  viewerStreakDelta?: number;
  groupStreakDelta?: number;
};
export type CircleDayCoverage = {
  known: boolean;
  expectedUids: string[];
  completedUids: string[];
  skippedUids: string[];
  restoredUids: string[];
};

export function shiftCircleDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function circleDateKey(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function circlePeriodForDate(
  dateKey: string,
  cadence: CircleCadence,
): CirclePeriod {
  if (cadence === 'daily') {
    return {key: dateKey, start: dateKey, end: dateKey};
  }
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (cadence === 'weekly') {
    const start = shiftCircleDate(dateKey, -((date.getUTCDay() + 6) % 7));
    return {key: start, start, end: shiftCircleDate(start, 6)};
  }
  const start = `${dateKey.slice(0, 7)}-01`;
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12),
  )
    .toISOString()
    .slice(0, 10);
  return {key: dateKey.slice(0, 7), start, end};
}

export function circleDates(start: string, end: string) {
  const result: string[] = [];
  for (let day = start; day <= end; day = shiftCircleDate(day, 1)) {
    result.push(day);
  }
  return result;
}

export function circleStreakUnit(cadence: CircleCadence): StreakUnit {
  return cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month';
}

export function formatCircleStreak(streak?: CircleStreak) {
  if (!streak || streak.availability !== 'ready' || streak.count === null) {
    return '—';
  }
  return `${streak.count} ${streak.unit}${streak.count === 1 ? '' : 's'}`;
}

export function isCircleDateEligible(
  day: string,
  spans: MembershipSpan[],
  intervals: ActivityInterval[],
  includeCoveredEndDate = false,
) {
  return (
    spans.some(
      span =>
        span.start <= day &&
        (!span.end ||
          day < span.end ||
          (includeCoveredEndDate && day === span.end)),
    ) &&
    intervals.some(
      interval =>
        interval.start <= day &&
        (!interval.end ||
          day < interval.end ||
          (includeCoveredEndDate && day === interval.end)),
    )
  );
}

export function evaluateMemberPeriod({
  period,
  uid,
  spans,
  intervals,
  target,
  coveredDates,
  today,
  known = true,
}: {
  period: CirclePeriod;
  uid: string;
  spans: MembershipSpan[];
  intervals: ActivityInterval[];
  target: number;
  coveredDates: ReadonlySet<string>;
  today: string;
  known?: boolean;
}): MemberPeriodResult {
  const memberSpans = spans.filter(span => span.uid === uid);
  const eligible = circleDates(period.start, period.end).filter(day =>
    isCircleDateEligible(day, memberSpans, intervals),
  );
  // Already recorded coverage on the departure/archive date remains earned.
  // Uncovered requirements on that date are canceled by the transition.
  const coveredEligible = circleDates(period.start, period.end).filter(
    day =>
      coveredDates.has(day) &&
      day <= today &&
      isCircleDateEligible(day, memberSpans, intervals, true),
  );
  // Target depends on entry/resume eligibility, not how many unmissed days remain today.
  const possibleAtEntry = circleDates(period.start, period.end).filter(
    day =>
      memberSpans.some(
        span => span.start <= day && (!span.end || span.end >= period.start),
      ) &&
      intervals.some(
        interval =>
          interval.start <= day &&
          (!interval.end || interval.end >= period.start),
      ),
  ).length;
  const required =
    eligible.length || coveredEligible.length
      ? Math.min(Math.max(1, Math.round(target)), possibleAtEntry)
      : 0;
  const covered = Math.min(required, coveredEligible.length);
  const remaining = eligible.filter(
    day => day >= today && !coveredDates.has(day),
  ).length;
  const interrupted =
    memberSpans.some(
      span => span.end && span.end >= period.start && span.end <= period.end,
    ) ||
    intervals.some(
      interval =>
        interval.end &&
        interval.end >= period.start &&
        interval.end <= period.end,
    );
  const outcome: PeriodOutcome = !known
    ? 'unknown'
    : required === 0
    ? 'neutral'
    : covered >= required
    ? 'secured'
    : interrupted
    ? 'neutral'
    : covered + remaining < required
    ? 'broken'
    : 'open';
  return {...period, uid, required, covered, remaining, outcome};
}

export function groupPeriodOutcome(
  members: MemberPeriodResult[],
  known: boolean,
): PeriodOutcome {
  if (!known || members.some(member => member.outcome === 'unknown')) {
    return 'unknown';
  }
  const expected = members.filter(member => member.outcome !== 'neutral');
  if (!expected.length) {
    return 'neutral';
  }
  if (expected.some(member => member.outcome === 'broken')) {
    return 'broken';
  }
  return expected.every(member => member.outcome === 'secured')
    ? 'secured'
    : 'open';
}

export function countCirclePeriodStreak(
  periods: {outcome: PeriodOutcome}[],
  unit: StreakUnit,
): CircleStreak {
  let count = 0;
  let openAllowed = true;
  for (let index = periods.length - 1; index >= 0; index--) {
    const {outcome} = periods[index];
    if (outcome === 'neutral') {
      continue;
    }
    if (outcome === 'unknown') {
      return {count: null, unit, availability: 'unavailable'};
    }
    if (outcome === 'open' && openAllowed) {
      openAllowed = false;
      continue;
    }
    if (outcome !== 'secured') {
      break;
    }
    count++;
    openAllowed = false;
  }
  return {count, unit, availability: 'ready'};
}

export function circleProgressConfiguration(circle: Record<string, unknown>) {
  const frequency = (circle.commitmentFrequency ?? {}) as Record<
    string,
    unknown
  >;
  const cadence: CircleCadence =
    circle.commitmentCadence === 'daily' ||
    circle.commitmentCadence === 'weekly' ||
    circle.commitmentCadence === 'monthly'
      ? circle.commitmentCadence
      : Number(frequency.tapInsPerWeek) >= 7
      ? 'daily'
      : 'weekly';
  const target =
    cadence === 'daily'
      ? 1
      : Math.min(
          cadence === 'weekly' ? 7 : 31,
          Math.max(
            1,
            Math.round(
              Number(
                frequency.opportunitiesPerPeriod ?? frequency.tapInsPerWeek,
              ) || (cadence === 'weekly' ? 7 : 4),
            ),
          ),
        );
  const timezone =
    typeof circle.timezone === 'string' ? circle.timezone : 'UTC';
  return {
    cadence,
    target,
    timezone,
    revision: JSON.stringify([2, cadence, target, timezone]),
  };
}

export function readCircleProgress(
  value: unknown,
  circle?: Record<string, unknown>,
): CircleProgressSummary | undefined {
  const data = value as CircleProgressSummary | undefined;
  if (data?.version !== 2 || !data.streak || !data.progress || !data.period) {
    return undefined;
  }
  if (
    !['daily', 'weekly', 'monthly'].includes(data.cadence) ||
    data.streak.unit !== circleStreakUnit(data.cadence) ||
    !['ready', 'unavailable', 'recalculating'].includes(
      data.streak.availability,
    ) ||
    (data.streak.count !== null &&
      (!Number.isInteger(data.streak.count) || data.streak.count < 0)) ||
    (data.streak.availability === 'ready' && data.streak.count === null) ||
    !Number.isFinite(data.progress.covered) ||
    data.progress.covered < 0 ||
    !Number.isFinite(data.progress.required) ||
    data.progress.required < 0
  ) {
    return undefined;
  }
  if (circle) {
    const config = circleProgressConfiguration(circle);
    if (
      data.revision !== config.revision ||
      (circle.lifecycleStatus !== 'archived' &&
        data.asOfDateKey !== circleDateKey(config.timezone))
    ) {
      return undefined;
    }
  }
  return data;
}
