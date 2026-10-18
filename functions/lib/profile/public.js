"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshPublicProfile = void 0;
exports.publicProfile = publicProfile;
exports.syncPublicProfile = syncPublicProfile;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_1 = require("../firebase");
/** An allowlist, never a copy of an account document. */
function publicProfile(profile) {
    return {
        displayName: typeof profile.displayName === 'string' ? profile.displayName : '',
        handle: typeof profile.handle === 'string' ? profile.handle : '',
        avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
        bio: typeof profile.bio === 'string' ? profile.bio : null,
    };
}
async function syncPublicProfile(uid) {
    // Read the latest account in the transaction so retries and old events cannot
    // republish a deleted identity or overwrite a newer profile.
    await firebase_1.db.runTransaction(async (transaction) => {
        const account = await transaction.get(firebase_1.db.doc(`users/${uid}`));
        const profile = account.data();
        const target = firebase_1.db.doc(`publicProfiles/${uid}`);
        if (!profile ||
            profile.accountDeletionStartedAt ||
            profile.onboardingStatus !== 'complete') {
            transaction.delete(target);
        }
        else {
            transaction.set(target, publicProfile(profile));
        }
    });
}
exports.refreshPublicProfile = (0, firestore_1.onDocumentWritten)({ document: 'users/{uid}', retry: true }, event => syncPublicProfile(event.params.uid));
