import {Timestamp} from 'firebase-admin/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {db} from '../firebase';

export async function deleteGreetingData(uid: string) {
  const [caches, usage] = await Promise.all([
    db.collection('homeGreetingCache').where('ownerUid', '==', uid).get(),
    db.collectionGroup('users').where('uid', '==', uid).get(),
  ]);
  const refs = [
    ...caches.docs,
    ...usage.docs.filter(doc =>
      /^homeGreetingUsage\/[^/]+\/users\/[^/]+$/.test(doc.ref.path),
    ),
  ];
  for (let index = 0; index < refs.length; index += 400) {
    const batch = db.batch();
    refs.slice(index, index + 400).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

/** Also expires legacy cache entries that predate ownerUid tagging. */
export async function expireGreetingData(now = Date.now()) {
  const cutoff = Timestamp.fromMillis(now - 48 * 60 * 60 * 1000);
  for (const collection of ['homeGreetingCache', 'homeGreetingUsage']) {
    for (let page = 0; page < 10; page++) {
      const expired = await db
        .collection(collection)
        .where('updatedAt', '<=', cutoff)
        .limit(100)
        .get();
      if (expired.empty) break;
      for (const doc of expired.docs) await db.recursiveDelete(doc.ref);
    }
  }
}
export const expireHomeGreetingData = onSchedule('every 60 minutes', () =>
  expireGreetingData(),
);
