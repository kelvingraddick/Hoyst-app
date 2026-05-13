import {getAuth} from 'firebase-admin/auth';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';
import {resolveStarterCircleDecision} from './starter-circle-plan';

const onboardingPreferencesSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  goal: z.string().trim().min(1).max(80).optional(),
  pace: z.string().trim().min(1).max(80).optional(),
  reminderPreference: z.string().trim().min(1).max(80).optional(),
  socialComfort: z.string().trim().min(1).max(80).optional(),
});
const graceRuleSchema = z.object({
  allowance: z.number().int().min(0).max(30),
  windowDays: z.number().int().min(1).max(365),
});
const starterCircleSchema = z.object({
  category: z.string().trim().min(1).max(40),
  dailyTask: z.string().trim().min(1).max(160),
  graceRules: z
    .object({
      skip: graceRuleSchema,
    })
    .optional(),
  joinMode: z.enum(['open', 'request_to_join', 'invite_only']),
  maxSize: z.number().int().min(2).max(100),
  privacy: z.enum(['public', 'private']),
  setupId: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(80),
});
const starterCircleHiddenDefaults = {
  graceRules: {
    skip: {
      allowance: 2,
      windowDays: 7,
    },
  },
  maxSize: 10,
};

const completeProfileSchema = z.object({
  avatarUrl: z.string().url().optional(),
  displayName: z.string().trim().min(1).max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/),
  onboardingPreferences: onboardingPreferencesSchema.optional(),
  starterCircle: starterCircleSchema.optional(),
  timezone: z.string().trim().min(1).max(80),
});

function requireAuthUid(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  return uid;
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 10);
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isValidStarterCircleMember(member?: DocumentData) {
  return member?.role === 'owner' && member.status === 'active';
}

function getParentDocument(
  ref: DocumentReference<DocumentData>,
  label: string,
) {
  const parent = ref.parent.parent;

  if (!parent) {
    throw new Error(`Could not resolve parent document for ${label}.`);
  }

  return parent;
}

function getCircleRefFromCheckInRef(ref: DocumentReference<DocumentData>) {
  const dayRef = getParentDocument(ref, 'check-in');
  const circleRef = getParentDocument(dayRef, 'check-in day');

  return {circleRef, dayRef};
}

async function deleteStoragePrefix(prefix: string) {
  await getStorage().bucket().deleteFiles({
    force: true,
    prefix,
  });
}

async function deleteCircleServerMetadata(circleId: string) {
  await Promise.all([
    db.collection('publicCircleIndex').doc(circleId).delete(),
    deleteStoragePrefix(`circles/${circleId}/`),
  ]);
}

async function deleteNonOwnedMemberships(uid: string, ownedCircleIds: Set<string>) {
  const memberSnapshots = await db
    .collectionGroup('members')
    .where('uid', '==', uid)
    .get();

  for (const memberSnapshot of memberSnapshots.docs) {
    const circleRef = getParentDocument(memberSnapshot.ref, 'member');

    if (ownedCircleIds.has(circleRef.id)) {
      continue;
    }

    const member = memberSnapshot.data();
    const circleSnapshot = await circleRef.get();
    const publicIndexRef = db.collection('publicCircleIndex').doc(circleRef.id);
    const publicIndexSnapshot = await publicIndexRef.get();
    const publicIndex = publicIndexSnapshot.data();
    const filteredMembers = Array.isArray(publicIndex?.members)
      ? publicIndex.members.filter(
          memberPreview =>
            !(
              typeof memberPreview === 'object' &&
              memberPreview !== null &&
              'uid' in memberPreview &&
              memberPreview.uid === uid
            ),
        )
      : undefined;
    const batch = db.batch();

    batch.delete(memberSnapshot.ref);

    if (circleSnapshot.exists && member.status === 'active') {
      batch.update(circleRef, {
        memberCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (publicIndexSnapshot.exists) {
      batch.set(
        publicIndexRef,
        {
          ...(member.status === 'active'
            ? {memberCount: FieldValue.increment(-1)}
            : {}),
          ...(filteredMembers ? {members: filteredMembers} : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }

    await batch.commit();
  }
}

async function deleteJoinRequests(uid: string, ownedCircleIds: Set<string>) {
  const requestSnapshots = await db
    .collectionGroup('joinRequests')
    .where('uid', '==', uid)
    .get();

  for (const requestSnapshot of requestSnapshots.docs) {
    const circleRef = getParentDocument(requestSnapshot.ref, 'join request');

    if (!ownedCircleIds.has(circleRef.id)) {
      await requestSnapshot.ref.delete();
    }
  }
}

async function deleteNonOwnedCheckIns(uid: string, ownedCircleIds: Set<string>) {
  const checkInSnapshots = await db
    .collectionGroup('checkIns')
    .where('uid', '==', uid)
    .get();

  for (const checkInSnapshot of checkInSnapshots.docs) {
    const {circleRef, dayRef} = getCircleRefFromCheckInRef(checkInSnapshot.ref);

    if (ownedCircleIds.has(circleRef.id)) {
      continue;
    }

    const status = checkInSnapshot.data().status;
    const batch = db.batch();

    batch.delete(checkInSnapshot.ref);

    if (status === 'done' || status === 'skip') {
      batch.set(
        dayRef,
        {
          checkInCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }

    await batch.commit();
    await deleteStoragePrefix(
      `circles/${circleRef.id}/check-ins/${dayRef.id}/${uid}/`,
    );
  }
}

async function deleteOwnedCircles(ownedCircleIds: Set<string>) {
  for (const circleId of ownedCircleIds) {
    const circleRef = db.collection('circles').doc(circleId);

    await deleteCircleServerMetadata(circleId);
    await db.recursiveDelete(circleRef);
  }
}

async function deleteAccountDocuments(uid: string) {
  const userRef = db.collection('users').doc(uid);
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const [userSnapshot, handleSnapshots] = await Promise.all([
    userRef.get(),
    db.collection('handles').where('uid', '==', uid).get(),
  ]);
  const handle = userSnapshot.data()?.handle;
  const handleRefs = new Map<string, DocumentReference<DocumentData>>();
  const batch = db.batch();

  batch.delete(userRef);
  batch.delete(userPrivateRef);

  if (typeof handle === 'string' && handle.trim()) {
    const handleRef = db.collection('handles').doc(handle);
    handleRefs.set(handleRef.path, handleRef);
  }

  handleSnapshots.docs.forEach(handleSnapshot => {
    handleRefs.set(handleSnapshot.ref.path, handleSnapshot.ref);
  });

  handleRefs.forEach(handleRef => {
    batch.delete(handleRef);
  });

  await Promise.all([batch.commit(), deleteStoragePrefix(`users/${uid}/avatar/`)]);
}

async function deleteAuthUser(uid: string) {
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if ((error as {code?: string}).code !== 'auth/user-not-found') {
      throw error;
    }
  }
}

export const completeProfile = onCall(async request => {
  const uid = requireAuthUid(request.auth?.uid);
  const input = completeProfileSchema.parse(request.data);
  const userRecord = request.auth?.token;
  const userRef = db.collection('users').doc(uid);
  const userPrivateRef = db.collection('userPrivate').doc(uid);
  const handleRef = db.collection('handles').doc(input.handle);
  const now = FieldValue.serverTimestamp();
  const authAvatarUrl =
    typeof userRecord?.picture === 'string' ? userRecord.picture : undefined;
  let starterCircle:
    | {
        circleId: string;
        inviteCode?: string;
      }
    | undefined;

  await db.runTransaction(async transaction => {
    const [userSnapshot, handleSnapshot, userPrivateSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(handleRef),
      transaction.get(userPrivateRef),
    ]);
    const existingUser = userSnapshot.data();
    const existingHandleOwner = handleSnapshot.data()?.uid;
    const userPrivate = userPrivateSnapshot.data();
    const existingStarterCircleId = asOptionalString(
      userPrivate?.onboardingStarterCircleId,
    );
    const existingStarterCircleSetupId = asOptionalString(
      userPrivate?.onboardingStarterCircleSetupId,
    );
    const profileData = {
      avatarUrl: input.avatarUrl ?? authAvatarUrl ?? null,
      displayName: input.displayName,
      handle: input.handle,
      onboardingStatus: 'complete',
      providerIds: request.auth?.token.firebase?.identities
        ? Object.keys(request.auth.token.firebase.identities)
        : [],
      timezone: input.timezone,
      updatedAt: now,
      ...(userSnapshot.exists ? {} : {createdAt: now}),
    };

    if (
      existingUser?.onboardingStatus === 'complete' &&
      existingUser.handle !== input.handle
    ) {
      throw new HttpsError('failed-precondition', 'Handles cannot be changed.');
    }

    if (existingHandleOwner && existingHandleOwner !== uid) {
      throw new HttpsError('already-exists', 'That handle is already taken.');
    }

    let existingStarterCircleIsValid = false;

    if (
      input.starterCircle &&
      existingStarterCircleId &&
      existingStarterCircleSetupId === input.starterCircle.setupId
    ) {
      const existingCircleRef = db
        .collection('circles')
        .doc(existingStarterCircleId);
      const existingMemberRef = existingCircleRef.collection('members').doc(uid);
      const [existingCircleSnapshot, existingMemberSnapshot] =
        await Promise.all([
          transaction.get(existingCircleRef),
          transaction.get(existingMemberRef),
        ]);
      const existingCircle = existingCircleSnapshot.data();

      existingStarterCircleIsValid =
        existingCircleSnapshot.exists &&
        existingCircle?.ownerId === uid &&
        isValidStarterCircleMember(existingMemberSnapshot.data());
    }

    const starterCircleDecision = resolveStarterCircleDecision({
      existingCircleId: existingStarterCircleId,
      existingCircleIsValid: existingStarterCircleIsValid,
      existingSetupId: existingStarterCircleSetupId,
      hasStarterCirclePayload: Boolean(input.starterCircle),
      setupId: input.starterCircle?.setupId,
    });

    transaction.set(
      handleRef,
      {
        createdAt: handleSnapshot.exists ? handleSnapshot.data()?.createdAt : now,
        handle: input.handle,
        uid,
      },
      {merge: true},
    );

    transaction.set(userRef, profileData, {merge: true});

    if (
      input.starterCircle &&
      (starterCircleDecision === 'create' || starterCircleDecision === 'repair')
    ) {
      const circleRef = db.collection('circles').doc();
      const memberRef = circleRef.collection('members').doc(uid);
      const publicIndexRef = db.collection('publicCircleIndex').doc(circleRef.id);
      const inviteCode = createInviteCode();
      const circle = {
        category: input.starterCircle.category,
        createdAt: now,
        dailyTask: input.starterCircle.dailyTask,
        graceRules: starterCircleHiddenDefaults.graceRules,
        inviteCode,
        joinMode: input.starterCircle.joinMode,
        maxSize: starterCircleHiddenDefaults.maxSize,
        memberCount: 1,
        ownerId: uid,
        privacy: input.starterCircle.privacy,
        title: input.starterCircle.title,
        timezone: input.starterCircle.timezone ?? input.timezone,
        updatedAt: now,
      };

      transaction.set(circleRef, circle);
      transaction.set(memberRef, {
        avatarUrl: profileData.avatarUrl,
        displayName: profileData.displayName,
        handle: profileData.handle,
        joinedAt: now,
        role: 'owner',
        status: 'active',
        uid,
      });

      if (input.starterCircle.privacy === 'public') {
        transaction.set(publicIndexRef, {
          category: input.starterCircle.category,
          dailyTask: input.starterCircle.dailyTask,
          joinMode: input.starterCircle.joinMode,
          maxSize: starterCircleHiddenDefaults.maxSize,
          memberCount: 1,
          members: [
            {
              avatarUrl: profileData.avatarUrl,
              displayName: profileData.displayName,
              handle: profileData.handle,
              uid,
            },
          ],
          title: input.starterCircle.title,
          updatedAt: now,
        });
      }

      starterCircle = {circleId: circleRef.id, inviteCode};
    } else if (starterCircleDecision === 'reuse' && existingStarterCircleId) {
      starterCircle = {
        circleId: existingStarterCircleId,
        inviteCode: asOptionalString(
          userPrivate?.onboardingStarterCircleInviteCode,
        ),
      };
    }

    console.info('onboarding_starter_circle', {
      circleId: starterCircle?.circleId ?? null,
      decision: starterCircleDecision,
      setupId: input.starterCircle?.setupId ?? null,
      uid,
    });

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
        ...(starterCircle
          ? {
              onboardingStarterCircleId: starterCircle.circleId,
              ...(starterCircle.inviteCode
                ? {onboardingStarterCircleInviteCode: starterCircle.inviteCode}
                : {}),
              ...(input.starterCircle?.setupId
                ? {onboardingStarterCircleSetupId: input.starterCircle.setupId}
                : {}),
            }
          : {}),
        phoneNumber: userRecord?.phone_number ?? null,
        updatedAt: now,
      },
      {merge: true},
    );
  });

  return {handle: input.handle, starterCircle, uid};
});

export const deleteAccount = onCall(async request => {
  const uid = requireAuthUid(request.auth?.uid);
  const ownedCircleSnapshots = await db
    .collection('circles')
    .where('ownerId', '==', uid)
    .get();
  const ownedCircleIds = new Set(
    ownedCircleSnapshots.docs.map(snapshot => snapshot.id),
  );

  await deleteNonOwnedMemberships(uid, ownedCircleIds);
  await deleteJoinRequests(uid, ownedCircleIds);
  await deleteNonOwnedCheckIns(uid, ownedCircleIds);
  await deleteOwnedCircles(ownedCircleIds);
  await deleteAccountDocuments(uid);
  await deleteAuthUser(uid);

  return {deleted: true as const};
});
