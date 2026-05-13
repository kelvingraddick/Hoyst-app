import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';

import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import {collections} from '../../../types/firestore';
import type {UserProfile} from '../../../types/models';
import type {CreateCircleInput} from '../../circles/services/circle-service';
import type {OnboardingPreferences} from './onboarding-options';

export type StarterCircleProfileInput = CreateCircleInput & {
  setupId: string;
};

export type CompleteProfileInput = {
  avatarUrl?: string;
  displayName: string;
  handle: string;
  onboardingPreferences?: OnboardingPreferences;
  starterCircle?: StarterCircleProfileInput;
  timezone: string;
};

export type CompleteProfileResult = {
  handle: string;
  starterCircle?: {
    circleId: string;
    inviteCode?: string;
  };
  uid: string;
};

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function mapUserProfileSnapshot(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
): UserProfile | undefined {
  const data = snapshot.data();

  if (!snapshot.exists || !data?.handle || !data?.displayName) {
    return undefined;
  }

  return {
    avatarUrl: asOptionalString(data.avatarUrl),
    bio: asOptionalString(data.bio),
    handle: data.handle,
    id: snapshot.id,
    name: data.displayName,
    onboardingStatus: data.onboardingStatus,
    timezone: data.timezone ?? 'UTC',
  };
}

export function subscribeToUserProfile(
  uid: string,
  onProfile: (profile?: UserProfile) => void,
  onError: (error: Error) => void,
) {
  return firebaseFirestore()
    .collection(collections.users)
    .doc(uid)
    .onSnapshot(
      snapshot => onProfile(mapUserProfileSnapshot(snapshot)),
      error => onError(error),
    );
}

export async function completeProfile(input: CompleteProfileInput) {
  const callable = firebaseFunctions().httpsCallable('completeProfile');
  const result = await callable(input);

  return result.data as CompleteProfileResult;
}

export async function deleteAccount() {
  const callable = firebaseFunctions().httpsCallable('deleteAccount');
  const result = await callable();

  return result.data as {deleted: true};
}

export async function updateProfileFields(input: {
  avatarUrl?: string;
  bio?: string;
  displayName: string;
}) {
  const uid = firebaseAuth().currentUser?.uid;

  if (!uid) {
    throw new Error('Sign in is required.');
  }

  await firebaseFirestore()
    .collection(collections.users)
    .doc(uid)
    .update({
      avatarUrl: input.avatarUrl ?? null,
      bio: input.bio ?? null,
      displayName: input.displayName,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
}

export async function updateProfileAvatarUrlFromAuth(avatarUrl: string) {
  const uid = firebaseAuth().currentUser?.uid;
  const normalizedAvatarUrl = avatarUrl.trim();

  if (!uid || !normalizedAvatarUrl) {
    return;
  }

  await firebaseFirestore()
    .collection(collections.users)
    .doc(uid)
    .update({
      avatarUrl: normalizedAvatarUrl,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
}
