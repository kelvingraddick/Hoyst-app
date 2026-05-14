"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTapIn = exports.submitTapIn = void 0;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const grace_1 = require("./grace");
const remove_1 = require("./remove");
const notifications_1 = require("../notifications");
const submitTapInSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    note: zod_1.z.string().trim().max(1000).optional(),
    photoUrl: zod_1.z.string().trim().max(2048).optional(),
    status: zod_1.z.enum(['done', 'skip']).default('done'),
});
const removeTapInSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    idToken: zod_1.z.string().trim().min(1).optional(),
});
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
    const result = await firebase_1.db.runTransaction(async (transaction) => {
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
        if (input.status === 'skip') {
            const skipRule = circle?.graceRules?.skip;
            const graceRule = {
                allowance: typeof skipRule?.allowance === 'number' ? skipRule.allowance : 0,
                windowDays: typeof skipRule?.windowDays === 'number' ? skipRule.windowDays : 1,
            };
            const rollingDateKeys = (0, grace_1.getRollingDateKeys)(dateKey, graceRule.windowDays);
            const priorSkipSnapshots = await Promise.all(rollingDateKeys.map(windowDateKey => transaction.get(circleRef
                .collection('days')
                .doc(windowDateKey)
                .collection('checkIns')
                .doc(uid))));
            const priorSkipCount = priorSkipSnapshots.filter(snapshot => snapshot.data()?.status === 'skip').length;
            if (!(0, grace_1.canUseSkipGrace)({ graceRule, priorSkipCount })) {
                throw new https_1.HttpsError('resource-exhausted', 'No skips are available for this grace window.');
            }
        }
        transaction.set(checkInRef, {
            avatarUrl: profile.avatarUrl ?? null,
            createdAt: now,
            displayName: profile.displayName,
            handle: profile.handle,
            note: input.note ?? null,
            photoUrl: input.photoUrl ?? null,
            status: input.status,
            uid,
        });
        transaction.set(circleRef.collection('days').doc(dateKey), {
            checkInCount: firestore_1.FieldValue.increment(1),
            dateKey,
            updatedAt: now,
        }, { merge: true });
        return { checkInId: uid, dateKey };
    });
    const [circleSnapshot, memberSnapshots, checkInSnapshots] = await Promise.all([
        circleRef.get(),
        circleRef.collection('members').where('status', '==', 'active').get(),
        circleRef
            .collection('days')
            .doc(result.dateKey)
            .collection('checkIns')
            .get(),
    ]);
    const circle = circleSnapshot.data();
    const coveredUids = new Set(checkInSnapshots.docs
        .filter(snapshot => ['done', 'skip'].includes(snapshot.data().status))
        .map(snapshot => snapshot.id));
    const pendingMembers = memberSnapshots.docs
        .map(snapshot => snapshot.data())
        .filter(memberData => {
        const memberUid = memberData.uid;
        return (typeof memberUid === 'string' &&
            memberUid !== uid &&
            !coveredUids.has(memberUid));
    });
    const remainingCount = pendingMembers.length;
    if (remainingCount > 0 && remainingCount <= 2) {
        await Promise.all(pendingMembers.map(memberData => (0, notifications_1.notifyCircleAtRisk)({
            circleId: input.circleId,
            circleTitle: typeof circle?.title === 'string' ? circle.title : 'Your circle',
            dateKey: result.dateKey,
            remainingCount,
            targetUid: memberData.uid,
        }))).catch(error => console.error('notify_circle_at_risk_failed', error));
    }
    return result;
});
exports.removeTapIn = (0, https_1.onCall)(async (request) => {
    const input = removeTapInSchema.parse(request.data);
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid, input.idToken);
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
        const circle = circleSnapshot.data();
        const dateKey = getDateKey(circle?.timezone ?? profile.timezone ?? 'UTC');
        const checkInRef = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .doc(uid);
        const checkInSnapshot = await transaction.get(checkInRef);
        const decision = (0, remove_1.getRemoveTapInDecision)({
            checkInStatus: checkInSnapshot.data()?.status,
            memberStatus: memberSnapshot.data()?.status,
        });
        if (!decision.removed) {
            return { dateKey, removed: false };
        }
        transaction.delete(checkInRef);
        transaction.set(circleRef.collection('days').doc(dateKey), {
            checkInCount: firestore_1.FieldValue.increment(decision.checkInCountDelta),
            dateKey,
            updatedAt: now,
        }, { merge: true });
        return { dateKey, removed: true };
    });
});
