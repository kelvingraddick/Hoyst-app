export type HoyState =
  | 'locked'
  | 'thinking'
  | 'celebrating'
  | 'risk_attention'
  | 'tap_in_needed'
  | 'momentum_peak'
  | 'momentum_strong'
  | 'momentum_building';

export type HoyStateInput = {
  activeCircleCount: number;
  hasDeadlineRisk: boolean;
  hasUnrecoveredMiss: boolean;
  isAuthenticatedHome: boolean;
  isCelebrating: boolean;
  isGreetingLoading: boolean;
  isIncompleteProfile: boolean;
  isLoadingHomeData: boolean;
  pendingCount: number;
  rollingMomentumStatus:
    | 'getting_started'
    | 'building_momentum'
    | 'strong_momentum'
    | 'peak_momentum';
};

export const hoyStateLabels: Record<HoyState, string> = {
  locked: 'Locked',
  thinking: 'Thinking',
  celebrating: 'Celebrating',
  risk_attention: 'Momentum needs attention',
  tap_in_needed: 'Tap In deadline approaching',
  momentum_peak: 'Peak momentum',
  momentum_strong: 'Strong momentum',
  momentum_building: 'Building momentum',
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

  if (input.hasUnrecoveredMiss) {
    return 'risk_attention';
  }

  if (input.hasDeadlineRisk) {
    return 'tap_in_needed';
  }

  if (input.rollingMomentumStatus === 'peak_momentum') {
    return 'momentum_peak';
  }

  if (input.rollingMomentumStatus === 'strong_momentum') {
    return 'momentum_strong';
  }

  return 'momentum_building';
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
  headline,
  isDisabled,
  state,
}: {
  headline?: string;
  isDisabled: boolean;
  state?: HoyState;
}) {
  if (!state || isDisabled || !headline) {
    return 'Hoy is getting your next action ready.';
  }

  const stateLabel = hoyStateLabels[state];

  return `Hoy, ${stateLabel}. ${headline} Open this action.`;
}

export function getNotificationAccessibilityLabel(unreadCount: number) {
  if (unreadCount <= 0) {
    return 'Notifications, no unread updates';
  }

  const countLabel = unreadCount > 9 ? '9 or more' : String(unreadCount);
  const updateLabel = unreadCount === 1 ? 'update' : 'updates';

  return `Notifications, ${countLabel} unread ${updateLabel}`;
}
