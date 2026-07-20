import {firebaseFunctions} from '../../../lib/firebase/functions';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {getFirebaseApp} from '../../../lib/firebase/app';
import {firebaseStorage} from '../../../lib/firebase/storage';
import type {CheckInStatus} from '../../../types/models';

export type SubmitTapInInput = {
  circleId: string;
  currentValue?: number;
  note?: string;
  photoUrl?: string;
  status?: Extract<CheckInStatus, 'done' | 'skip'>;
};

export type SubmitTapInResult = {
  checkInId: string;
  coverageStatus?: 'covered' | 'skipped' | 'partial' | 'failed';
  currentValue?: number;
  dateKey: string;
  momentum?: {
    currentStreak: number;
    streakDelta: number;
  };
  status?: Exclude<CheckInStatus, 'rest'>;
};

export type RemoveTapInInput = {
  circleId: string;
};

export type UpdateTapInDetailsInput = {
  circleId: string;
  note: string | null;
  photoUrl: string | null;
};

export type UpdateTapInDetailsResult = {
  dateKey: string;
  note: string | null;
  photoUrl: string | null;
};

export async function submitTapIn(input: SubmitTapInInput) {
  const callable = firebaseFunctions().httpsCallable('submitTapIn');
  const result = await callable(input);
  return result.data as SubmitTapInResult;
}

export async function uploadTapInPhoto({
  circleId,
  dateKey,
  uid,
  uri,
}: {
  circleId: string;
  dateKey: string;
  uid: string;
  uri: string;
}) {
  const reference = firebaseStorage().ref(
    `circles/${circleId}/check-ins/${dateKey}/${uid}/proof.jpg`,
  );

  await reference.putFile(uri);

  return reference.getDownloadURL();
}

export async function updateTapInDetails(input: UpdateTapInDetailsInput) {
  const callable = firebaseFunctions().httpsCallable('updateTapInDetails');
  const result = await callable(input);
  return result.data as UpdateTapInDetailsResult;
}

export async function removeTapIn(input: RemoveTapInInput) {
  const idToken = await firebaseAuth().currentUser?.getIdToken(true);

  if (!idToken) {
    throw new Error('Sign in is required.');
  }

  const projectId = getFirebaseApp().options.projectId;
  const response = await fetch(
    `https://us-central1-${projectId}.cloudfunctions.net/removeTapIn`,
    {
      body: JSON.stringify({
        data: {
          ...input,
          idToken,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
  const payload = (await response.json()) as {
    error?: {message?: string; status?: string};
    result?: {dateKey: string; removed: boolean};
  };

  if (!response.ok || payload.error || !payload.result) {
    throw new Error(
      payload.error?.message ??
        payload.error?.status ??
        'Could not remove Tap In.',
    );
  }

  return payload.result;
}
