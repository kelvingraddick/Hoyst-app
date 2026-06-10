import type {InboxEventType, MomentumStatus} from '../../../types/models';
import type {HomeGreetingTimeWindow} from './home-data-service';

export type HomeAvatarBadgeKind = 'flame' | 'heart' | 'sparkle';

export type HomeHeroCopy = {
  headline: string;
  subline: string;
};

const heartEventTypes: ReadonlySet<InboxEventType> = new Set([
  'companion_tapped_in',
  'join_approved',
  'join_request',
  'member_joined',
]);

const sparkleEventTypes: ReadonlySet<InboxEventType> = new Set([
  'circle_at_risk',
  'circle_discovery_suggestion',
  'circle_nudge_prompt',
  'member_due_prompt',
  'nudge',
  'tap_in_final_warning',
  'tap_in_midday_reminder',
]);

/**
 * The avatar badge mirrors the most recent inbox event: social activity shows
 * the heart, support/nudge events show the sparkle, and everything else
 * (including no events) falls back to the streak flame.
 */
export function getHomeAvatarBadgeKind(
  latestEventType?: InboxEventType,
): HomeAvatarBadgeKind {
  if (latestEventType && heartEventTypes.has(latestEventType)) {
    return 'heart';
  }

  if (latestEventType && sparkleEventTypes.has(latestEventType)) {
    return 'sparkle';
  }

  return 'flame';
}

const headlinePools: Record<HomeGreetingTimeWindow, readonly string[]> = {
  morning: [
    'Today shows your commitment.',
    'Start the day by showing up.',
    'Your circles are counting on you.',
  ],
  midday: [
    'Today shows your commitment.',
    'Keep your word to your circles.',
    'Showing up is the whole game.',
  ],
  afternoon: [
    'Today shows your commitment.',
    'Still time to show up today.',
    'Consistency beats intensity.',
  ],
  evening: [
    'Today shows your commitment.',
    'Close the day the strong way.',
    'End today the way you started.',
  ],
};

function getStateSubline({
  momentumStatus,
  streakDays,
}: {
  momentumStatus: MomentumStatus;
  streakDays: number;
}) {
  if (streakDays >= 3) {
    return `Let's keep the ${streakDays}-day streak alive.`;
  }

  if (momentumStatus === 'peak_momentum') {
    return "You're at peak momentum. Protect it.";
  }

  if (momentumStatus === 'strong_momentum') {
    return "Let's keep the momentum going.";
  }

  if (momentumStatus === 'building_momentum') {
    return 'Momentum is building. Stay on it.';
  }

  return "Let's get your momentum going.";
}

function hashDateKey(dateKey: string) {
  let hash = 0;

  for (let index = 0; index < dateKey.length; index += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(index)) % 2147483647;
  }

  return hash;
}

/**
 * Deterministic hero copy: the headline rotates daily within its time-of-day
 * pool, and the subline reflects the current streak / momentum state.
 */
export function getHomeHeroCopy({
  dateKey,
  momentumStatus,
  streakDays,
  timeWindow,
}: {
  dateKey: string;
  momentumStatus: MomentumStatus;
  streakDays: number;
  timeWindow: HomeGreetingTimeWindow;
}): HomeHeroCopy {
  const pool = headlinePools[timeWindow] ?? headlinePools.morning;
  const headline = pool[hashDateKey(dateKey) % pool.length];

  return {
    headline,
    subline: getStateSubline({momentumStatus, streakDays}),
  };
}
