import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';

import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import {collections} from '../../../types/firestore';
import type {UserProfile} from '../../../types/models';
import type {OnboardingPreferences} from './onboarding-options';

export type CompleteProfileInput = {
  avatarUrl?: string;
  displayName: string;
  handle: string;
  onboardingPreferences?: OnboardingPreferences;
  timezone: string;
};

export function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function mapUserProfileSnapshot(
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
): UserProfile | undefined {
  const data = snapshot.data();

  if (!snapshot.exists || !data?.handle || !data?.displayName) {
    return undefined;
  }

  return {
    avatarUrl: data.avatarUrl,
    bio: data.bio,
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
  await callable(input);
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
