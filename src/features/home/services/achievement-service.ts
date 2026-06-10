export type HomeAchievementTier = 'starter' | 'bronze' | 'gold';

export type HomeAchievementBadge = {
  id: string;
  label: string;
  tier: HomeAchievementTier;
};

/**
 * Placeholder for the upcoming achievement system. Until real achievements
 * land, the badge is derived from the personal streak: 3+ days earns the gold
 * "ND" shield, 1-2 days a bronze shield, and zero days the starter star.
 */
export function getHomeAchievementBadge({
  streakDays,
}: {
  streakDays: number;
}): HomeAchievementBadge {
  if (streakDays >= 3) {
    return {
      id: `streak-${streakDays}-days`,
      label: `${streakDays}D`,
      tier: 'gold',
    };
  }

  if (streakDays >= 1) {
    return {
      id: `streak-${streakDays}-days`,
      label: `${streakDays}D`,
      tier: 'bronze',
    };
  }

  return {id: 'starter', label: '', tier: 'starter'};
}
