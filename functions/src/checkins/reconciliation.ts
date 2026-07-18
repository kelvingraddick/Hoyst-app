export function getNextCoverageRevision({
  existingCovered,
  existingRevision,
  ledgerRevision,
  nextCovered,
}: {
  existingCovered: boolean;
  existingRevision?: unknown;
  ledgerRevision?: unknown;
  nextCovered: boolean;
}) {
  const priorRevision = Math.max(
    typeof existingRevision === 'number' && Number.isFinite(existingRevision)
      ? Math.max(0, Math.round(existingRevision))
      : 0,
    typeof ledgerRevision === 'number' && Number.isFinite(ledgerRevision)
      ? Math.max(0, Math.round(ledgerRevision))
      : 0,
  );

  return nextCovered && !existingCovered ? priorRevision + 1 : priorRevision;
}

export function getCreditedOutcomeStatus(
  checkIn: {coverageStatus?: unknown; status?: unknown} | undefined,
) {
  if (checkIn?.status === 'skip' || checkIn?.coverageStatus === 'skipped') {
    return 'skip' as const;
  }

  if (checkIn?.status === 'done' || checkIn?.coverageStatus === 'covered') {
    return 'done' as const;
  }

  return undefined;
}

export function isCoveredOutcomeChange({
  existingCheckIn,
  nextStatus,
}: {
  existingCheckIn: {coverageStatus?: unknown; status?: unknown} | undefined;
  nextStatus: 'done' | 'skip';
}) {
  const existingStatus = getCreditedOutcomeStatus(existingCheckIn);

  return Boolean(existingStatus && existingStatus !== nextStatus);
}

const achievementThresholds = [
  {key: '7-days-straight', threshold: 7},
  {key: '10-day-streak', threshold: 10},
  {key: '20-day-streak', threshold: 20},
  {key: '30-day-streak', threshold: 30},
  {key: '50-taps', threshold: 50},
];
const momentumStatusRanks = [
  'getting_started',
  'building_momentum',
  'strong_momentum',
  'peak_momentum',
];

export function shouldRetainCorrectedMetricEffect({
  bestStreak,
  currentStreak,
  effectId,
  momentumStatus,
  type,
}: {
  bestStreak: number;
  currentStreak: number;
  effectId: string;
  momentumStatus?: string;
  type?: string;
}) {
  if (type === 'companion_achievement_unlocked') {
    const achievement = achievementThresholds.find(candidate =>
      effectId.includes(candidate.key),
    );
    return Boolean(achievement && bestStreak >= achievement.threshold);
  }

  if (type === 'companion_streak_milestone' || type === 'streak_milestone') {
    const threshold = Number(effectId.match(/(\d+)-day-streak/)?.[1]);
    return Number.isFinite(threshold) && currentStreak >= threshold;
  }

  if (type === 'companion_momentum_level_up') {
    const targetRank = momentumStatusRanks.findIndex(status =>
      effectId.includes(status),
    );
    const currentRank = momentumStatusRanks.indexOf(momentumStatus ?? '');
    return targetRank >= 0 && currentRank >= targetRank;
  }

  return false;
}
