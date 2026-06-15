import type {CircleManagementCard, CircleSummary} from '../../types/models';
import {canTapInToday} from '../../features/home/services/home-circle-actions';

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

  if (canTapInToday(circle)) {
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
