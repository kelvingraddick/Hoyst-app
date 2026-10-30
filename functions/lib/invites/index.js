"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitePage = exports.rotateCircleInvite = exports.resolveCircleInvite = void 0;
const page_1 = require("./page");
const page_2 = require("../website/page");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const invite_code_1 = require("../shared/invite-code");
const resolveInviteSchema = zod_1.z.object({
    inviteCode: zod_1.z.string().trim(),
});
const rotateInviteSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
async function findCircleInvite(inviteCode) {
    const snapshots = await firebase_1.db
        .collection('circles')
        .where('inviteCode', '==', inviteCode)
        .limit(2)
        .get();
    if (snapshots.size !== 1) {
        if (snapshots.size > 1) {
            console.error('circle_invite_lookup_ambiguous', {
                matchingCircleCount: snapshots.size,
            });
        }
        return undefined;
    }
    const snapshot = snapshots.docs[0];
    return (0, invite_code_1.buildCircleInvitePreview)(snapshot.id, snapshot.data());
}
async function createUniqueInviteCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const inviteCode = (0, invite_code_1.createInviteCode)();
        const existing = await firebase_1.db
            .collection('circles')
            .where('inviteCode', '==', inviteCode)
            .limit(1)
            .get();
        if (existing.empty) {
            return inviteCode;
        }
    }
    throw new https_1.HttpsError('internal', 'Could not create a unique invite link. Try again.');
}
function parseInviteCodeFromPath(path) {
    const match = path.match(/(?:^|\/)join\/([^/?#]+)/i);
    if (!match?.[1]) {
        return undefined;
    }
    try {
        return (0, invite_code_1.normalizeInviteCode)(decodeURIComponent(match[1]));
    }
    catch {
        return undefined;
    }
}
function renderUnavailablePage() {
    return (0, page_1.renderInvitePage)({
        description: 'This Circle invitation is no longer available. Ask the Circle owner for a new link.',
        statusCode: 404,
        title: 'Invite no longer available',
    });
}
exports.resolveCircleInvite = (0, https_1.onCall)(async (request) => {
    const input = resolveInviteSchema.parse(request.data);
    const inviteCode = (0, invite_code_1.normalizeInviteCode)(input.inviteCode);
    if (!inviteCode) {
        throw new https_1.HttpsError('not-found', 'Invite no longer available.');
    }
    const preview = await findCircleInvite(inviteCode);
    if (!preview) {
        throw new https_1.HttpsError('not-found', 'Invite no longer available.');
    }
    if (request.auth?.uid) {
        const membership = await firebase_1.db
            .collection('circles')
            .doc(preview.circleId)
            .collection('members')
            .doc(request.auth.uid)
            .get();
        const status = membership.data()?.status;
        return {
            ...preview,
            viewerUid: request.auth.uid,
            ...(status === 'active' || status === 'pending'
                ? { viewerMembershipStatus: status }
                : {}),
        };
    }
    return preview;
});
exports.rotateCircleInvite = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const input = rotateInviteSchema.parse(request.data);
    const inviteCode = await createUniqueInviteCode();
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        const circle = circleSnapshot.data();
        const member = memberSnapshot.data();
        if (!circleSnapshot.exists || !circle || circle.circleMode === 'personal') {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        (0, circle_lifecycle_1.ensureActiveCircle)(circle, 'resetting its invite link');
        if (circle.ownerId !== uid ||
            member?.role !== 'owner' ||
            member.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Only the Circle owner can reset its invite link.');
        }
        transaction.update(circleRef, {
            inviteCode,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return {
        inviteCode,
        inviteUrl: (0, invite_code_1.getCircleInviteUrl)(inviteCode),
    };
});
exports.invitePage = (0, https_1.onRequest)(async (request, response) => {
    response.set(page_2.websiteHeaders);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.status(405).send(renderUnavailablePage());
        return;
    }
    const inviteCode = parseInviteCodeFromPath(request.path);
    if (!inviteCode) {
        response.status(404).send(renderUnavailablePage());
        return;
    }
    const preview = await findCircleInvite(inviteCode);
    if (!preview) {
        response.status(404).send(renderUnavailablePage());
        return;
    }
    response.status(200).send((0, page_1.renderInvitePage)({
        description: `${preview.commitment} · ${preview.cadenceLabel}`,
        inviteCode,
        preview,
        statusCode: 200,
        title: `Join ${preview.title} on Hoyst`,
    }));
});
