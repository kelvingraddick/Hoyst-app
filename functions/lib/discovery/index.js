"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshPublicActivityProfile = exports.refreshPublicActivityCircle = exports.refreshPublicActivityMembership = exports.projectPublicTapIn = exports.maintainPublicCircleSearch = exports.searchPublicCircles = void 0;
exports.reconcilePublicActivity = reconcilePublicActivity;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const model_1 = require("./model");
const requestSchema = zod_1.z.object({
    query: zod_1.z.string().trim().max(120).default(''),
    category: zod_1.z.string().trim().min(1).max(40).default('All'),
    cursor: zod_1.z.string().max(1024).optional(),
});
const pageSize = 20;
const index = () => firebase_1.db.collection('publicCircleIndex');
/** One indexed prefix narrows candidates; remaining terms are AND matched on the server.
 * No first-50 cutoff. Counts cover the entire candidate query, not just the current page. */
exports.searchPublicCircles = (0, https_1.onCall)(async (request) => {
    const parsed = requestSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid circle search.');
    }
    const input = parsed.data;
    const words = (0, model_1.searchWords)(input.query);
    if (words.length > 8 || words.some(word => word.length > 40)) {
        throw new https_1.HttpsError('invalid-argument', 'Use up to eight search words, each at most 40 characters.');
    }
    const fingerprint = (0, node_crypto_1.createHash)('sha256')
        .update(JSON.stringify([words, input.category]))
        .digest('hex');
    let cursor;
    if (input.cursor) {
        try {
            cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
            if (!cursor ||
                typeof cursor.id !== 'string' ||
                !Number.isSafeInteger(cursor.seconds) ||
                !Number.isInteger(cursor.nanoseconds) ||
                cursor.nanoseconds < 0 ||
                cursor.nanoseconds >= 1_000_000_000 ||
                cursor.fingerprint !== fingerprint) {
                throw new Error();
            }
        }
        catch {
            throw new https_1.HttpsError('invalid-argument', 'Restart this search.');
        }
    }
    let query = index()
        .where('circleMode', '==', 'group')
        .where('lifecycleStatus', '==', 'active');
    if (input.category !== 'All') {
        query = query.where('category', '==', input.category);
    }
    if (words.length) {
        query = query.where('searchTokens', 'array-contains', [...words].sort((a, b) => b.length - a.length)[0]);
    }
    const [snapshot, categorySnapshot] = await Promise.all([
        query
            .orderBy('updatedAt', 'desc')
            .orderBy(firestore_1.FieldPath.documentId(), 'desc')
            .get(),
        index()
            .where('circleMode', '==', 'group')
            .where('lifecycleStatus', '==', 'active')
            .select('category')
            .get(),
    ]);
    const matches = snapshot.docs.filter(doc => {
        const data = doc.data();
        return (data.title &&
            data.commitment &&
            (0, model_1.matchesWords)(data.searchTokens ?? [], words));
    });
    const remaining = cursor
        ? matches.filter(doc => {
            const { seconds, nanoseconds } = doc.data().updatedAt;
            // Preserve Firestore ordering before applying the document ID tie-break.
            return (seconds < cursor.seconds ||
                (seconds === cursor.seconds &&
                    (nanoseconds < cursor.nanoseconds ||
                        (nanoseconds === cursor.nanoseconds && doc.id < cursor.id))));
        })
        : matches;
    const selected = remaining.slice(0, pageSize);
    // Validate current authority at read time, so delayed cleanup triggers cannot leak withdrawn previews.
    const circles = await Promise.all(selected.map(async (doc) => {
        const data = doc.data();
        const preview = data.latestPublicTapIn;
        let latestPublicTapIn;
        if (preview?.uid && preview?.dateKey) {
            const circleRef = firebase_1.db.collection('circles').doc(doc.id);
            const [circle, checkIn, member, profile] = await Promise.all([
                circleRef.get(),
                circleRef
                    .collection('days')
                    .doc(preview.dateKey)
                    .collection('checkIns')
                    .doc(preview.uid)
                    .get(),
                circleRef.collection('members').doc(preview.uid).get(),
                firebase_1.db.collection('users').doc(preview.uid).get(),
            ]);
            const candidate = {
                ...preview,
                occurredAt: new Date(preview.occurredAt).getTime(),
            };
            if ((0, model_1.validCandidate)({
                candidate,
                circle: circle.data(),
                checkIn: checkIn.data(),
                member: member.data(),
                profile: profile.data(),
            })) {
                latestPublicTapIn = (0, model_1.publicPreview)(candidate, profile.data());
            }
        }
        return {
            id: doc.id,
            title: String(data.title),
            category: String(data.category ?? 'General'),
            commitment: String(data.commitment),
            memberCount: Math.max(0, Number(data.memberCount) || 0),
            maxSize: Math.max(1, Number(data.maxSize) || 10),
            groupStreakDays: Math.max(0, Number(data.groupStreakDays) || 0),
            joinMode: data.joinMode ?? 'request_to_join',
            ...(latestPublicTapIn ? { latestPublicTapIn } : {}),
        };
    }));
    const last = selected[selected.length - 1];
    return {
        circles,
        total: matches.length,
        categories: [
            ...new Set(categorySnapshot.docs.map(doc => String(doc.data().category ?? 'General'))),
        ].sort(),
        ...(remaining.length > pageSize && last
            ? {
                nextCursor: Buffer.from(JSON.stringify({
                    id: last.id,
                    seconds: last.data().updatedAt.seconds,
                    nanoseconds: last.data().updatedAt.nanoseconds,
                    fingerprint,
                })).toString('base64url'),
            }
            : {}),
    };
});
/** Covers create, edit, onboarding, conversion and restore without changing Home's reader. */
exports.maintainPublicCircleSearch = (0, firestore_2.onDocumentWritten)({ document: 'publicCircleIndex/{circleId}', retry: true }, async (event) => {
    const ref = index().doc(event.params.circleId);
    await firebase_1.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
            return;
        }
        const data = snapshot.data();
        const tokens = (0, model_1.searchTokens)(data);
        if (data.searchVersion === 1 &&
            JSON.stringify(data.searchTokens) === JSON.stringify(tokens)) {
            return;
        }
        transaction.update(ref, { searchVersion: 1, searchTokens: tokens });
    });
});
async function reconcilePublicActivity(circleId) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const indexRef = index().doc(circleId);
    await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, indexSnapshot, candidates] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(indexRef),
            transaction.get(circleRef
                .collection('publicTapInCandidates')
                .orderBy('occurredAt', 'desc')
                .orderBy(firestore_1.FieldPath.documentId(), 'desc')),
        ]);
        if (!indexSnapshot.exists) {
            return;
        }
        const circle = circleSnapshot.data();
        let latest;
        if ((0, model_1.isPublicActive)(circle)) {
            for (const doc of candidates.docs) {
                const candidate = doc.data();
                if (candidate.epoch !== (0, model_1.activityEpoch)(circle)) {
                    continue;
                }
                const [checkIn, member, profile] = await Promise.all([
                    transaction.get(circleRef
                        .collection('days')
                        .doc(candidate.dateKey)
                        .collection('checkIns')
                        .doc(candidate.uid)),
                    transaction.get(circleRef.collection('members').doc(candidate.uid)),
                    transaction.get(firebase_1.db.collection('users').doc(candidate.uid)),
                ]);
                if ((0, model_1.validCandidate)({
                    candidate,
                    circle,
                    checkIn: checkIn.data(),
                    member: member.data(),
                    profile: profile.data(),
                })) {
                    latest = {
                        ...(0, model_1.publicPreview)(candidate, profile.data()),
                        dateKey: candidate.dateKey,
                    };
                    break;
                }
            }
        }
        if (JSON.stringify(indexSnapshot.data()?.latestPublicTapIn) ===
            JSON.stringify(latest)) {
            return;
        }
        transaction.update(indexRef, {
            latestPublicTapIn: latest ?? firestore_1.FieldValue.delete(),
        });
    });
}
exports.projectPublicTapIn = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true }, async (event) => {
    const { circleId, dateKey, uid } = event.params;
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const checkInRef = circleRef
        .collection('days')
        .doc(dateKey)
        .collection('checkIns')
        .doc(uid);
    const candidateRef = circleRef
        .collection('publicTapInCandidates')
        .doc(`${dateKey}_${uid}`);
    await firebase_1.db.runTransaction(async (transaction) => {
        const [checkIn, circle, member, profile] = await Promise.all([
            transaction.get(checkInRef),
            transaction.get(circleRef),
            transaction.get(circleRef.collection('members').doc(uid)),
            transaction.get(firebase_1.db.collection('users').doc(uid)),
        ]);
        const marker = checkIn.data()?.publicTapIn;
        const candidate = marker ? { ...marker, dateKey, uid } : undefined;
        if (candidate &&
            (0, model_1.validCandidate)({
                candidate,
                circle: circle.data(),
                checkIn: checkIn.data(),
                member: member.data(),
                profile: profile.data(),
            })) {
            transaction.set(candidateRef, candidate);
        }
        else {
            transaction.delete(candidateRef);
        }
    });
    await reconcilePublicActivity(circleId);
});
/** Prune in bounded transactions. A privacy/rejoin change conflicts and retries the read,
 * so delayed cleanup cannot erase a newer candidate written during that transition. */
async function pruneCandidates(circleId, uid) {
    const ref = firebase_1.db.collection('circles').doc(circleId);
    let afterId;
    for (;;) {
        const page = await firebase_1.db.runTransaction(async (transaction) => {
            let query = ref
                .collection('publicTapInCandidates')
                .orderBy(firestore_1.FieldPath.documentId())
                .limit(300);
            if (uid) {
                query = query.where('uid', '==', uid);
            }
            if (afterId) {
                query = query.startAfter(afterId);
            }
            const [circle, candidates, member, profile] = await Promise.all([
                transaction.get(ref),
                transaction.get(query),
                uid ? transaction.get(ref.collection('members').doc(uid)) : undefined,
                uid ? transaction.get(firebase_1.db.collection('users').doc(uid)) : undefined,
            ]);
            for (const candidate of candidates.docs) {
                const data = candidate.data();
                if (!(0, model_1.isPublicActive)(circle.data()) ||
                    data.epoch !== (0, model_1.activityEpoch)(circle.data()) ||
                    (uid &&
                        (!profile?.exists ||
                            member?.data()?.status !== 'active' ||
                            (0, model_1.millis)(member.data()?.joinedAt) > (0, model_1.millis)(data.occurredAt)))) {
                    transaction.delete(candidate.ref);
                }
            }
            return { size: candidates.size, lastId: candidates.docs.at(-1)?.id };
        });
        if (page.size < 300) {
            return;
        }
        afterId = page.lastId;
    }
}
exports.refreshPublicActivityMembership = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}/members/{uid}', retry: true }, async (event) => {
    const { circleId, uid } = event.params;
    await pruneCandidates(circleId, uid);
    await reconcilePublicActivity(circleId);
});
exports.refreshPublicActivityCircle = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}', retry: true }, async (event) => {
    if (event.data) {
        const before = event.data.before.data();
        const after = event.data.after.data();
        // Group streak and other ordinary updates do not invalidate activity.
        if (before &&
            after &&
            (0, model_1.isPublicActive)(before) === (0, model_1.isPublicActive)(after) &&
            (0, model_1.activityEpoch)(before) === (0, model_1.activityEpoch)(after)) {
            return;
        }
    }
    await pruneCandidates(event.params.circleId);
    await reconcilePublicActivity(event.params.circleId);
});
exports.refreshPublicActivityProfile = (0, firestore_2.onDocumentWritten)({ document: 'users/{uid}', retry: true }, async (event) => {
    if (event.data) {
        const before = event.data.before.data();
        const after = event.data.after.data();
        if (before &&
            after &&
            before.displayName === after.displayName &&
            before.avatarUrl === after.avatarUrl) {
            return;
        }
    }
    const uid = event.params.uid;
    const candidates = await firebase_1.db
        .collectionGroup('publicTapInCandidates')
        .where('uid', '==', uid)
        .get();
    const circleIds = [
        ...new Set(candidates.docs.map(doc => doc.ref.parent.parent.id)),
    ];
    await Promise.all(circleIds.map(async (circleId) => {
        await pruneCandidates(circleId, uid);
        await reconcilePublicActivity(circleId);
    }));
});
