import type {MomentumStatus} from '../../../types/models';
import type {HomeGreetingTimeWindow} from './home-data-service';

export type HomeHeroCopy = {
  headline: string;
  subline: string;
};

type HomeHeroHeadline = {
  text: string;
  withName?: (firstName: string) => string;
};

const headlinePools: Record<
  HomeGreetingTimeWindow,
  readonly HomeHeroHeadline[]
> = {
  morning: [
    {
      text: 'Set the tone.',
      withName: firstName => `Set the tone, ${firstName}.`,
    },
    {text: 'Start the day by showing up.'},
    {text: 'Your circles are counting on you.'},
  ],
  midday: [
    {
      text: 'Keep it moving.',
      withName: firstName => `Keep it moving, ${firstName}.`,
    },
    {text: 'Keep your word to your circles.'},
    {text: 'Showing up is the whole game.'},
  ],
  afternoon: [
    {
      text: 'Make the next move count.',
      withName: firstName => `Make the next move count, ${firstName}.`,
    },
    {text: 'Still time to show up today.'},
    {text: 'Consistency beats intensity.'},
  ],
  evening: [
    {
      text: 'One last push.',
      withName: firstName => `One last push, ${firstName}.`,
    },
    {text: 'Close the day the strong way.'},
    {text: 'End today the way you started.'},
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
  firstName,
  momentumStatus,
  streakDays,
  timeWindow,
}: {
  dateKey: string;
  firstName?: string;
  momentumStatus: MomentumStatus;
  streakDays: number;
  timeWindow: HomeGreetingTimeWindow;
}): HomeHeroCopy {
  const pool = headlinePools[timeWindow] ?? headlinePools.morning;
  const headlineOption = pool[hashDateKey(dateKey) % pool.length];
  const cleanFirstName = firstName?.trim();
  const headline =
    cleanFirstName && headlineOption.withName
      ? headlineOption.withName(cleanFirstName)
      : headlineOption.text;

  return {
    headline,
    subline: getStateSubline({momentumStatus, streakDays}),
  };
}
