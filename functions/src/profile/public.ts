import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {db} from '../firebase';

/** An allowlist, never a copy of an account document. */
export function publicProfile(profile: FirebaseFirestore.DocumentData) {
  return {
    displayName:
      typeof profile.displayName === 'string' ? profile.displayName : '',
    handle: typeof profile.handle === 'string' ? profile.handle : '',
    avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
    bio: typeof profile.bio === 'string' ? profile.bio : null,
  };
}

export async function syncPublicProfile(uid: string) {
  // Read the latest account in the transaction so retries and old events cannot
  // republish a deleted identity or overwrite a newer profile.
  await db.runTransaction(async transaction => {
    const account = await transaction.get(db.doc(`users/${uid}`));
    const profile = account.data();
    const target = db.doc(`publicProfiles/${uid}`);
    if (
      !profile ||
      profile.accountDeletionStartedAt ||
      profile.onboardingStatus !== 'complete'
    ) {
      transaction.delete(target);
    } else {
      transaction.set(target, publicProfile(profile));
    }
  });
}

export const refreshPublicProfile = onDocumentWritten(
  {document: 'users/{uid}', retry: true},
  event => syncPublicProfile(event.params.uid),
);
