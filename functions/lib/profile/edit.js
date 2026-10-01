"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshMemberProfile = exports.updateProfile = exports.checkProfileUsername = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const handleSchema = zod_1.z
    .string()
    .trim()
    .transform(value => value.replace(/^@+/, '').toLowerCase())
    .pipe(zod_1.z.string().regex(/^[a-z0-9_]{3,20}$/));
const tintSchema = zod_1.z.enum(['green', 'blue', 'purple', 'orange', 'gold']);
const updateSchema = zod_1.z
    .object({
    displayName: zod_1.z.string().trim().min(1).max(60).optional(),
    handle: handleSchema.optional(),
    bio: zod_1.z.string().trim().nullable().optional(),
    avatarUrl: zod_1.z.string().url().nullable().optional(),
    profileTint: tintSchema.optional(),
    timezone: zod_1.z
        .string()
        .trim()
        .min(1)
        .max(80)
        .refine(value => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: value });
            return true;
        }
        catch {
            return false;
        }
    }, 'Choose a valid timezone.')
        .optional(),
})
    .strict()
    .refine(value => Object.keys(value).length > 0, 'No profile changes supplied.');
function requireUid(uid) {
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    return uid;
}
function parse(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success)
        throw new https_1.HttpsError('invalid-argument', result.error.issues[0]?.message || 'Invalid profile changes.');
    return result.data;
}
function requireComplete(profile) {
    if (profile?.onboardingStatus !== 'complete')
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
}
exports.checkProfileUsername = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request.auth?.uid);
    const handle = parse(handleSchema, request.data?.handle);
    const [user, candidate] = await Promise.all([
        firebase_1.db.doc(`users/${uid}`).get(),
        firebase_1.db.doc(`handles/${handle}`).get(),
    ]);
    requireComplete(user.data());
    return {
        handle,
        available: !candidate.exists || candidate.data()?.uid === uid,
    };
});
exports.updateProfile = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request.auth?.uid);
    const payload = { ...request.data };
    delete payload.idToken;
    const input = parse(updateSchema, payload);
    const userRef = firebase_1.db.doc(`users/${uid}`);
    const profile = await firebase_1.db.runTransaction(async (transaction) => {
        const user = await transaction.get(userRef);
        const previous = user.data();
        requireComplete(previous);
        const oldHandle = previous.handle;
        const newHandle = input.handle ?? oldHandle;
        if (newHandle !== oldHandle) {
            const nextRef = firebase_1.db.doc(`handles/${newHandle}`);
            const oldRef = firebase_1.db.doc(`handles/${oldHandle}`);
            const [candidate, oldClaim] = await Promise.all([
                transaction.get(nextRef),
                transaction.get(oldRef),
            ]);
            if (candidate.exists && candidate.data()?.uid !== uid)
                throw new https_1.HttpsError('already-exists', 'That username is already taken.');
            transaction.set(nextRef, {
                uid,
                handle: newHandle,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            // Never delete a claim owned by a different account, even for legacy inconsistent data.
            if (oldClaim.data()?.uid === uid)
                transaction.delete(oldRef);
        }
        const updates = { ...input, updatedAt: firestore_1.FieldValue.serverTimestamp() };
        transaction.update(userRef, updates);
        return {
            id: uid,
            name: input.displayName ?? previous.displayName,
            handle: newHandle,
            bio: input.bio !== undefined ? input.bio || null : previous.bio ?? null,
            avatarUrl: input.avatarUrl !== undefined
                ? input.avatarUrl
                : previous.avatarUrl ?? null,
            profileTint: input.profileTint ?? previous.profileTint ?? 'green',
            timezone: input.timezone ?? previous.timezone ?? 'UTC',
            onboardingStatus: 'complete',
        };
    });
    return { profile };
});
/** Project current identity only. Historical thread/inbox actors remain immutable snapshots. */
exports.refreshMemberProfile = (0, firestore_2.onDocumentWritten)({ document: 'users/{uid}', retry: true }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after ||
        (before &&
            before.displayName === after.displayName &&
            before.handle === after.handle &&
            before.avatarUrl === after.avatarUrl))
        return;
    const uid = event.params.uid;
    const members = await firebase_1.db
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();
    const refs = members.docs
        .filter(doc => doc.id === uid &&
        /^circles\/[^/]+\/members\/[^/]+$/.test(doc.ref.path))
        .map(doc => doc.ref);
    // Read the latest identity inside each transaction to make replay/out-of-order events safe.
    for (let index = 0; index < refs.length; index += 400) {
        await firebase_1.db.runTransaction(async (transaction) => {
            const latest = await transaction.get(firebase_1.db.doc(`users/${uid}`));
            if (!latest.exists)
                return;
            const live = await Promise.all(refs.slice(index, index + 400).map(ref => transaction.get(ref)));
            const identity = latest.data();
            for (const member of live)
                if (member.exists)
                    transaction.update(member.ref, {
                        displayName: identity.displayName,
                        handle: identity.handle,
                        avatarUrl: identity.avatarUrl ?? null,
                    });
        });
    }
});
