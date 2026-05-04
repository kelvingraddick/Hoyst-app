import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';

const onboardingPreferencesSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  goal: z.string().trim().min(1).max(80).optional(),
  pace: z.string().trim().min(1).max(80).optional(),
  reminderPreference: z.string().trim().min(1).max(80).optional(),
  socialComfort: z.string().trim().min(1).max(80).optional(),
});

const completeProfileSchema = z.object({
  avatarUrl: z.string().url().optional(),
  displayName: z.string().trim().min(1).max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/),
  onboardingPreferences: onboardingPreferencesSchema.optional(),
  timezone: z.string().trim().min(1).max(80),
});
function requireAuthUid(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  return uid;
}

export const completeProfile = onCall(async request => {
  const uid = requireAuthUid(request.auth?.uid);
  const input = completeProfileSchema.parse(request.data);
  const userRecord = request.auth?.token;
  const userRef = db.collection('users').doc(uid);
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const handleRef = db.collection('handles').doc(input.handle);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async transaction => {
    const [userSnapshot, handleSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(handleRef),
    ]);
    const existingUser = userSnapshot.data();
    const existingHandleOwner = handleSnapshot.data()?.uid;

    if (
      existingUser?.onboardingStatus === 'complete' &&
      existingUser.handle !== input.handle
    ) {
      throw new HttpsError('failed-precondition', 'Handles cannot be changed.');
    }

    if (existingHandleOwner && existingHandleOwner !== uid) {
      throw new HttpsError('already-exists', 'That handle is already taken.');
    }

    transaction.set(
      handleRef,
      {
        createdAt: handleSnapshot.exists ? handleSnapshot.data()?.createdAt : now,
        handle: input.handle,
        uid,
      },
      {merge: true},
    );

    transaction.set(
      userRef,
      {
        avatarUrl: input.avatarUrl ?? null,
        displayName: input.displayName,
        handle: input.handle,
        onboardingStatus: 'complete',
        providerIds: request.auth?.token.firebase?.identities
          ? Object.keys(request.auth.token.firebase.identities)
          : [],
        timezone: input.timezone,
        updatedAt: now,
        ...(userSnapshot.exists ? {} : {createdAt: now}),
      },
      {merge: true},
    );

    transaction.set(
      userPrivateRef,
      {
        email: userRecord?.email ?? null,
        lastSignInAt: now,
        notificationSettings: {
          circleActivity: true,
          emailSummaries: true,
          marketing: false,
          tapInReminders: true,
        },
        onboardingStatus: 'complete',
        ...(input.onboardingPreferences
          ? {onboardingPreferences: input.onboardingPreferences}
          : {}),
        phoneNumber: userRecord?.phone_number ?? null,
        updatedAt: now,
      },
      {merge: true},
    );
  });

  return {handle: input.handle, uid};
});
