"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeProfile = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const onboardingPreferencesSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(8).default([]),
    goal: zod_1.z.string().trim().min(1).max(80).optional(),
    pace: zod_1.z.string().trim().min(1).max(80).optional(),
    reminderPreference: zod_1.z.string().trim().min(1).max(80).optional(),
    socialComfort: zod_1.z.string().trim().min(1).max(80).optional(),
});
const completeProfileSchema = zod_1.z.object({
    avatarUrl: zod_1.z.string().url().optional(),
    displayName: zod_1.z.string().trim().min(1).max(60),
    handle: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{3,20}$/),
    onboardingPreferences: onboardingPreferencesSchema.optional(),
    timezone: zod_1.z.string().trim().min(1).max(80),
});
function requireAuthUid(uid) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    return uid;
}
exports.completeProfile = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const input = completeProfileSchema.parse(request.data);
    const userRecord = request.auth?.token;
    const userRef = firebase_1.db.collection('users').doc(uid);
    const userPrivateRef = firebase_1.db.collection('userPrivate').doc(uid);
    const handleRef = firebase_1.db.collection('handles').doc(input.handle);
    const now = firestore_1.FieldValue.serverTimestamp();
    await firebase_1.db.runTransaction(async (transaction) => {
        const [userSnapshot, handleSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(handleRef),
        ]);
        const existingUser = userSnapshot.data();
        const existingHandleOwner = handleSnapshot.data()?.uid;
        if (existingUser?.onboardingStatus === 'complete' &&
            existingUser.handle !== input.handle) {
            throw new https_1.HttpsError('failed-precondition', 'Handles cannot be changed.');
        }
        if (existingHandleOwner && existingHandleOwner !== uid) {
            throw new https_1.HttpsError('already-exists', 'That handle is already taken.');
        }
        transaction.set(handleRef, {
            createdAt: handleSnapshot.exists ? handleSnapshot.data()?.createdAt : now,
            handle: input.handle,
            uid,
        }, { merge: true });
        transaction.set(userRef, {
            avatarUrl: input.avatarUrl ?? null,
            displayName: input.displayName,
            handle: input.handle,
            onboardingStatus: 'complete',
            providerIds: request.auth?.token.firebase?.identities
                ? Object.keys(request.auth.token.firebase.identities)
                : [],
            timezone: input.timezone,
            updatedAt: now,
            ...(userSnapshot.exists ? {} : { createdAt: now }),
        }, { merge: true });
        transaction.set(userPrivateRef, {
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
                ? { onboardingPreferences: input.onboardingPreferences }
                : {}),
            phoneNumber: userRecord?.phone_number ?? null,
            updatedAt: now,
        }, { merge: true });
    });
    return { handle: input.handle, uid };
});
