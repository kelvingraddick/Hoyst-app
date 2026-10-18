"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptLegalTerms = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const legal_1 = require("../shared/legal");
exports.acceptLegalTerms = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    if (request.data?.adult !== true ||
        request.data?.termsVersion !== legal_1.LEGAL_VERSION ||
        request.data?.privacyVersion !== legal_1.LEGAL_VERSION) {
        throw new https_1.HttpsError('invalid-argument', 'Confirm you are 18 or older and agree to the current Terms.');
    }
    await firebase_1.db.runTransaction(async (transaction) => {
        const [profile, deletion] = await Promise.all([
            transaction.get(firebase_1.db.doc(`users/${uid}`)),
            transaction.get(firebase_1.db.doc(`accountDeletions/${uid}`)),
        ]);
        if (deletion.exists || profile.data()?.accountDeletionStartedAt) {
            throw new https_1.HttpsError('failed-precondition', 'Account deletion is in progress.');
        }
        transaction.set(firebase_1.db.doc(`userPrivate/${uid}`), {
            legalAcceptance: {
                adult: true,
                termsVersion: legal_1.LEGAL_VERSION,
                privacyVersion: legal_1.LEGAL_VERSION,
                acceptedAt: firestore_1.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
    });
    return { accepted: true };
});
