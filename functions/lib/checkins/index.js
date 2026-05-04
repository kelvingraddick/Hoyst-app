"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitTapIn = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const submitTapInSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    note: zod_1.z.string().trim().max(1000).optional(),
    photoUrl: zod_1.z.string().trim().max(2048).optional(),
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
function getDateKey(timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(part => part.type === 'year')?.value ?? '1970';
    const month = parts.find(part => part.type === 'month')?.value ?? '01';
    const day = parts.find(part => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}
exports.submitTapIn = (0, https_1.onCall)(async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = submitTapInSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = firestore_1.FieldValue.serverTimestamp();
    return firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        if (memberSnapshot.data()?.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
        }
        const circle = circleSnapshot.data();
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const checkInSnapshot = await transaction.get(checkInRef);
        if (checkInSnapshot.exists) {
            throw new https_1.HttpsError('already-exists', 'You already tapped in today.');
        }
        transaction.set(checkInRef, {
            createdAt: now,
            displayName: profile.displayName,
            handle: profile.handle,
            note: input.note ?? null,
            photoUrl: input.photoUrl ?? null,
            status: 'done',
            uid,
        });
        transaction.set(circleRef.collection('days').doc(dateKey), {
            checkInCount: firestore_1.FieldValue.increment(1),
            dateKey,
            updatedAt: now,
        }, { merge: true });
        return { checkInId: uid, dateKey };
    });
});
