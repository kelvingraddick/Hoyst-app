import {FieldValue, type DocumentData} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from './firebase';
import {ensureActiveCircle} from './shared/circle-lifecycle';
import {ensureGroupCircle} from './shared/circle-mode';

type ThreadActor = {
  avatarUrl?: string | null;
  displayName?: string | null;
  handle?: string | null;
  uid?: string | null;
};

type CreateCircleThreadActivityInput = {
  actor: ThreadActor;
  circleId: string;
  createdAt?: unknown;
  itemId?: string;
  mediaImageUrl?: string | null;
  note?: string | null;
  targetActor?: ThreadActor;
  text: string;
  tone: 'alert' | 'pending' | 'success';
  type: 'nudge' | 'streak_milestone' | 'tap_in';
};

const sendCircleThreadMessageSchema = z.object({
  circleId: z.string().trim().min(1),
  mediaImageUrl: z.string().trim().max(2048).optional(),
  messageId: z.string().trim().min(1).max(160),
  text: z.string().trim().max(1000).optional(),
});

const toggleCircleThreadItemLikeSchema = z.object({
  circleId: z.string().trim().min(1),
  itemId: z.string().trim().min(1).max(160),
});

const markCircleThreadReadSchema = z.object({
  circleId: z.string().trim().min(1),
});

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function sanitizeCircleThreadText(value: unknown, maxLength = 1000) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function buildThreadActor(actor: ThreadActor) {
  return {
    avatarUrl: asOptionalString(actor.avatarUrl) ?? null,
    displayName: asOptionalString(actor.displayName) ?? 'Hoyst member',
    handle: asOptionalString(actor.handle) ?? null,
    uid: asOptionalString(actor.uid) ?? null,
  };
}

function buildProfileThreadActor(profile: DocumentData, uid: string) {
  return buildThreadActor({
    avatarUrl: profile.avatarUrl,
    displayName: profile.displayName,
    handle: profile.handle,
    uid,
  });
}

async function getAuthenticatedUid(uid?: string, idToken?: string) {
  if (uid) {
    return uid;
  }

  if (!idToken) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }
}

async function requireCompletedProfile(uid?: string, idToken?: string) {
  const authenticatedUid = await getAuthenticatedUid(uid, idToken);
  const snapshot = await db.collection('users').doc(authenticatedUid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid: authenticatedUid};
}

function ensureActiveMember(member: DocumentData | undefined) {
  if (member?.status !== 'active') {
    throw new HttpsError('permission-denied', 'Join this circle first.');
  }
}

export function getCircleThreadNudgeText({
  actorName,
  targetCount,
  targetName,
}: {
  actorName: string;
  targetCount: number;
  targetName?: string;
}) {
  if (targetName) {
    return `${actorName} nudged ${targetName}`;
  }

  return `${actorName} nudged ${targetCount} companions`;
}

export function getCircleThreadStreakText(
  actorName: string,
  streakDays: number,
) {
  return `${actorName} reached a ${streakDays}-day streak.`;
}

export async function createCircleThreadActivity({
  actor,
  circleId,
  createdAt,
  itemId,
  mediaImageUrl,
  note,
  targetActor,
  text,
  tone,
  type,
}: CreateCircleThreadActivityInput) {
  const cleanText = sanitizeCircleThreadText(text, 240);

  if (!cleanText) {
    return undefined;
  }

  const feedItemsRef = db
    .collection('circles')
    .doc(circleId)
    .collection('feedItems');
  const itemRef = itemId ? feedItemsRef.doc(itemId) : feedItemsRef.doc();

  await itemRef.set(
    {
      actor: buildThreadActor(actor),
      createdAt: createdAt ?? FieldValue.serverTimestamp(),
      kind: 'activity',
      likeCount: 0,
      likedBy: {},
      mediaImageUrl: asOptionalString(mediaImageUrl) ?? null,
      note: sanitizeCircleThreadText(note, 1000) ?? null,
      targetActor: targetActor ? buildThreadActor(targetActor) : null,
      text: cleanText,
      tone,
      type,
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return itemRef.id;
}

export const sendCircleThreadMessage = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = sendCircleThreadMessageSchema.parse(request.data);
  const text = sanitizeCircleThreadText(input.text);
  const mediaImageUrl = asOptionalString(input.mediaImageUrl);

  if (!text && !mediaImageUrl) {
    throw new HttpsError(
      'invalid-argument',
      'Add a message or image before sending.',
    );
  }

  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const itemRef = circleRef.collection('feedItems').doc(input.messageId);
  const readRef = circleRef.collection('threadReads').doc(uid);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
      transaction.get(itemRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    ensureGroupCircle(circleSnapshot.data(), 'using the Circle thread');
    ensureActiveCircle(circleSnapshot.data(), 'sending Circle messages');
    ensureActiveMember(memberSnapshot.data());

    if (itemSnapshot.exists) {
      throw new HttpsError('already-exists', 'Message already sent.');
    }

    transaction.set(itemRef, {
      actor: buildProfileThreadActor(profile, uid),
      createdAt: now,
      kind: 'message',
      likeCount: 0,
      likedBy: {},
      mediaImageUrl: mediaImageUrl ?? null,
      text: text ?? null,
      type: 'message',
      updatedAt: now,
    });
    transaction.set(readRef, {readAt: now, updatedAt: now}, {merge: true});
  });

  return {itemId: itemRef.id};
});

export const toggleCircleThreadItemLike = onCall(async request => {
  const {uid} = await requireCompletedProfile(request.auth?.uid);
  const input = toggleCircleThreadItemLikeSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const itemRef = circleRef.collection('feedItems').doc(input.itemId);

  return db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
      transaction.get(itemRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    ensureGroupCircle(circleSnapshot.data(), 'using the Circle thread');
    ensureActiveCircle(circleSnapshot.data(), 'reacting in the Circle thread');
    ensureActiveMember(memberSnapshot.data());

    if (!itemSnapshot.exists) {
      throw new HttpsError('not-found', 'Thread item not found.');
    }

    const item = itemSnapshot.data() ?? {};
    const actor = item.actor as DocumentData | undefined;

    if (item.readOnly === true) {
      throw new HttpsError(
        'failed-precondition',
        'Historical activity is read-only.',
      );
    }

    if (asOptionalString(actor?.uid) === uid) {
      throw new HttpsError(
        'failed-precondition',
        'You cannot like your own item.',
      );
    }

    const likedBy =
      item.likedBy && typeof item.likedBy === 'object'
        ? (item.likedBy as DocumentData)
        : {};
    const wasLiked = Boolean(likedBy[uid]);
    const delta = wasLiked ? -1 : 1;
    const likeCount = Math.max(0, asNumber(item.likeCount, 0) + delta);

    transaction.set(
      itemRef,
      {
        [`likedBy.${uid}`]: wasLiked ? FieldValue.delete() : true,
        likeCount: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    return {liked: !wasLiked, likeCount};
  });
});

export const markCircleThreadRead = onCall(async request => {
  const {uid} = await requireCompletedProfile(request.auth?.uid);
  const input = markCircleThreadReadSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const [circleSnapshot, memberSnapshot] = await Promise.all([
    circleRef.get(),
    circleRef.collection('members').doc(uid).get(),
  ]);

  if (!circleSnapshot.exists) {
    throw new HttpsError('not-found', 'Circle not found.');
  }

  ensureGroupCircle(circleSnapshot.data(), 'using the Circle thread');
  ensureActiveCircle(circleSnapshot.data(), 'updating Circle thread activity');
  ensureActiveMember(memberSnapshot.data());

  await circleRef.collection('threadReads').doc(uid).set(
    {
      readAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return {read: true as const};
});
