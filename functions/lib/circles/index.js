"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCircle = exports.joinCircle = exports.createCircle = void 0;
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const graceRuleSchema = zod_1.z.object({
    allowance: zod_1.z.number().int().min(0).max(30),
    windowDays: zod_1.z.number().int().min(1).max(365),
});
const createCircleSchema = zod_1.z.object({
    category: zod_1.z.string().trim().min(1).max(40),
    dailyTask: zod_1.z.string().trim().min(1).max(160),
    graceRules: zod_1.z
        .object({
        skip: graceRuleSchema,
    })
        .optional(),
    joinMode: zod_1.z.enum(['open', 'request_to_join', 'invite_only']),
    maxSize: zod_1.z.number().int().min(2).max(100),
    privacy: zod_1.z.enum(['public', 'private']),
    timezone: zod_1.z.string().trim().min(1).max(80).optional(),
    title: zod_1.z.string().trim().min(1).max(80),
});
const joinCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    inviteCode: zod_1.z.string().trim().optional(),
});
const deleteCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
async function requireCompletedProfile(uid) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const snapshot = await firebase_1.db.collection('users').doc(uid).get();
    const profile = snapshot.data();
    if (!profile || profile.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { profile, uid };
}
function createInviteCode() {
    return Math.random().toString(36).slice(2, 10);
}
function buildMemberPublicPreview(profile, uid) {
    return {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName,
        handle: profile.handle,
        uid,
    };
}
async function deleteCircleServerMetadata(circleId) {
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(circleId);
    await Promise.all([
        publicIndexRef.delete(),
        (0, storage_1.getStorage)().bucket().deleteFiles({
            force: true,
            prefix: `circles/${circleId}/`,
        }),
    ]);
}
exports.createCircle = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = createCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc();
    const memberRef = circleRef.collection('members').doc(uid);
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(circleRef.id);
    const now = firestore_1.FieldValue.serverTimestamp();
    const inviteCode = createInviteCode();
    const circle = {
        category: input.category,
        createdAt: now,
        dailyTask: input.dailyTask,
        graceRules: input.graceRules ?? {
            skip: {
                allowance: 2,
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
    const batch = firebase_1.db.batch();
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
    return { circleId: circleRef.id, inviteCode };
});
exports.joinCircle = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = joinCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(input.circleId);
    const now = firestore_1.FieldValue.serverTimestamp();
    return firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        if (memberSnapshot.data()?.status === 'active') {
            return { status: 'active' };
        }
        if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0)) {
            throw new https_1.HttpsError('resource-exhausted', 'This circle is full.');
        }
        if (circle?.privacy === 'private' &&
            input.inviteCode !== circle.inviteCode) {
            throw new https_1.HttpsError('permission-denied', 'A valid invite is required.');
        }
        if (circle?.joinMode === 'request_to_join') {
            transaction.set(joinRequestRef, {
                avatarUrl: profile.avatarUrl ?? null,
                createdAt: now,
                displayName: profile.displayName,
                handle: profile.handle,
                status: 'pending',
                uid,
            }, { merge: true });
            transaction.set(memberRef, {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                requestedAt: now,
                role: 'member',
                status: 'pending',
                uid,
            }, { merge: true });
            return { status: 'pending' };
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
        transaction.update(circleRef, { memberCount: firestore_1.FieldValue.increment(1) });
        if (circle?.privacy === 'public') {
            transaction.set(publicIndexRef, {
                memberCount: firestore_1.FieldValue.increment(1),
                members: firestore_1.FieldValue.arrayUnion(buildMemberPublicPreview(profile, uid)),
                updatedAt: now,
            }, { merge: true });
        }
        return { status: 'active' };
    });
});
exports.deleteCircle = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = deleteCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const [circleSnapshot, memberSnapshot] = await Promise.all([
        circleRef.get(),
        memberRef.get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    const circle = circleSnapshot.data();
    const member = memberSnapshot.data();
    if (circle?.ownerId !== uid ||
        member?.role !== 'owner' ||
        member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Only the circle owner can delete this circle.');
    }
    await deleteCircleServerMetadata(input.circleId);
    await firebase_1.db.recursiveDelete(circleRef);
    return { deleted: true };
});
