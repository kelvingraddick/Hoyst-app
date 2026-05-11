import {FieldValue, type DocumentData} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';

const graceRuleSchema = z.object({
  allowance: z.number().int().min(0).max(30),
  windowDays: z.number().int().min(1).max(365),
});
const createCircleSchema = z.object({
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
  timezone: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(80),
});
const joinCircleSchema = z.object({
  circleId: z.string().trim().min(1),
  inviteCode: z.string().trim().optional(),
});

async function requireCompletedProfile(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const snapshot = await db.collection('users').doc(uid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid};
}

function createInviteCode() {
  return Math.random().toString(36).slice(2, 10);
}

function buildMemberPublicPreview(profile: DocumentData, uid: string) {
  return {
    avatarUrl: profile.avatarUrl ?? null,
    displayName: profile.displayName,
    handle: profile.handle,
    uid,
  };
}

export const createCircle = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = createCircleSchema.parse(request.data);
  const circleRef = db.collection('circles').doc();
  const memberRef = circleRef.collection('members').doc(uid);
  const publicIndexRef = db.collection('publicCircleIndex').doc(circleRef.id);
  const now = FieldValue.serverTimestamp();
  const inviteCode = createInviteCode();
  const circle = {
    category: input.category,
    createdAt: now,
    dailyTask: input.dailyTask,
    graceRules: input.graceRules ?? {
      skip: {
        allowance: 1,
        windowDays: 7,
      },
    },
    inviteCode,
    joinMode: input.joinMode,
    maxSize: input.maxSize,
    memberCount: 1,
    ownerId: uid,
    privacy: input.privacy,
    title: input.title,
    timezone: input.timezone ?? profile.timezone ?? 'UTC',
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(circleRef, circle);
  batch.set(memberRef, {
    avatarUrl: profile.avatarUrl ?? null,
    displayName: profile.displayName,
    handle: profile.handle,
    joinedAt: now,
    role: 'owner',
    status: 'active',
    uid,
  });

  if (input.privacy === 'public') {
    batch.set(publicIndexRef, {
      category: input.category,
      dailyTask: input.dailyTask,
      joinMode: input.joinMode,
      maxSize: input.maxSize,
      memberCount: 1,
      members: [buildMemberPublicPreview(profile, uid)],
      title: input.title,
      updatedAt: now,
    });
  }

  await batch.commit();

  return {circleId: circleRef.id, inviteCode};
});

export const joinCircle = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = joinCircleSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
  const publicIndexRef = db.collection('publicCircleIndex').doc(input.circleId);
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    const circle = circleSnapshot.data();

    if (memberSnapshot.data()?.status === 'active') {
      return {status: 'active' as const};
    }

    if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0)) {
      throw new HttpsError('resource-exhausted', 'This circle is full.');
    }

    if (
      circle?.privacy === 'private' &&
      input.inviteCode !== circle.inviteCode
    ) {
      throw new HttpsError('permission-denied', 'A valid invite is required.');
    }

    if (circle?.joinMode === 'request_to_join') {
      transaction.set(
        joinRequestRef,
        {
          avatarUrl: profile.avatarUrl ?? null,
          createdAt: now,
          displayName: profile.displayName,
          handle: profile.handle,
          status: 'pending',
          uid,
        },
        {merge: true},
      );
      transaction.set(
        memberRef,
        {
          avatarUrl: profile.avatarUrl ?? null,
          displayName: profile.displayName,
          handle: profile.handle,
          requestedAt: now,
          role: 'member',
          status: 'pending',
          uid,
        },
        {merge: true},
      );
      return {status: 'pending' as const};
    }

    transaction.set(memberRef, {
      avatarUrl: profile.avatarUrl ?? null,
      displayName: profile.displayName,
      handle: profile.handle,
      joinedAt: now,
      role: 'member',
      status: 'active',
      uid,
    });
    transaction.update(circleRef, {memberCount: FieldValue.increment(1)});
    if (circle?.privacy === 'public') {
      transaction.set(
        publicIndexRef,
        {
          memberCount: FieldValue.increment(1),
          members: FieldValue.arrayUnion(buildMemberPublicPreview(profile, uid)),
          updatedAt: now,
        },
        {merge: true},
      );
    }

    return {status: 'active' as const};
  });
});
