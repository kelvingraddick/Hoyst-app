import {HttpsError} from 'firebase-functions/v2/https';

export type CircleMode = 'personal' | 'group';

export function getCircleMode(circle: unknown): CircleMode {
  if (
    circle &&
    typeof circle === 'object' &&
    'circleMode' in circle &&
    circle.circleMode === 'personal'
  ) {
    return 'personal';
  }

  return 'group';
}

export function ensureGroupCircle(circle: unknown, operation: string) {
  if (getCircleMode(circle) === 'personal') {
    throw new HttpsError(
      'failed-precondition',
      `Convert this personal commitment to a Circle before ${operation}.`,
    );
  }
}
