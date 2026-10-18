import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {db} from '../firebase';
import {LEGAL_VERSION} from '../shared/legal';

export const acceptLegalTerms = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in is required.');
  if (
    request.data?.adult !== true ||
    request.data?.termsVersion !== LEGAL_VERSION ||
    request.data?.privacyVersion !== LEGAL_VERSION
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Confirm you are 18 or older and agree to the current Terms.',
    );
  }
  await db.runTransaction(async transaction => {
    const [profile, deletion] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(db.doc(`accountDeletions/${uid}`)),
    ]);
    if (deletion.exists || profile.data()?.accountDeletionStartedAt) {
      throw new HttpsError(
        'failed-precondition',
        'Account deletion is in progress.',
      );
    }
    transaction.set(
      db.doc(`userPrivate/${uid}`),
      {
        legalAcceptance: {
          adult: true,
          termsVersion: LEGAL_VERSION,
          privacyVersion: LEGAL_VERSION,
          acceptedAt: FieldValue.serverTimestamp(),
        },
      },
      {merge: true},
    );
  });
  return {accepted: true};
});
