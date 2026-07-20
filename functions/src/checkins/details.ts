import {HttpsError} from 'firebase-functions/v2/https';

type TapInDetailsPatchInput = {
  checkInExists: boolean;
  checkInStatus?: unknown;
  memberStatus?: unknown;
  note: string | null;
  photoUrl: string | null;
};

export type TapInDetailsPatch = {
  note: string | null;
  photoUrl: string | null;
};

export function getTapInDetailsPatch({
  checkInExists,
  checkInStatus,
  memberStatus,
  note,
  photoUrl,
}: TapInDetailsPatchInput): TapInDetailsPatch {
  if (memberStatus !== 'active') {
    throw new HttpsError('permission-denied', 'Join this circle first.');
  }

  if (!checkInExists) {
    throw new HttpsError('not-found', "Today's Tap In was not found.");
  }

  if (
    checkInStatus !== 'done' &&
    checkInStatus !== 'partial' &&
    checkInStatus !== 'failed'
  ) {
    throw new HttpsError(
      'failed-precondition',
      'Details can only be added to a Tap In.',
    );
  }

  return {
    note: note && note.length > 0 ? note : null,
    photoUrl,
  };
}
