import {HttpsError} from 'firebase-functions/v2/https';

export type RemoveTapInDecision = {
  checkInCountDelta: -1 | 0;
  removed: boolean;
};

export function getRemoveTapInDecision({
  checkInStatus,
  memberStatus,
}: {
  checkInStatus?: unknown;
  memberStatus?: unknown;
}): RemoveTapInDecision {
  if (memberStatus !== 'active') {
    throw new HttpsError('permission-denied', 'Join this circle first.');
  }

  if (checkInStatus !== 'done' && checkInStatus !== 'skip') {
    return {
      checkInCountDelta: 0,
      removed: false,
    };
  }

  return {
    checkInCountDelta: -1,
    removed: true,
  };
}
