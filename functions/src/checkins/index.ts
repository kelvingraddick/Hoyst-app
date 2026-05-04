import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';

import {db} from '../firebase';

const submitTapInSchema = z.object({
  circleId: z.string().trim().min(1),
  note: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().max(2048).optional(),
});
async function requireCompletedProfile(uid?: string) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const snapshot = await db.collection('users').doc(uid).get();
  const profile = snapshot.data();

  if (!profile || profile.onboardingStatus !== 'complete') {
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  }

  return {profile, uid};
}

function getDateKey(timezone: string) {
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

export const submitTapIn = onCall(async request => {
  const {profile, uid} = await requireCompletedProfile(request.auth?.uid);
  const input = submitTapInSchema.parse(request.data);
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);

    if (!circleSnapshot.exists) {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    if (memberSnapshot.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Join this circle first.');
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
      throw new HttpsError('already-exists', 'You already tapped in today.');
    }

    transaction.set(checkInRef, {
      createdAt: now,
      displayName: profile.displayName,
      handle: profile.handle,
      note: input.note ?? null,
      photoUrl: input.photoUrl ?? null,
      status: 'done',
      uid,
    });
    transaction.set(
      circleRef.collection('days').doc(dateKey),
      {
        checkInCount: FieldValue.increment(1),
        dateKey,
        updatedAt: now,
      },
      {merge: true},
    );

    return {checkInId: uid, dateKey};
  });
});
