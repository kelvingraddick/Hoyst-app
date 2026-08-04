import type {CircleLifecycleStatus} from '../../../types/models';

export function getCircleLifecycleStatus(
  circle: unknown,
): CircleLifecycleStatus {
  if (
    circle &&
    typeof circle === 'object' &&
    'lifecycleStatus' in circle &&
    circle.lifecycleStatus === 'archived'
  ) {
    return 'archived';
  }

  return 'active';
}

export function isArchivedCircle(circle: unknown) {
  return getCircleLifecycleStatus(circle) === 'archived';
}
