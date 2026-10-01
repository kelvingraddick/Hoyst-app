import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';

import {firebaseAuth} from '../../../lib/firebase/auth';
import {firebaseFirestore} from '../../../lib/firebase/firestore';
import {firebaseFunctions} from '../../../lib/firebase/functions';
import {firebaseStorage} from '../../../lib/firebase/storage';
import {normalizeProfileTint} from '../../profile/services/profile-personalization';
import {authenticatedCallable} from '../../../lib/firebase/authenticated-callable';
import {collections} from '../../../types/firestore';
import type {ProfileTint, UserProfile} from '../../../types/models';
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
    profileTint: normalizeProfileTint(data.profileTint),
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

export async function uploadProfileAvatar({
  uid,
  uri,
  versioned = false,
}: {
  uid: string;
  uri: string;
  versioned?: boolean;
}) {
  // A failed profile transaction must not overwrite the currently published photo.
  const fileName = versioned
    ? `profile-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    : 'profile.jpg';
  const reference = firebaseStorage().ref(`users/${uid}/avatar/${fileName}`);

  await reference.putFile(uri);

  return reference.getDownloadURL();
}

export async function deleteAccount() {
  const callable = firebaseFunctions().httpsCallable('deleteAccount');
  const result = await callable();

  return result.data as {deleted: true};
}

export async function checkProfileUsername(handle: string) {
  return authenticatedCallable<{handle: string; available: boolean}>(
    'checkProfileUsername',
    {handle},
  );
}

export async function updateProfileFields(input: {
  avatarUrl?: string | null;
  bio?: string | null;
  displayName?: string;
  handle?: string;
  profileTint?: ProfileTint;
  timezone?: string;
}) {
  const result = await authenticatedCallable<{profile: UserProfile}>(
    'updateProfile',
    input,
  );
  return {
    ...result.profile,
    bio: result.profile.bio || undefined,
    avatarUrl: result.profile.avatarUrl || undefined,
  };
}

export async function updateProfileAvatarUrlFromAuth(avatarUrl: string) {
  const uid = firebaseAuth().currentUser?.uid;
  const normalizedAvatarUrl = avatarUrl.trim();

  if (!uid || !normalizedAvatarUrl) {
    return;
  }

  await firebaseFirestore().collection(collections.users).doc(uid).update({
    avatarUrl: normalizedAvatarUrl,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}
