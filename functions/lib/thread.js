"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markCircleThreadRead = exports.toggleCircleThreadItemLike = exports.sendCircleThreadMessage = void 0;
exports.sanitizeCircleThreadText = sanitizeCircleThreadText;
exports.getCircleThreadNudgeText = getCircleThreadNudgeText;
exports.getCircleThreadStreakText = getCircleThreadStreakText;
exports.createCircleThreadActivity = createCircleThreadActivity;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("./firebase");
const circle_lifecycle_1 = require("./shared/circle-lifecycle");
const circle_mode_1 = require("./shared/circle-mode");
const sendCircleThreadMessageSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    mediaImageUrl: zod_1.z.string().trim().max(2048).optional(),
    messageId: zod_1.z.string().trim().min(1).max(160),
    text: zod_1.z.string().trim().max(1000).optional(),
});
const toggleCircleThreadItemLikeSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    itemId: zod_1.z.string().trim().min(1).max(160),
});
const markCircleThreadReadSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function asNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function sanitizeCircleThreadText(value, maxLength = 1000) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim().slice(0, maxLength)
        : undefined;
}
function buildThreadActor(actor) {
    return {
        avatarUrl: asOptionalString(actor.avatarUrl) ?? null,
        displayName: asOptionalString(actor.displayName) ?? 'Hoyst Member',
        handle: asOptionalString(actor.handle) ?? null,
        uid: asOptionalString(actor.uid) ?? null,
    };
}
function buildProfileThreadActor(profile, uid) {
    return buildThreadActor({
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
        handle: profile.handle,
        uid,
    });
}
async function getAuthenticatedUid(uid, idToken) {
    if (uid) {
        return uid;
    }
    if (!idToken) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    try {
        const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
        return decodedToken.uid;
    }
    catch {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
}
async function requireCompletedProfile(uid, idToken) {
    const authenticatedUid = await getAuthenticatedUid(uid, idToken);
    const snapshot = await firebase_1.db.collection('users').doc(authenticatedUid).get();
    const profile = snapshot.data();
    if (!profile || profile.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { profile, uid: authenticatedUid };
}
function ensureActiveMember(member) {
    if (member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
    }
}
function getCircleThreadNudgeText({ actorName, targetCount, targetName, }) {
    if (targetName) {
        return `${actorName} nudged ${targetName}`;
    }
    return `${actorName} nudged ${targetCount} ${targetCount === 1 ? 'Member' : 'Members'}`;
}
function getCircleThreadStreakText(actorName, streakDays) {
    return `${actorName} reached a ${streakDays}-day streak.`;
}
async function createCircleThreadActivity({ actor, circleId, createdAt, itemId, mediaImageUrl, note, targetActor, text, tone, type, }) {
    const cleanText = sanitizeCircleThreadText(text, 240);
    if (!cleanText) {
        return undefined;
    }
    const feedItemsRef = firebase_1.db
        .collection('circles')
        .doc(circleId)
        .collection('feedItems');
    const itemRef = itemId ? feedItemsRef.doc(itemId) : feedItemsRef.doc();
    await itemRef.set({
        actor: buildThreadActor(actor),
        createdAt: createdAt ?? firestore_1.FieldValue.serverTimestamp(),
        kind: 'activity',
        likeCount: 0,
        likedBy: {},
        mediaImageUrl: asOptionalString(mediaImageUrl) ?? null,
        note: sanitizeCircleThreadText(note, 1000) ?? null,
        targetActor: targetActor ? buildThreadActor(targetActor) : null,
        text: cleanText,
        tone,
        type,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return itemRef.id;
}
exports.sendCircleThreadMessage = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = sendCircleThreadMessageSchema.parse(request.data);
    const text = sanitizeCircleThreadText(input.text);
    const mediaImageUrl = asOptionalString(input.mediaImageUrl);
    if (!text && !mediaImageUrl) {
        throw new https_1.HttpsError('invalid-argument', 'Add a message or image before sending.');
    }
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const itemRef = circleRef.collection('feedItems').doc(input.messageId);
    const readRef = circleRef.collection('threadReads').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, itemSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(itemRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        (0, circle_mode_1.ensureGroupCircle)(circleSnapshot.data(), 'using the Circle thread');
        (0, circle_lifecycle_1.ensureActiveCircle)(circleSnapshot.data(), 'sending Circle messages');
        ensureActiveMember(memberSnapshot.data());
        if (itemSnapshot.exists) {
            throw new https_1.HttpsError('already-exists', 'Message already sent.');
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
        transaction.set(readRef, { readAt: now, updatedAt: now }, { merge: true });
    });
    return { itemId: itemRef.id };
});
exports.toggleCircleThreadItemLike = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = toggleCircleThreadItemLikeSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const itemRef = circleRef.collection('feedItems').doc(input.itemId);
    return firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, itemSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(itemRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        (0, circle_mode_1.ensureGroupCircle)(circleSnapshot.data(), 'using the Circle thread');
        (0, circle_lifecycle_1.ensureActiveCircle)(circleSnapshot.data(), 'reacting in the Circle thread');
        ensureActiveMember(memberSnapshot.data());
        if (!itemSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Thread item not found.');
        }
        const item = itemSnapshot.data() ?? {};
        const actor = item.actor;
        if (item.readOnly === true) {
            throw new https_1.HttpsError('failed-precondition', 'Historical activity is read-only.');
        }
        if (asOptionalString(actor?.uid) === uid) {
            throw new https_1.HttpsError('failed-precondition', 'You cannot like your own item.');
        }
        const likedBy = item.likedBy && typeof item.likedBy === 'object'
            ? item.likedBy
            : {};
        const wasLiked = Boolean(likedBy[uid]);
        const delta = wasLiked ? -1 : 1;
        const likeCount = Math.max(0, asNumber(item.likeCount, 0) + delta);
        transaction.set(itemRef, {
            [`likedBy.${uid}`]: wasLiked ? firestore_1.FieldValue.delete() : true,
            likeCount: firestore_1.FieldValue.increment(delta),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { liked: !wasLiked, likeCount };
    });
});
exports.markCircleThreadRead = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = markCircleThreadReadSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const [circleSnapshot, memberSnapshot] = await Promise.all([
        circleRef.get(),
        circleRef.collection('members').doc(uid).get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    (0, circle_mode_1.ensureGroupCircle)(circleSnapshot.data(), 'using the Circle thread');
    (0, circle_lifecycle_1.ensureActiveCircle)(circleSnapshot.data(), 'updating Circle thread activity');
    ensureActiveMember(memberSnapshot.data());
    await circleRef.collection('threadReads').doc(uid).set({
        readAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { read: true };
});
