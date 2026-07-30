import {clampOpportunitiesPerPeriod} from '../shared/commitments';
import type {CommitmentCadence} from '../shared/commitments';

export type OpportunityStatus =
  | 'upcoming'
  | 'available'
  | 'completed'
  | 'missed'
  | 'expired'
  | 'skipped';

export type MomentumStatus =
  | 'getting_started'
  | 'building_momentum'
  | 'strong_momentum'
  | 'peak_momentum';

export type CommitmentSchedule = {
  cadence: CommitmentCadence;
  opportunitiesPerPeriod: number;
  slotPolicy: 'scheduled_slots';
  timezone: string;
};

export type OpportunitySlot = {
  availableDateKey: string;
  expiresDateKey: string;
  periodKey: string;
  slotIndex: number;
};

export type MomentumOpportunity = {
  availableDateKey: string;
  expectedForCircle?: boolean;
  expiresDateKey?: string;
  periodKey: string;
  resolvedAtMs?: number;
  resolvedDateKey?: string;
  slotIndex: number;
  status: OpportunityStatus;
  timezone?: string;
};

export type RollingMomentumSummary = {
  hasUnrecoveredMiss: boolean;
  percentage: number;
  resolvedOpportunityCount: number;
  status: MomentumStatus;
  windowDays: number;
};

export type MomentumSummary = {
  availableOpportunities: number;
  bestStreak: number;
  creditedOpportunities: number;
  completedOpportunities: number;
  currentStreak: number;
  label: string;
  percentage: number;
  periodKey: string;
  rollingMomentum?: RollingMomentumSummary;
  skippedOpportunities: number;
  status: MomentumStatus;
  tapInOpportunities: number;
};

type CommitmentLike = {
  commitmentCadence?: unknown;
  commitmentFrequency?: {
    opportunitiesPerPeriod?: unknown;
    tapInsPerWeek?: unknown;
  };
  timezone?: unknown;
};

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function getLocalDateParts(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(now);

  return {
    day: Number(parts.find(part => part.type === 'day')?.value ?? '1'),
    month: Number(parts.find(part => part.type === 'month')?.value ?? '1'),
    weekday: parts.find(part => part.type === 'weekday')?.value ?? 'Mon',
    year: Number(parts.find(part => part.type === 'year')?.value ?? '1970'),
  };
}

export function getDateKey(timezone: string, now = new Date()) {
  const local = getLocalDateParts(timezone, now);

  return [local.year, padDatePart(local.month), padDatePart(local.day)].join(
    '-',
  );
}

function parseDateKey(dateKey: string) {
  const [year = '1970', month = '01', day = '01'] = dateKey.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    padDatePart(date.getUTCMonth() + 1),
    padDatePart(date.getUTCDate()),
  ].join('-');
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getWeekStartDateKey(timezone: string, now = new Date()) {
  const local = getLocalDateParts(timezone, now);
  const dayOffsetByWeekday: Record<string, number> = {
    Fri: 4,
    Mon: 0,
    Sat: 5,
    Sun: 6,
    Thu: 3,
    Tue: 1,
    Wed: 2,
  };
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  localDate.setUTCDate(
    localDate.getUTCDate() - (dayOffsetByWeekday[local.weekday] ?? 0),
  );

  return formatDateKey(localDate);
}

function getPeriodShape(schedule: CommitmentSchedule, now = new Date()) {
  if (schedule.cadence === 'daily') {
    const dateKey = getDateKey(schedule.timezone, now);
    return {dayCount: 1, periodKey: dateKey, startDateKey: dateKey};
  }

  if (schedule.cadence === 'monthly') {
    const local = getLocalDateParts(schedule.timezone, now);
    const startDateKey = [local.year, padDatePart(local.month), '01'].join('-');

    return {
      dayCount: getDaysInMonth(local.year, local.month),
      periodKey: `${local.year}-${padDatePart(local.month)}`,
      startDateKey,
    };
  }

  const startDateKey = getWeekStartDateKey(schedule.timezone, now);

  return {
    dayCount: 7,
    periodKey: startDateKey,
    startDateKey,
  };
}

function getSlotOffsets(dayCount: number, opportunitiesPerPeriod: number) {
  const count = Math.min(
    dayCount,
    Math.max(1, Math.round(opportunitiesPerPeriod)),
  );

  return Array.from({length: count}, (_, index) =>
    Math.min(dayCount - 1, Math.floor((index * dayCount) / count)),
  );
}

export function normalizeCommitmentSchedule(
  commitment: CommitmentLike | undefined,
  fallbackTimezone = 'UTC',
): CommitmentSchedule {
  const rawCadence = commitment?.commitmentCadence;
  const cadence: CommitmentCadence =
    rawCadence === 'daily' ||
    rawCadence === 'weekly' ||
    rawCadence === 'monthly'
      ? rawCadence
      : typeof commitment?.commitmentFrequency?.tapInsPerWeek === 'number' &&
        commitment.commitmentFrequency.tapInsPerWeek >= 7
      ? 'daily'
      : 'weekly';
  const timezone =
    typeof commitment?.timezone === 'string' && commitment.timezone.trim()
      ? commitment.timezone.trim()
      : fallbackTimezone;
  const fallbackCount =
    cadence === 'daily'
      ? 1
      : cadence === 'monthly'
      ? 4
      : typeof commitment?.commitmentFrequency?.tapInsPerWeek === 'number'
      ? commitment.commitmentFrequency.tapInsPerWeek
      : 7;
  const opportunitiesPerPeriod =
    cadence === 'daily'
      ? 1
      : clampOpportunitiesPerPeriod(
          commitment?.commitmentFrequency?.opportunitiesPerPeriod ??
            commitment?.commitmentFrequency?.tapInsPerWeek,
          fallbackCount,
        );

  return {
    cadence,
    opportunitiesPerPeriod,
    slotPolicy: 'scheduled_slots',
    timezone,
  };
}

export function getOpportunitySlots(
  schedule: CommitmentSchedule,
  now = new Date(),
): OpportunitySlot[] {
  const period = getPeriodShape(schedule, now);
  const offsets = getSlotOffsets(
    period.dayCount,
    schedule.opportunitiesPerPeriod,
  );

  return offsets.map((offset, index) => {
    const availableDateKey = addDays(period.startDateKey, offset);
    const nextOffset = offsets[index + 1];
    const expiresOffset =
      typeof nextOffset === 'number' ? nextOffset - 1 : period.dayCount - 1;

    return {
      availableDateKey,
      expiresDateKey: addDays(period.startDateKey, expiresOffset),
      periodKey: period.periodKey,
      slotIndex: index,
    };
  });
}

export function getOpportunityStatusForSlot({
  completionStatus,
  now = new Date(),
  slot,
  timezone,
}: {
  completionStatus?: OpportunityStatus;
  now?: Date;
  slot: OpportunitySlot;
  timezone: string;
}): OpportunityStatus {
  if (completionStatus === 'completed' || completionStatus === 'skipped') {
    return completionStatus;
  }

  const todayDateKey = getDateKey(timezone, now);

  if (slot.availableDateKey > todayDateKey) {
    return 'upcoming';
  }

  if (slot.expiresDateKey < todayDateKey) {
    return 'missed';
  }

  return 'available';
}

export function isExpiredExpectedOpenOpportunity({
  now = new Date(),
  opportunity,
}: {
  now?: Date;
  opportunity: {
    expectedForCircle?: boolean;
    expiresDateKey?: string;
    status?: unknown;
    timezone?: string;
  };
}) {
  const isOpen =
    opportunity.status === 'available' || opportunity.status === 'upcoming';
  const expiresDateKey = opportunity.expiresDateKey;

  if (!isOpen || opportunity.expectedForCircle === false || !expiresDateKey) {
    return false;
  }

  return expiresDateKey < getDateKey(opportunity.timezone ?? 'UTC', now);
}

export function getMomentumStatus(percentage: number): MomentumStatus {
  if (percentage <= 0) {
    return 'getting_started';
  }

  if (percentage <= 30) {
    return 'building_momentum';
  }

  if (percentage <= 70) {
    return 'strong_momentum';
  }

  return 'peak_momentum';
}

export function getRollingMomentumStatus({
  percentage,
  resolvedOpportunityCount,
}: {
  percentage: number;
  resolvedOpportunityCount: number;
}): MomentumStatus {
  if (resolvedOpportunityCount < 3) {
    return 'getting_started';
  }

  if (percentage <= 30) {
    return 'building_momentum';
  }

  if (percentage <= 70) {
    return 'strong_momentum';
  }

  return 'peak_momentum';
}

export function getMomentumLabel(status: MomentumStatus) {
  if (status === 'peak_momentum') {
    return 'Peak';
  }

  if (status === 'strong_momentum') {
    return 'Strong';
  }

  if (status === 'building_momentum') {
    return 'Building';
  }

  return 'Getting Started';
}

export function calculateMomentumSummary({
  opportunities,
  periodKey,
  priorBestStreak = 0,
}: {
  opportunities: MomentumOpportunity[];
  periodKey: string;
  priorBestStreak?: number;
}): MomentumSummary {
  const eligibleOpportunities = opportunities.filter(
    isEligibleMomentumOpportunity,
  );
  const availableOpportunities = eligibleOpportunities.filter(
    opportunity => opportunity.status !== 'upcoming',
  ).length;
  const tapInOpportunities = eligibleOpportunities.filter(
    opportunity => opportunity.status === 'completed',
  ).length;
  const skippedOpportunities = eligibleOpportunities.filter(
    opportunity => opportunity.status === 'skipped',
  ).length;
  const creditedOpportunities = tapInOpportunities + skippedOpportunities;
  const percentage =
    availableOpportunities > 0
      ? Math.round((creditedOpportunities / availableOpportunities) * 100)
      : 0;
  const {bestStreak, currentStreak} = calculateMomentumStreaks({
    opportunities: eligibleOpportunities,
    priorBestStreak,
  });
  const status = getMomentumStatus(percentage);

  return {
    availableOpportunities,
    bestStreak,
    creditedOpportunities,
    completedOpportunities: creditedOpportunities,
    currentStreak,
    label: getMomentumLabel(status),
    percentage,
    periodKey,
    skippedOpportunities,
    status,
    tapInOpportunities,
  };
}

const rollingMomentumWindowDays = 14;
const recentRollingMomentumDays = 7;

function getDateKeyDifference(laterDateKey: string, earlierDateKey: string) {
  return Math.round(
    (parseDateKey(laterDateKey).getTime() -
      parseDateKey(earlierDateKey).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function isResolvedOpportunity(opportunity: MomentumOpportunity) {
  return (
    opportunity.status === 'completed' ||
    opportunity.status === 'skipped' ||
    opportunity.status === 'missed' ||
    opportunity.status === 'expired'
  );
}

function isCoveredOpportunity(opportunity: MomentumOpportunity) {
  return opportunity.status === 'completed' || opportunity.status === 'skipped';
}

function isEligibleMomentumOpportunity(opportunity: MomentumOpportunity) {
  return (
    isCoveredOpportunity(opportunity) || opportunity.expectedForCircle !== false
  );
}

function compareOpportunityResolution(
  left: MomentumOpportunity,
  right: MomentumOpportunity,
) {
  if (
    typeof left.resolvedAtMs === 'number' &&
    typeof right.resolvedAtMs === 'number' &&
    left.resolvedAtMs !== right.resolvedAtMs
  ) {
    return left.resolvedAtMs - right.resolvedAtMs;
  }

  const dateDelta = (
    left.resolvedDateKey ??
    left.expiresDateKey ??
    left.availableDateKey
  ).localeCompare(
    right.resolvedDateKey ?? right.expiresDateKey ?? right.availableDateKey,
  );

  return dateDelta !== 0 ? dateDelta : left.slotIndex - right.slotIndex;
}

export function calculateRollingMomentumSummary({
  now = new Date(),
  opportunities,
}: {
  now?: Date;
  opportunities: MomentumOpportunity[];
}): RollingMomentumSummary {
  const resolvedOpportunities = opportunities.filter(opportunity => {
    if (!isResolvedOpportunity(opportunity)) {
      return false;
    }

    if (
      !isCoveredOpportunity(opportunity) &&
      opportunity.expectedForCircle === false
    ) {
      return false;
    }

    const timezone = opportunity.timezone ?? 'UTC';
    const todayDateKey = getDateKey(timezone, now);
    const resolutionDateKey =
      opportunity.resolvedDateKey ??
      opportunity.expiresDateKey ??
      opportunity.availableDateKey;
    const daysAgo = getDateKeyDifference(todayDateKey, resolutionDateKey);

    return daysAgo >= 0 && daysAgo < rollingMomentumWindowDays;
  });

  if (resolvedOpportunities.length === 0) {
    return {
      hasUnrecoveredMiss: false,
      percentage: 0,
      resolvedOpportunityCount: 0,
      status: 'getting_started',
      windowDays: rollingMomentumWindowDays,
    };
  }

  const weightedTotals = resolvedOpportunities.reduce(
    (totals, opportunity) => {
      const timezone = opportunity.timezone ?? 'UTC';
      const todayDateKey = getDateKey(timezone, now);
      const resolutionDateKey =
        opportunity.resolvedDateKey ??
        opportunity.expiresDateKey ??
        opportunity.availableDateKey;
      const daysAgo = getDateKeyDifference(todayDateKey, resolutionDateKey);
      const weight = daysAgo < recentRollingMomentumDays ? 2 : 1;

      totals.available += weight;
      if (isCoveredOpportunity(opportunity)) {
        totals.covered += weight;
      }

      return totals;
    },
    {available: 0, covered: 0},
  );
  const percentage =
    weightedTotals.available > 0
      ? Math.round((weightedTotals.covered / weightedTotals.available) * 100)
      : 0;
  const latestResolution = [...resolvedOpportunities].sort(
    compareOpportunityResolution,
  )[resolvedOpportunities.length - 1];
  const hasUnrecoveredMiss =
    latestResolution?.status === 'missed' ||
    latestResolution?.status === 'expired';

  return {
    hasUnrecoveredMiss,
    percentage,
    resolvedOpportunityCount: resolvedOpportunities.length,
    status: getRollingMomentumStatus({
      percentage,
      resolvedOpportunityCount: resolvedOpportunities.length,
    }),
    windowDays: rollingMomentumWindowDays,
  };
}

export function calculateMomentumStreaks({
  opportunities,
  priorBestStreak = 0,
}: {
  opportunities: MomentumOpportunity[];
  priorBestStreak?: number;
}) {
  let currentStreak = 0;
  let bestStreak = priorBestStreak;

  [...opportunities]
    .filter(
      opportunity =>
        isEligibleMomentumOpportunity(opportunity) &&
        opportunity.status !== 'upcoming',
    )
    .sort((left, right) => {
      const dateDelta = left.availableDateKey.localeCompare(
        right.availableDateKey,
      );

      return dateDelta !== 0 ? dateDelta : left.slotIndex - right.slotIndex;
    })
    .forEach(opportunity => {
      if (
        opportunity.status === 'completed' ||
        opportunity.status === 'skipped'
      ) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        return;
      }

      if (opportunity.status === 'missed' || opportunity.status === 'expired') {
        currentStreak = 0;
      }
    });

  return {bestStreak, currentStreak};
}
