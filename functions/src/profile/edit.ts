import {FieldValue} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {db} from '../firebase';

const handleSchema = z
  .string()
  .trim()
  .transform(value => value.replace(/^@+/, '').toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,20}$/));
const tintSchema = z.enum(['green', 'blue', 'purple', 'orange', 'gold']);
const updateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    handle: handleSchema.optional(),
    bio: z.string().trim().nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    profileTint: tintSchema.optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(value => {
        try {
          new Intl.DateTimeFormat('en', {timeZone: value});
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid timezone.')
      .optional(),
  })
  .strict()
  .refine(
    value => Object.keys(value).length > 0,
    'No profile changes supplied.',
  );

function requireUid(uid?: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in is required.');
  return uid;
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpsError(
      'invalid-argument',
      result.error.issues[0]?.message || 'Invalid profile changes.',
    );
  return result.data;
}
function requireComplete(profile: FirebaseFirestore.DocumentData | undefined) {
  if (profile?.onboardingStatus !== 'complete')
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
}

export const checkProfileUsername = onCall(async request => {
  const uid = requireUid(request.auth?.uid);
  const handle = parse(handleSchema, request.data?.handle);
  const [user, candidate] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`handles/${handle}`).get(),
  ]);
  requireComplete(user.data());
  return {
    handle,
    available: !candidate.exists || candidate.data()?.uid === uid,
  };
});

export const updateProfile = onCall(async request => {
  const uid = requireUid(request.auth?.uid);
  const payload = {...request.data};
  delete payload.idToken;
  const input = parse(updateSchema, payload);
  const userRef = db.doc(`users/${uid}`);
  const profile = await db.runTransaction(async transaction => {
    const user = await transaction.get(userRef);
    const previous = user.data();
    requireComplete(previous);
    const oldHandle = previous!.handle as string;
    const newHandle = input.handle ?? oldHandle;
    if (newHandle !== oldHandle) {
      const nextRef = db.doc(`handles/${newHandle}`);
      const oldRef = db.doc(`handles/${oldHandle}`);
      const [candidate, oldClaim] = await Promise.all([
        transaction.get(nextRef),
        transaction.get(oldRef),
      ]);
      if (candidate.exists && candidate.data()?.uid !== uid)
        throw new HttpsError(
          'already-exists',
          'That username is already taken.',
        );
      transaction.set(nextRef, {
        uid,
        handle: newHandle,
        createdAt: FieldValue.serverTimestamp(),
      });
      // Never delete a claim owned by a different account, even for legacy inconsistent data.
      if (oldClaim.data()?.uid === uid) transaction.delete(oldRef);
    }
    const updates = {...input, updatedAt: FieldValue.serverTimestamp()};
    transaction.update(userRef, updates);
    return {
      id: uid,
      name: input.displayName ?? previous!.displayName,
      handle: newHandle,
      bio: input.bio !== undefined ? input.bio || null : previous!.bio ?? null,
      avatarUrl:
        input.avatarUrl !== undefined
          ? input.avatarUrl
          : previous!.avatarUrl ?? null,
      profileTint: input.profileTint ?? previous!.profileTint ?? 'green',
      timezone: input.timezone ?? previous!.timezone ?? 'UTC',
      onboardingStatus: 'complete' as const,
    };
  });
  return {profile};
});

/** Project current identity only. Historical thread/inbox actors remain immutable snapshots. */
export const refreshMemberProfile = onDocumentWritten(
  {document: 'users/{uid}', retry: true},
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (
      !after ||
      (before &&
        before.displayName === after.displayName &&
        before.handle === after.handle &&
        before.avatarUrl === after.avatarUrl)
    )
      return;
    const uid = event.params.uid;
    const members = await db
      .collectionGroup('members')
      .where('uid', '==', uid)
      .get();
    const refs = members.docs
      .filter(
        doc =>
          doc.id === uid &&
          /^circles\/[^/]+\/members\/[^/]+$/.test(doc.ref.path),
      )
      .map(doc => doc.ref);
    // Read the latest identity inside each transaction to make replay/out-of-order events safe.
    for (let index = 0; index < refs.length; index += 400) {
      await db.runTransaction(async transaction => {
        const latest = await transaction.get(db.doc(`users/${uid}`));
        if (!latest.exists) return;
        const live = await Promise.all(
          refs.slice(index, index + 400).map(ref => transaction.get(ref)),
        );
        const identity = latest.data()!;
        for (const member of live)
          if (member.exists)
            transaction.update(member.ref, {
              displayName: identity.displayName,
              handle: identity.handle,
              avatarUrl: identity.avatarUrl ?? null,
            });
      });
    }
  },
);
