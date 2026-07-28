export type HoyState =
  | 'locked'
  | 'thinking'
  | 'celebrating'
  | 'risk_attention'
  | 'tap_in_needed'
  | 'goal_completed'
  | 'streak_active'
  | 'default';

export type HoyStateInput = {
  activeCircleCount: number;
  atRiskCount: number;
  doneCount: number;
  isAuthenticatedHome: boolean;
  isCelebrating: boolean;
  isGreetingLoading: boolean;
  isIncompleteProfile: boolean;
  isLoadingHomeData: boolean;
  needsYouCount: number;
  pendingCount: number;
  personalStreakDays: number;
};

export const hoyStateLabels: Record<HoyState, string> = {
  locked: 'Locked',
  thinking: 'Thinking',
  celebrating: 'Celebrating',
  risk_attention: 'Risk and attention',
  tap_in_needed: 'Tap In needed',
  goal_completed: 'Goal completed',
  streak_active: 'Streak active',
  default: 'Ready',
};

/**
 * Resolve Hoy's visual state from live Home data. The branch order is the
 * product-defined priority order and should remain deterministic.
 */
export function getHoyState(input: HoyStateInput): HoyState {
  const onlyPendingMemberships =
    input.activeCircleCount === 0 && input.pendingCount > 0;

  if (
    !input.isAuthenticatedHome ||
    input.isIncompleteProfile ||
    onlyPendingMemberships
  ) {
    return 'locked';
  }

  if (input.isLoadingHomeData || input.isGreetingLoading) {
    return 'thinking';
  }

  if (input.isCelebrating) {
    return 'celebrating';
  }

  if (input.atRiskCount > 0) {
    return 'risk_attention';
  }

  if (input.needsYouCount > 0) {
    return 'tap_in_needed';
  }

  if (
    input.activeCircleCount > 0 &&
    input.doneCount === input.activeCircleCount
  ) {
    return 'goal_completed';
  }

  if (input.personalStreakDays > 0) {
    return 'streak_active';
  }

  return 'default';
}

export function getStableHoyDisplayState({
  candidateState,
  isSessionResolving,
  previousResolvedState,
}: {
  candidateState: HoyState;
  isSessionResolving: boolean;
  previousResolvedState?: HoyState;
}): HoyState | undefined {
  if (isSessionResolving || candidateState === 'thinking') {
    return previousResolvedState;
  }

  return candidateState;
}

export function getHoyAccessibilityLabel({
  state,
  unreadCount,
}: {
  state?: HoyState;
  unreadCount: number;
}) {
  if (!state) {
    return 'Hoy is getting ready. Open Inbox.';
  }

  const stateLabel = hoyStateLabels[state];

  if (unreadCount <= 0) {
    return `Hoy, ${stateLabel}. Open Inbox`;
  }

  const countLabel = unreadCount > 9 ? '9 or more' : String(unreadCount);
  const updateLabel = unreadCount === 1 ? 'update' : 'updates';

  return `Hoy, ${stateLabel}. Open Inbox, ${countLabel} unread ${updateLabel}`;
}
