import {HttpsError} from 'firebase-functions/v2/https';

export type CircleLifecycleStatus = 'active' | 'archived';

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

export function ensureActiveCircle(circle: unknown, operation: string) {
  if (getCircleLifecycleStatus(circle) === 'archived') {
    throw new HttpsError(
      'failed-precondition',
      `Restore this commitment before ${operation}.`,
    );
  }
}

export function getCircleResumeAfterDateKey(circle: unknown) {
  if (!circle || typeof circle !== 'object') {
    return undefined;
  }

  const value =
    'opportunitiesResumeAfterDateKey' in circle
      ? circle.opportunitiesResumeAfterDateKey
      : undefined;

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function isCircleSlotAfterResumeBoundary(
  circle: unknown,
  availableDateKey: string,
) {
  const resumeAfterDateKey = getCircleResumeAfterDateKey(circle);

  return !resumeAfterDateKey || availableDateKey > resumeAfterDateKey;
}
