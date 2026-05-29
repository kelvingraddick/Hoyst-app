import type {CircleManagementCard, CircleSummary} from '../../types/models';

export type PulseRingState = 'idle' | 'active' | 'atRisk' | 'streak';

type PulseRingCircleInput = Pick<
  CircleSummary,
  | 'state'
  | 'viewerHasCheckedIn'
  | 'viewerHasTappedInToday'
  | 'viewerMembershipStatus'
>;

export function getPulseRingStateForCircle(
  circle?: PulseRingCircleInput,
): PulseRingState {
  if (!circle || circle.viewerMembershipStatus === 'pending') {
    return 'idle';
  }

  if (circle.state === 'risk') {
    return 'atRisk';
  }

  if (!circle.viewerHasCheckedIn && !circle.viewerHasTappedInToday) {
    return 'active';
  }

  return 'idle';
}

export function getPulseRingStateForCircles(
  circles: readonly CircleManagementCard[],
): PulseRingState {
  const circleStates = circles.map(getPulseRingStateForCircle);

  if (circleStates.includes('atRisk')) {
    return 'atRisk';
  }

  if (circleStates.includes('active')) {
    return 'active';
  }

  return 'idle';
}
