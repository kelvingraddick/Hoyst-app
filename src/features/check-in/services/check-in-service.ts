import {firebaseFirestore} from '../../../lib/firebase/firestore';
import type {TapInCompletion} from '../../../../functions/src/shared/tap-in-completion';
import type {CircleProgressResult} from '../../../shared/circle-progress';
import {authenticatedCallable} from '../../../lib/firebase/authenticated-callable';
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
  completionId?: string;
  proofRequirement?: import('../../../shared/tap-in-proof').ProofRequirement;
  photoUrl?: string | null;
  circleProgress?: CircleProgressResult;
  progress?: {xpEarned: number; rewards: {skips: number; restores: number}};
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
  return authenticatedCallable<SubmitTapInResult>('submitTapIn', {
    ...input,
    progressVersion: 1,
    completionVersion: 2,
  });
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
    `circles/${circleId}/check-ins/${dateKey}/${uid}/proof-${Date.now().toString(
      36,
    )}-${Math.random().toString(36).slice(2)}.jpg`,
  );

  await reference.putFile(uri, {contentType: 'image/jpeg'});

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

export function subscribeTapInCompletion(
  uid: string,
  completionId: string,
  receive: (completion: TapInCompletion) => void,
  onError: (error: Error) => void,
) {
  return firebaseFirestore()
    .doc(`userPrivate/${uid}/tapInCompletions/${completionId}`)
    .onSnapshot(snapshot => {
      if (snapshot.exists()) {
        receive(snapshot.data() as TapInCompletion);
      }
    }, onError);
}
