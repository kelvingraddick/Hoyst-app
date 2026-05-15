"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCircle = exports.pokeCircleMembers = exports.reviewJoinRequest = exports.joinCircle = exports.createCircle = void 0;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const notifications_1 = require("../notifications");
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
const reviewJoinRequestSchema = zod_1.z.object({
    approved: zod_1.z.boolean(),
    circleId: zod_1.z.string().trim().min(1),
    requesterId: zod_1.z.string().trim().min(1),
});
const pokeCircleMembersSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
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
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function getDateKeyForTimezone(timezone, now = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year')?.value ?? '1970';
    const month = parts.find(part => part.type === 'month')?.value ?? '01';
    const day = parts.find(part => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
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
        (0, storage_1.getStorage)()
            .bucket()
            .deleteFiles({
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
exports.joinCircle = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = joinCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
    const publicIndexRef = firebase_1.db
        .collection('publicCircleIndex')
        .doc(input.circleId);
    const now = firestore_1.FieldValue.serverTimestamp();
    const requestToken = (0, node_crypto_1.randomUUID)();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, joinRequestSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(joinRequestRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        const member = memberSnapshot.data();
        const joinRequest = joinRequestSnapshot.data();
        if (member?.status === 'active') {
            return { shouldNotifyOwner: false, status: 'active' };
        }
        if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0)) {
            throw new https_1.HttpsError('resource-exhausted', 'This circle is full.');
        }
        if (circle?.privacy === 'private' &&
            input.inviteCode !== circle.inviteCode) {
            throw new https_1.HttpsError('permission-denied', 'A valid invite is required.');
        }
        if (circle?.joinMode === 'request_to_join') {
            if (member?.status === 'pending' || joinRequest?.status === 'pending') {
                const existingRequestToken = asOptionalString(joinRequest?.notificationToken) ??
                    asOptionalString(member?.notificationToken);
                if (!existingRequestToken && joinRequestSnapshot.exists) {
                    transaction.set(joinRequestRef, { notificationToken: requestToken }, { merge: true });
                    if (memberSnapshot.exists) {
                        transaction.set(memberRef, { notificationToken: requestToken }, { merge: true });
                    }
                    return {
                        requestToken,
                        shouldNotifyOwner: true,
                        status: 'pending',
                    };
                }
                return { shouldNotifyOwner: false, status: 'pending' };
            }
            transaction.set(joinRequestRef, {
                avatarUrl: profile.avatarUrl ?? null,
                createdAt: now,
                displayName: profile.displayName,
                handle: profile.handle,
                notificationToken: requestToken,
                status: 'pending',
                uid,
            }, { merge: true });
            transaction.set(memberRef, {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                notificationToken: requestToken,
                requestedAt: now,
                role: 'member',
                status: 'pending',
                uid,
            }, { merge: true });
            return {
                requestToken,
                shouldNotifyOwner: true,
                status: 'pending',
            };
        }
        const memberPreview = {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            joinedAt: now,
            role: 'member',
            status: 'active',
            uid,
        };
        transaction.set(memberRef, memberPreview);
        transaction.update(circleRef, { memberCount: firestore_1.FieldValue.increment(1) });
        if (circle?.privacy === 'public') {
            transaction.set(publicIndexRef, {
                memberCount: firestore_1.FieldValue.increment(1),
                members: firestore_1.FieldValue.arrayUnion(buildMemberPublicPreview(profile, uid)),
                updatedAt: now,
            }, { merge: true });
        }
        return { shouldNotifyOwner: true, status: 'active' };
    });
    const circleSnapshot = await circleRef.get();
    const circle = circleSnapshot.data();
    const ownerId = asOptionalString(circle?.ownerId);
    const circleTitle = asOptionalString(circle?.title) ?? 'your circle';
    if (ownerId && result.status === 'pending' && result.shouldNotifyOwner) {
        await (0, notifications_1.notifyOwnerJoinRequest)({
            circleId: input.circleId,
            circleTitle,
            ownerId,
            requestToken: result.requestToken,
            requester: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
        }).catch(error => console.error('notify_owner_join_request_failed', error));
    }
    else if (ownerId &&
        result.status === 'active' &&
        result.shouldNotifyOwner) {
        await (0, notifications_1.notifyOwnerNewJoin)({
            circleId: input.circleId,
            circleTitle,
            joinedMember: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
            ownerId,
        }).catch(error => console.error('notify_owner_new_join_failed', error));
    }
    return { status: result.status };
});
exports.reviewJoinRequest = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = reviewJoinRequestSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const requesterMemberRef = circleRef
        .collection('members')
        .doc(input.requesterId);
    const joinRequestRef = circleRef
        .collection('joinRequests')
        .doc(input.requesterId);
    const publicIndexRef = firebase_1.db
        .collection('publicCircleIndex')
        .doc(input.circleId);
    const now = firestore_1.FieldValue.serverTimestamp();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, requesterMemberSnapshot, joinRequestSnapshot,] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(requesterMemberRef),
            transaction.get(joinRequestRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        const ownerMember = memberSnapshot.data();
        if (circle?.ownerId !== uid ||
            ownerMember?.role !== 'owner' ||
            ownerMember?.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Only the circle owner can review requests.');
        }
        const requesterMember = requesterMemberSnapshot.data();
        if (requesterMember?.status !== 'pending' &&
            joinRequestSnapshot.data()?.status !== 'pending') {
            throw new https_1.HttpsError('not-found', 'Join request not found.');
        }
        if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0) &&
            input.approved) {
            throw new https_1.HttpsError('resource-exhausted', 'This circle is full.');
        }
        if (input.approved) {
            const approvedMember = {
                avatarUrl: requesterMember?.avatarUrl ?? null,
                displayName: requesterMember?.displayName ?? 'Hoyst member',
                handle: requesterMember?.handle ?? null,
                joinedAt: now,
                role: 'member',
                status: 'active',
                uid: input.requesterId,
            };
            transaction.set(requesterMemberRef, approvedMember, { merge: true });
            transaction.set(joinRequestRef, {
                reviewedAt: now,
                reviewedBy: uid,
                status: 'approved',
            }, { merge: true });
            transaction.update(circleRef, { memberCount: firestore_1.FieldValue.increment(1) });
            if (circle?.privacy === 'public') {
                transaction.set(publicIndexRef, {
                    memberCount: firestore_1.FieldValue.increment(1),
                    members: firestore_1.FieldValue.arrayUnion(buildMemberPublicPreview(approvedMember, input.requesterId)),
                    updatedAt: now,
                }, { merge: true });
            }
        }
        else {
            transaction.delete(requesterMemberRef);
            transaction.set(joinRequestRef, {
                reviewedAt: now,
                reviewedBy: uid,
                status: 'declined',
            }, { merge: true });
        }
        return {
            circleTitle: asOptionalString(circle?.title) ?? 'your circle',
            requesterMember,
            status: input.approved ? 'approved' : 'declined',
        };
    });
    await (0, notifications_1.notifyJoinRequestReview)({
        approved: input.approved,
        circleId: input.circleId,
        circleTitle: result.circleTitle,
        owner: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
        },
        requesterId: input.requesterId,
    }).catch(error => console.error('notify_join_review_failed', error));
    if (input.approved) {
        const circleSnapshot = await circleRef.get();
        const circle = circleSnapshot.data();
        const ownerId = asOptionalString(circle?.ownerId);
        if (ownerId) {
            await (0, notifications_1.notifyOwnerNewJoin)({
                circleId: input.circleId,
                circleTitle: result.circleTitle,
                joinedMember: result.requesterMember,
                ownerId,
            }).catch(error => console.error('notify_owner_approved_join_failed', error));
        }
    }
    return { status: result.status };
});
exports.pokeCircleMembers = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = pokeCircleMembersSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = new Date();
    const [circleSnapshot, memberSnapshot] = await Promise.all([
        circleRef.get(),
        memberRef.get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    const member = memberSnapshot.data();
    if (member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
    }
    const circle = circleSnapshot.data();
    const dateKey = getDateKeyForTimezone(asOptionalString(circle?.timezone) ?? 'UTC', now);
    const [activeMemberSnapshots, checkInSnapshots] = await Promise.all([
        circleRef.collection('members').where('status', '==', 'active').get(),
        circleRef.collection('days').doc(dateKey).collection('checkIns').get(),
    ]);
    const coveredUids = new Set(checkInSnapshots.docs
        .filter(snapshot => ['done', 'skip'].includes(snapshot.data().status))
        .map(snapshot => snapshot.id));
    const targets = activeMemberSnapshots.docs
        .map(snapshot => snapshot.data())
        .filter(memberData => {
        const targetUid = asOptionalString(memberData.uid);
        return Boolean(targetUid && targetUid !== uid && !coveredUids.has(targetUid));
    });
    await Promise.all(targets.map(memberData => (0, notifications_1.notifyPoke)({
        actor: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
        },
        circleId: input.circleId,
        circleTitle: asOptionalString(circle?.title) ?? 'your circle',
        dateKey,
        targetUid: asOptionalString(memberData.uid) ?? '',
    })));
    return { poked: targets.length };
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
