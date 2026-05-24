import {getFirebaseApp} from '../../../lib/firebase/app';
import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import type {
  CircleJoinMode,
  CirclePrivacy,
  CommitmentCadence,
  CommitmentFrequency,
  GraceRule,
} from '../../../types/models';

export type CreateCircleInput = {
  category: string;
  commitment: string;
  commitmentCadence: CommitmentCadence;
  commitmentFrequency: CommitmentFrequency;
  graceRules: {
    skip: GraceRule;
  };
  joinMode: CircleJoinMode;
  maxSize: number;
  privacy: CirclePrivacy;
  title: string;
  timezone?: string;
};
export type UpdateCircleInput = CreateCircleInput & {
  circleId: string;
};

export async function createCircle(input: CreateCircleInput) {
  const callable = firebaseFunctions().httpsCallable('createCircle');
  const result = await callable(input);
  return result.data as {circleId: string; inviteCode?: string};
}

export async function updateCircle(input: UpdateCircleInput) {
  const idToken = await firebaseAuth().currentUser?.getIdToken(true);

  if (!idToken) {
    throw new Error('Sign in is required.');
  }

  const projectId = getFirebaseApp().options.projectId;
  const response = await fetch(
    `https://us-central1-${projectId}.cloudfunctions.net/updateCircle`,
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
    result?: {updated: true};
  };

  if (!response.ok || payload.error || !payload.result) {
    throw new Error(
      payload.error?.message ??
        payload.error?.status ??
        'Could not save circle changes.',
    );
  }

  return payload.result;
}

export async function joinCircle(circleId: string, inviteCode?: string) {
  const callable = firebaseFunctions().httpsCallable('joinCircle');
  const result = await callable({circleId, inviteCode});
  return result.data as {status: 'active' | 'pending'};
}

export async function reviewJoinRequest({
  approved,
  circleId,
  requesterId,
}: {
  approved: boolean;
  circleId: string;
  requesterId: string;
}) {
  const callable = firebaseFunctions().httpsCallable('reviewJoinRequest');
  const result = await callable({approved, circleId, requesterId});
  return result.data as {status: 'approved' | 'declined'};
}

export async function nudgeCircleMembers(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('nudgeCircleMembers');
  const result = await callable({circleId});
  return result.data as {nudged: number};
}

export async function leaveCircle(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('leaveCircle');
  const result = await callable({circleId});
  return result.data as {status: 'left' | 'cancelled'};
}

export async function deleteCircle(circleId: string) {
  const callable = firebaseFunctions().httpsCallable('deleteCircle');
  const result = await callable({circleId});
  return result.data as {deleted: true};
}
