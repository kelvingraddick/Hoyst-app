import type {CircleProgressResult} from './circle-progress';

export type TapInCompletionProgress = {
  xpEarned: number;
  rewards: {skips: number; restores: number};
};

/** Public, owner-readable portion of a server-owned completion record. */
export type TapInCompletion = {
  completionId: string;
  status: 'pending' | 'complete' | 'superseded';
  circleProgress?: CircleProgressResult;
  momentum?: {currentStreak: number; streakDelta: number};
  progress?: TapInCompletionProgress;
};
