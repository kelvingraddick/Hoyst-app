import {HttpsError} from 'firebase-functions/v2/https';

export type RemoveTapInDecision = {
  checkInCountDelta: -1 | 0;
  removed: boolean;
};

export function getRemoveTapInDecision({
  coverageStatus,
  checkInStatus,
  memberStatus,
}: {
  coverageStatus?: unknown;
  checkInStatus?: unknown;
  memberStatus?: unknown;
}): RemoveTapInDecision {
  if (memberStatus !== 'active') {
    throw new HttpsError('permission-denied', 'Join this circle first.');
  }

  if (
    checkInStatus !== 'done' &&
    checkInStatus !== 'skip' &&
    checkInStatus !== 'partial' &&
    checkInStatus !== 'failed'
  ) {
    return {
      checkInCountDelta: 0,
      removed: false,
    };
  }

  if (
    checkInStatus === 'partial' ||
    checkInStatus === 'failed' ||
    (checkInStatus === 'done' &&
      coverageStatus !== undefined &&
      coverageStatus !== 'covered')
  ) {
    return {
      checkInCountDelta: 0,
      removed: true,
    };
  }

  return {
    checkInCountDelta: -1,
    removed: true,
  };
}
