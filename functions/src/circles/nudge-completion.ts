import type {DocumentReference, Firestore} from 'firebase-admin/firestore';

/** Only call after notifications succeed. A group send earns one daily receipt. */
export async function recordNudgeCompletion(
  firestore: Firestore,
  memberRef: DocumentReference,
  nudged: number,
  sentAt: Date,
) {
  if (nudged <= 0) {
    return;
  }
  await firestore.runTransaction(async transaction => {
    const latest = await transaction.get(memberRef);
    const previous = latest.data()?.lastNudgedAt?.toDate?.() as
      | Date
      | undefined;
    // Concurrent sends must not move the receipt back across a day boundary.
    if (latest.exists && (!previous || previous.getTime() < sentAt.getTime())) {
      transaction.set(memberRef, {lastNudgedAt: sentAt}, {merge: true});
    }
  });
}
