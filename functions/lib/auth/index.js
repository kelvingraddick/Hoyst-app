"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.completeProfile = void 0;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const commitments_1 = require("../shared/commitments");
const starter_circle_plan_1 = require("./starter-circle-plan");
const momentum_1 = require("../momentum");
const onboardingPreferencesSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(8).default([]),
    focusArea: zod_1.z.string().trim().min(1).max(80).optional(),
    pace: zod_1.z.string().trim().min(1).max(80).optional(),
    reminderPreference: zod_1.z.string().trim().min(1).max(80).optional(),
    socialComfort: zod_1.z.string().trim().min(1).max(80).optional(),
});
const graceRuleSchema = zod_1.z.object({
    allowance: zod_1.z.number().int().min(0).max(30),
    windowDays: zod_1.z.number().int().min(1).max(365),
});
const commitmentFrequencySchema = zod_1.z.object({
    opportunitiesPerPeriod: zod_1.z.number().int().min(1).max(31).optional(),
    tapInsPerWeek: zod_1.z.number().int().min(1).max(7),
});
const starterCircleSchema = zod_1.z.object({
    category: zod_1.z.string().trim().min(1).max(40),
    circleMode: zod_1.z.enum(['personal', 'group']).optional().default('group'),
    commitment: zod_1.z.string().trim().min(1).max(160),
    commitmentCadence: zod_1.z.enum(['daily', 'weekly', 'monthly']).optional(),
    commitmentFrequency: commitmentFrequencySchema,
    commitmentType: zod_1.z.enum(['build', 'limit', 'avoid']).default('build'),
    graceRules: zod_1.z
        .object({
        skip: graceRuleSchema,
    })
        .optional(),
    joinMode: zod_1.z.enum(['open', 'request_to_join', 'invite_only']),
    maximumValue: zod_1.z.number().int().min(0).max(100000).optional(),
    maxSize: zod_1.z.number().int().min(1).max(100),
    minimumValue: zod_1.z.number().int().min(0).max(100000).optional(),
    privacy: zod_1.z.enum(['public', 'private']),
    setupId: zod_1.z.string().trim().min(1).max(120),
    stepValue: zod_1.z.number().min(0.01).max(100000).default(1),
    targetValue: zod_1.z.number().int().min(0).max(100000).optional(),
    timezone: zod_1.z.string().trim().min(1).max(80).optional(),
    title: zod_1.z.string().trim().min(1).max(80),
    unitLabel: zod_1.z.string().trim().min(1).max(32).default('Tap In'),
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
const completeProfileSchema = zod_1.z.object({
    avatarUrl: zod_1.z.string().url().optional(),
    displayName: zod_1.z.string().trim().min(1).max(60),
    handle: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{3,20}$/),
    onboardingPreferences: onboardingPreferencesSchema.optional(),
    starterCircle: starterCircleSchema.optional(),
    timezone: zod_1.z.string().trim().min(1).max(80),
});
function requireAuthUid(uid) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    return uid;
}
function createInviteCode() {
    return Math.random().toString(36).slice(2, 10);
}
function asOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function isValidStarterCircleMember(member) {
    return member?.role === 'owner' && member.status === 'active';
}
function getParentDocument(ref, label) {
    const parent = ref.parent.parent;
    if (!parent) {
        throw new Error(`Could not resolve parent document for ${label}.`);
    }
    return parent;
}
function getCircleRefFromCheckInRef(ref) {
    const dayRef = getParentDocument(ref, 'check-in');
    const circleRef = getParentDocument(dayRef, 'check-in day');
    return { circleRef, dayRef };
}
async function deleteStoragePrefix(prefix) {
    await (0, storage_1.getStorage)().bucket().deleteFiles({
        force: true,
        prefix,
    });
}
async function deleteCircleServerMetadata(circleId) {
    await Promise.all([
        firebase_1.db.collection('publicCircleIndex').doc(circleId).delete(),
        deleteStoragePrefix(`circles/${circleId}/`),
    ]);
}
async function deleteDocumentRefsInBatches(refs) {
    for (let index = 0; index < refs.length; index += 400) {
        const batch = firebase_1.db.batch();
        refs.slice(index, index + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
    }
}
async function collectNonOwnedCircleIds(uid, ownedCircleIds) {
    const [memberSnapshots, historySnapshots, checkInSnapshots] = await Promise.all([
        firebase_1.db.collectionGroup('members').where('uid', '==', uid).get(),
        firebase_1.db.collectionGroup('membershipHistory').where('uid', '==', uid).get(),
        firebase_1.db.collectionGroup('checkIns').where('uid', '==', uid).get(),
    ]);
    const circleIds = new Set();
    memberSnapshots.docs.forEach(snapshot => {
        circleIds.add(getParentDocument(snapshot.ref, 'member').id);
    });
    historySnapshots.docs.forEach(snapshot => {
        circleIds.add(getParentDocument(snapshot.ref, 'membership history').id);
    });
    checkInSnapshots.docs.forEach(snapshot => {
        circleIds.add(getCircleRefFromCheckInRef(snapshot.ref).circleRef.id);
    });
    ownedCircleIds.forEach(circleId => circleIds.delete(circleId));
    return circleIds;
}
async function deleteCircleFeedItemsForUser(circleId, uid) {
    const feedItemsRef = firebase_1.db
        .collection('circles')
        .doc(circleId)
        .collection('feedItems');
    const [actorSnapshots, targetSnapshots] = await Promise.all([
        feedItemsRef.where('actor.uid', '==', uid).get(),
        feedItemsRef.where('targetActor.uid', '==', uid).get(),
    ]);
    const refs = new Map();
    [...actorSnapshots.docs, ...targetSnapshots.docs].forEach(snapshot => {
        refs.set(snapshot.ref.path, snapshot.ref);
    });
    await deleteDocumentRefsInBatches(Array.from(refs.values()));
}
async function cleanNonOwnedCircleHistory(uid, circleIds) {
    for (const circleId of circleIds) {
        await Promise.all([
            (0, momentum_1.removeMemberFromAllCircleOpportunities)({ circleId, uid }),
            deleteCircleFeedItemsForUser(circleId, uid),
        ]);
    }
}
async function deleteNonOwnedMemberships(uid, ownedCircleIds) {
    const memberSnapshots = await firebase_1.db
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
        const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(circleRef.id);
        const publicIndexSnapshot = await publicIndexRef.get();
        const publicIndex = publicIndexSnapshot.data();
        const filteredMembers = Array.isArray(publicIndex?.members)
            ? publicIndex.members.filter(memberPreview => !(typeof memberPreview === 'object' &&
                memberPreview !== null &&
                'uid' in memberPreview &&
                memberPreview.uid === uid))
            : undefined;
        const batch = firebase_1.db.batch();
        batch.delete(memberSnapshot.ref);
        if (circleSnapshot.exists && member.status === 'active') {
            batch.update(circleRef, {
                memberCount: firestore_1.FieldValue.increment(-1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        if (publicIndexSnapshot.exists) {
            batch.set(publicIndexRef, {
                ...(member.status === 'active'
                    ? { memberCount: firestore_1.FieldValue.increment(-1) }
                    : {}),
                ...(filteredMembers ? { members: filteredMembers } : {}),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
    }
}
async function deleteJoinRequests(uid, ownedCircleIds) {
    const requestSnapshots = await firebase_1.db
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
async function deleteMembershipHistory(uid, ownedCircleIds) {
    const historySnapshots = await firebase_1.db
        .collectionGroup('membershipHistory')
        .where('uid', '==', uid)
        .get();
    for (const historySnapshot of historySnapshots.docs) {
        const circleRef = getParentDocument(historySnapshot.ref, 'membership history');
        if (!ownedCircleIds.has(circleRef.id)) {
            await firebase_1.db.recursiveDelete(historySnapshot.ref);
        }
    }
}
async function deleteNonOwnedCheckIns(uid, ownedCircleIds) {
    const checkInSnapshots = await firebase_1.db
        .collectionGroup('checkIns')
        .where('uid', '==', uid)
        .get();
    const records = checkInSnapshots.docs.flatMap(checkInSnapshot => {
        const { circleRef, dayRef } = getCircleRefFromCheckInRef(checkInSnapshot.ref);
        return ownedCircleIds.has(circleRef.id)
            ? []
            : [{ checkInSnapshot, circleRef, dayRef }];
    });
    for (let index = 0; index < records.length; index += 400) {
        const batch = firebase_1.db.batch();
        records.slice(index, index + 400).forEach(({ checkInSnapshot }) => {
            batch.set(checkInSnapshot.ref, {
                deletionReason: 'account',
                deletionRequestedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
    }
    for (const { checkInSnapshot, circleRef, dayRef } of records) {
        const checkIn = checkInSnapshot.data();
        const batch = firebase_1.db.batch();
        batch.delete(checkInSnapshot.ref);
        if ((0, commitments_1.isCoveredCheckInData)(checkIn)) {
            batch.set(dayRef, {
                checkInCount: firestore_1.FieldValue.increment(-1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        await deleteStoragePrefix(`circles/${circleRef.id}/check-ins/${dayRef.id}/${uid}/`);
    }
}
async function deleteOwnedCircles(ownedCircleIds) {
    for (const circleId of ownedCircleIds) {
        const circleRef = firebase_1.db.collection('circles').doc(circleId);
        await deleteCircleServerMetadata(circleId);
        await firebase_1.db.recursiveDelete(circleRef);
    }
}
async function deleteAccountDocuments(uid) {
    const userRef = firebase_1.db.collection('users').doc(uid);
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const [userSnapshot, handleSnapshots] = await Promise.all([
        userRef.get(),
        firebase_1.db.collection('handles').where('uid', '==', uid).get(),
    ]);
    const handle = userSnapshot.data()?.handle;
    const handleRefs = new Map();
    const batch = firebase_1.db.batch();
    batch.delete(userRef);
    if (typeof handle === 'string' && handle.trim()) {
        const handleRef = firebase_1.db.collection('handles').doc(handle);
        handleRefs.set(handleRef.path, handleRef);
    }
    handleSnapshots.docs.forEach(handleSnapshot => {
        handleRefs.set(handleSnapshot.ref.path, handleSnapshot.ref);
    });
    handleRefs.forEach(handleRef => {
        batch.delete(handleRef);
    });
    await Promise.all([
        batch.commit(),
        firebase_1.db.recursiveDelete(userPrivateRef),
        deleteStoragePrefix(`users/${uid}/avatar/`),
    ]);
}
async function deleteAuthUser(uid) {
    try {
        await (0, auth_1.getAuth)().deleteUser(uid);
    }
    catch (error) {
        if (error.code !== 'auth/user-not-found') {
            throw error;
        }
    }
}
exports.completeProfile = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const input = completeProfileSchema.parse(request.data);
    const userRecord = request.auth?.token;
    const userRef = firebase_1.db.collection('users').doc(uid);
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const handleRef = firebase_1.db.collection('handles').doc(input.handle);
    const now = firestore_1.FieldValue.serverTimestamp();
    const authAvatarUrl = typeof userRecord?.picture === 'string' ? userRecord.picture : undefined;
    let starterCircle;
    await firebase_1.db.runTransaction(async (transaction) => {
        const [userSnapshot, handleSnapshot, userPrivateSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(handleRef),
            transaction.get(userPrivateRef),
        ]);
        const existingUser = userSnapshot.data();
        const existingHandleOwner = handleSnapshot.data()?.uid;
        const userPrivate = userPrivateSnapshot.data();
        const existingStarterCircleId = asOptionalString(userPrivate?.onboardingStarterCircleId);
        const existingStarterCircleSetupId = asOptionalString(userPrivate?.onboardingStarterCircleSetupId);
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
            ...(userSnapshot.exists ? {} : { createdAt: now }),
        };
        if (existingUser?.onboardingStatus === 'complete' &&
            existingUser.handle !== input.handle) {
            throw new https_1.HttpsError('failed-precondition', 'Handles cannot be changed.');
        }
        if (existingHandleOwner && existingHandleOwner !== uid) {
            throw new https_1.HttpsError('already-exists', 'That handle is already taken.');
        }
        let existingStarterCircleIsValid = false;
        if (input.starterCircle &&
            existingStarterCircleId &&
            existingStarterCircleSetupId === input.starterCircle.setupId) {
            const existingCircleRef = firebase_1.db
                .collection('circles')
                .doc(existingStarterCircleId);
            const existingMemberRef = existingCircleRef
                .collection('members')
                .doc(uid);
            const [existingCircleSnapshot, existingMemberSnapshot] = await Promise.all([
                transaction.get(existingCircleRef),
                transaction.get(existingMemberRef),
            ]);
            const existingCircle = existingCircleSnapshot.data();
            existingStarterCircleIsValid =
                existingCircleSnapshot.exists &&
                    existingCircle?.ownerId === uid &&
                    isValidStarterCircleMember(existingMemberSnapshot.data());
        }
        const starterCircleDecision = (0, starter_circle_plan_1.resolveStarterCircleDecision)({
            existingCircleId: existingStarterCircleId,
            existingCircleIsValid: existingStarterCircleIsValid,
            existingSetupId: existingStarterCircleSetupId,
            hasStarterCirclePayload: Boolean(input.starterCircle),
            setupId: input.starterCircle?.setupId,
        });
        transaction.set(handleRef, {
            createdAt: handleSnapshot.exists
                ? handleSnapshot.data()?.createdAt
                : now,
            handle: input.handle,
            uid,
        }, { merge: true });
        transaction.set(userRef, profileData, { merge: true });
        if (input.starterCircle &&
            (starterCircleDecision === 'create' || starterCircleDecision === 'repair')) {
            const circleRef = firebase_1.db.collection('circles').doc();
            const memberRef = circleRef.collection('members').doc(uid);
            const membershipHistoryRef = circleRef
                .collection('membershipHistory')
                .doc(uid);
            const membershipPeriodRef = membershipHistoryRef
                .collection('periods')
                .doc('initial');
            const publicIndexRef = firebase_1.db
                .collection('publicCircleIndex')
                .doc(circleRef.id);
            const circleMode = input.starterCircle.circleMode;
            const isPersonal = circleMode === 'personal';
            const inviteCode = isPersonal ? undefined : createInviteCode();
            const joinMode = isPersonal
                ? 'invite_only'
                : input.starterCircle.joinMode;
            const maxSize = isPersonal ? 1 : starterCircleHiddenDefaults.maxSize;
            const privacy = isPersonal ? 'private' : input.starterCircle.privacy;
            const title = isPersonal
                ? input.starterCircle.commitment
                : input.starterCircle.title;
            const commitmentCadence = (0, commitments_1.getInputCommitmentCadence)(input.starterCircle.commitmentCadence, input.starterCircle.commitmentFrequency);
            const commitmentFrequency = (0, commitments_1.getStoredCommitmentFrequency)(commitmentCadence, input.starterCircle.commitmentFrequency);
            const commitmentType = (0, commitments_1.getCommitmentType)(input.starterCircle);
            const quantityConfig = (0, commitments_1.getQuantityConfig)(input.starterCircle);
            const circle = {
                category: input.starterCircle.category,
                circleMode,
                createdAt: now,
                commitment: input.starterCircle.commitment,
                commitmentCadence,
                commitmentFrequency,
                commitmentType,
                graceRules: starterCircleHiddenDefaults.graceRules,
                ...(inviteCode ? { inviteCode } : {}),
                joinMode,
                ...(typeof quantityConfig.maximumValue === 'number'
                    ? { maximumValue: quantityConfig.maximumValue }
                    : {}),
                ...(typeof quantityConfig.minimumValue === 'number'
                    ? { minimumValue: quantityConfig.minimumValue }
                    : {}),
                maxSize,
                memberCount: 1,
                ownerId: uid,
                privacy,
                stepValue: quantityConfig.stepValue,
                ...(typeof quantityConfig.targetValue === 'number'
                    ? { targetValue: quantityConfig.targetValue }
                    : {}),
                title,
                timezone: input.starterCircle.timezone ?? input.timezone,
                unitLabel: quantityConfig.unitLabel,
                updatedAt: now,
            };
            transaction.set(circleRef, circle);
            transaction.set(memberRef, {
                avatarUrl: profileData.avatarUrl,
                displayName: profileData.displayName,
                handle: profileData.handle,
                joinedAt: now,
                membershipPeriodId: membershipPeriodRef.id,
                opportunityEligibility: 'include_current',
                role: 'owner',
                status: 'active',
                uid,
            });
            transaction.set(membershipHistoryRef, {
                currentPeriodId: membershipPeriodRef.id,
                firstJoinedAt: now,
                lastJoinedAt: now,
                lastRole: 'owner',
                status: 'active',
                uid,
                updatedAt: now,
            });
            transaction.set(membershipPeriodRef, {
                circleId: circleRef.id,
                joinedAt: now,
                opportunityEligibility: 'include_current',
                periodId: membershipPeriodRef.id,
                role: 'owner',
                uid,
            });
            if (!isPersonal && privacy === 'public') {
                transaction.set(publicIndexRef, {
                    category: input.starterCircle.category,
                    circleMode,
                    commitment: input.starterCircle.commitment,
                    commitmentCadence,
                    commitmentFrequency,
                    commitmentType,
                    joinMode,
                    ...(typeof quantityConfig.maximumValue === 'number'
                        ? { maximumValue: quantityConfig.maximumValue }
                        : {}),
                    ...(typeof quantityConfig.minimumValue === 'number'
                        ? { minimumValue: quantityConfig.minimumValue }
                        : {}),
                    maxSize,
                    memberCount: 1,
                    members: [
                        {
                            avatarUrl: profileData.avatarUrl,
                            displayName: profileData.displayName,
                            handle: profileData.handle,
                            uid,
                        },
                    ],
                    stepValue: quantityConfig.stepValue,
                    ...(typeof quantityConfig.targetValue === 'number'
                        ? { targetValue: quantityConfig.targetValue }
                        : {}),
                    title,
                    unitLabel: quantityConfig.unitLabel,
                    updatedAt: now,
                });
            }
            starterCircle = {
                circleId: circleRef.id,
                ...(inviteCode ? { inviteCode } : {}),
            };
        }
        else if (starterCircleDecision === 'reuse' && existingStarterCircleId) {
            starterCircle = {
                circleId: existingStarterCircleId,
                inviteCode: asOptionalString(userPrivate?.onboardingStarterCircleInviteCode),
            };
        }
        console.info('onboarding_starter_circle', {
            circleId: starterCircle?.circleId ?? null,
            decision: starterCircleDecision,
            setupId: input.starterCircle?.setupId ?? null,
            uid,
        });
        transaction.set(userPrivateRef, {
            email: userRecord?.email ?? null,
            lastSignInAt: now,
            notificationSettings: {
                circleRisk: true,
                discovery: true,
                nudges: true,
                productUpdates: true,
                socialActivity: true,
                tapInReminders: true,
            },
            onboardingStatus: 'complete',
            ...(input.onboardingPreferences
                ? { onboardingPreferences: input.onboardingPreferences }
                : {}),
            ...(starterCircle
                ? {
                    onboardingStarterCircleId: starterCircle.circleId,
                    ...(starterCircle.inviteCode
                        ? { onboardingStarterCircleInviteCode: starterCircle.inviteCode }
                        : {}),
                    ...(input.starterCircle?.setupId
                        ? { onboardingStarterCircleSetupId: input.starterCircle.setupId }
                        : {}),
                }
                : {}),
            phoneNumber: userRecord?.phone_number ?? null,
            updatedAt: now,
        }, { merge: true });
    });
    if (starterCircle?.circleId) {
        await (0, momentum_1.materializeCurrentCircleOpportunities)(starterCircle.circleId).catch(error => console.error('materialize_onboarding_circle_opportunities_failed', error));
    }
    return { handle: input.handle, starterCircle, uid };
});
exports.deleteAccount = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const ownedCircleSnapshots = await firebase_1.db
        .collection('circles')
        .where('ownerId', '==', uid)
        .get();
    const ownedCircleIds = new Set(ownedCircleSnapshots.docs.map(snapshot => snapshot.id));
    const nonOwnedCircleIds = await collectNonOwnedCircleIds(uid, ownedCircleIds);
    await cleanNonOwnedCircleHistory(uid, nonOwnedCircleIds);
    await deleteNonOwnedMemberships(uid, ownedCircleIds);
    await deleteMembershipHistory(uid, ownedCircleIds);
    await deleteJoinRequests(uid, ownedCircleIds);
    await deleteNonOwnedCheckIns(uid, ownedCircleIds);
    await deleteOwnedCircles(ownedCircleIds);
    await deleteAccountDocuments(uid);
    await deleteAuthUser(uid);
    return { deleted: true };
});
