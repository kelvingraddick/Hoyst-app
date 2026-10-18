"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCompletedTapInProof = requireCompletedTapInProof;
exports.getProofPhotoPath = getProofPhotoPath;
exports.validateProofPhoto = validateProofPhoto;
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
function requireCompletedTapInProof({ requirement, status, photoUrl, }) {
    if (requirement === 'photo' && status === 'done' && !photoUrl) {
        throw new https_1.HttpsError('failed-precondition', 'Add Photo proof to complete this Tap In. Update Hoyst if you do not see the photo option.', { reason: 'photo-proof-required' });
    }
}
/** Accept only immutable images in this member's current Tap In directory. */
function getProofPhotoPath({ photoUrl, bucketName, circleId, dateKey, uid, }) {
    const invalid = () => new https_1.HttpsError('failed-precondition', 'This photo could not be used as proof. Add the photo again for today’s Tap In.', { reason: 'invalid-photo-proof' });
    let url;
    try {
        url = new URL(photoUrl);
    }
    catch {
        throw invalid();
    }
    const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    if (!((url.protocol === 'https:' &&
        url.host === 'firebasestorage.googleapis.com') ||
        (emulator && url.protocol === 'http:' && url.host === emulator))) {
        throw invalid();
    }
    if (url.searchParams.get('alt') !== 'media' ||
        !url.searchParams.get('token')) {
        throw invalid();
    }
    const prefix = `/v0/b/${bucketName}/o/`;
    if (!url.pathname.startsWith(prefix)) {
        throw invalid();
    }
    let path;
    try {
        path = decodeURIComponent(url.pathname.slice(prefix.length));
    }
    catch {
        throw invalid();
    }
    const directory = `circles/${circleId}/check-ins/${dateKey}/${uid}/`;
    if (!path.startsWith(directory) ||
        !/^proof-[a-zA-Z0-9_-]+\.jpg$/.test(path.slice(directory.length))) {
        throw invalid();
    }
    return path;
}
async function validateProofPhoto(input) {
    const bucket = (0, storage_1.getStorage)().bucket();
    const path = getProofPhotoPath({ ...input, bucketName: bucket.name });
    const metadata = await bucket
        .file(path)
        .getMetadata()
        .then(([value]) => value)
        .catch(() => undefined);
    const tokens = metadata?.metadata?.firebaseStorageDownloadTokens?.toString().split(',') ??
        [];
    const token = new URL(input.photoUrl).searchParams.get('token') ?? '';
    if (!tokens.includes(token) ||
        !metadata?.contentType?.startsWith('image/') ||
        !Number.isFinite(Number(metadata.size)) ||
        Number(metadata.size) <= 0 ||
        Number(metadata.size) >= 10 * 1024 * 1024) {
        throw new https_1.HttpsError('failed-precondition', 'Your Photo proof has not finished uploading. Add the photo again and retry.', { reason: 'invalid-photo-proof' });
    }
}
