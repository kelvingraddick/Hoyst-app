import {getAuth} from 'firebase-admin/auth';
import {
  FieldPath,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {localNoon} from './model';
import {db} from '../firebase';
import {getDateKey} from '../profile/streak';
import {isMemberExpectedForSlot} from '../momentum/eligibility';
import {
  activityFromRecord,
  monthSummary,
  pageActivities,
  resolveTimezone,
  validDateKey,
  type ProgressActivity,
} from './history-model';

// Old check-ins lack an indexed effective date. Read in bounded pages without
// rewriting historical records or truncating an account's history.
async function pages(query: Query) {
  const docs: QueryDocumentSnapshot[] = [];
  let after: QueryDocumentSnapshot | undefined;
  while (true) {
    let next = query.orderBy(FieldPath.documentId()).limit(500);
    if (after) next = next.startAfter(after);
    const page = await next.get();
    docs.push(...page.docs);
    if (page.size < 500) return docs;
    after = page.docs[page.size - 1];
  }
}
async function owner(authUid?: string, idToken?: unknown) {
  if (!authUid && typeof idToken === 'string') {
    try {
      authUid = (await getAuth().verifyIdToken(idToken)).uid;
    } catch {
      throw new HttpsError('unauthenticated', 'Sign in to view your stats.');
    }
  }
  if (!authUid)
    throw new HttpsError('unauthenticated', 'Sign in to view your stats.');
  const profile = (await db.doc(`users/${authUid}`).get()).data();
  if (!profile || profile.onboardingStatus !== 'complete')
    throw new HttpsError('failed-precondition', 'Complete your profile first.');
  return {uid: authUid, timezone: resolveTimezone(profile.timezone)};
}
async function readActivity(uid: string, timezone: string, monthKey: string) {
  const [checks, opportunities, past] = await Promise.all([
    pages(db.collectionGroup('checkIns').where('uid', '==', uid)),
    pages(db.collection(`userPrivate/${uid}/opportunities`)),
    pages(db.collection(`userPrivate/${uid}/pastCircles`)),
  ]);
  const metadata = new Map<string, Record<string, any>>();
  past.forEach(doc => metadata.set(doc.data().circleId || doc.id, doc.data()));
  opportunities.forEach(doc => {
    const data = doc.data();
    if (data.circleId)
      metadata.set(data.circleId, {
        ...metadata.get(data.circleId),
        title: data.title || metadata.get(data.circleId)?.title,
      });
  });
  const circleIds = [
    ...new Set(
      checks
        .map(
          doc =>
            doc.data().circleId || doc.ref.parent.parent?.parent.parent?.id,
        )
        .filter(Boolean),
    ),
  ] as string[];
  // Circle labels are only returned for this owner's retained personal records.
  for (let i = 0; i < circleIds.length; i += 100) {
    const ids = circleIds.slice(i, i + 100);
    const docs = await db.getAll(
      ...ids.flatMap(id => [
        db.doc(`circles/${id}`),
        db.doc(`circles/${id}/members/${uid}`),
      ]),
    );
    ids.forEach((id, index) => {
      const circle = docs[index * 2];
      const member = docs[index * 2 + 1];
      // A retained check-in proves ownership of the entry, not access to a
      // private Circle's current metadata after leaving it.
      if (
        circle.exists &&
        (member.data()?.status === 'active' ||
          circle.data()?.visibility === 'public')
      ) {
        metadata.set(id, {
          ...metadata.get(id),
          title: circle.data()?.title,
          category: circle.data()?.category,
        });
      }
    });
  }
  const activities: ProgressActivity[] = [];
  const seen = new Set<string>();
  checks.forEach(doc => {
    const circleId =
      doc.data().circleId || doc.ref.parent.parent?.parent.parent?.id;
    if (!circleId || doc.data().uid !== uid) return;
    const originalDate = doc.ref.parent.parent?.id || '';
    const savedSlot = opportunities
      .find(
        slot =>
          slot.data().circleId === circleId &&
          (slot.data().completionDateKey === originalDate ||
            (doc.data().protectionKind === 'restore' &&
              slot.data().expiresDateKey === doc.data().effectiveDateKey)),
      )
      ?.data();
    const item = activityFromRecord(
      {
        id: doc.ref.path,
        circleId,
        storedDateKey: doc.ref.parent.parent?.id || '',
        data: doc.data(),
      },
      timezone,
      {
        ...metadata.get(circleId),
        cadence: savedSlot?.cadence,
        periodKey: savedSlot?.periodKey,
      },
    );
    if (item?.dateKey.startsWith(monthKey) && !seen.has(item.id)) {
      seen.add(item.id);
      activities.push(item);
    }
  });
  const today = getDateKey(new Date(), timezone);
  const candidates = opportunities.filter(doc => {
    const data = doc.data();
    return (
      data.expectedForCircle === true &&
      ['missed', 'expired', 'open'].includes(data.status) &&
      validDateKey(data.expiresDateKey || '') &&
      data.expiresDateKey <
        getDateKey(new Date(), resolveTimezone(data.timezone)) &&
      getDateKey(
        new Date(
          localNoon(data.expiresDateKey, resolveTimezone(data.timezone)),
        ),
        timezone,
      ).startsWith(monthKey)
    );
  });
  const membership = new Map<string, Record<string, any>[]>();
  for (const circleId of [
    ...new Set(candidates.map(doc => doc.data().circleId)),
  ]) {
    if (typeof circleId !== 'string' || circleId.includes('/')) continue;
    const [history, member] = await Promise.all([
      pages(
        db.collection(`circles/${circleId}/membershipHistory/${uid}/periods`),
      ),
      db.doc(`circles/${circleId}/members/${uid}`).get(),
    ]);
    membership.set(
      circleId,
      history.length
        ? history.map(doc => doc.data())
        : member.exists
        ? [member.data()!]
        : [],
    );
  }
  candidates.forEach(doc => {
    const data = doc.data();
    const zone = resolveTimezone(data.timezone);
    const slot = {
      availableDateKey: data.availableDateKey,
      expiresDateKey: data.expiresDateKey,
      periodKey: data.periodKey,
      slotIndex: data.slotIndex,
    };
    if (
      !validDateKey(slot.availableDateKey || '') ||
      !membership.get(data.circleId)?.some(
        period =>
          period.joinedAt &&
          isMemberExpectedForSlot({
            member: {...period, status: 'active'},
            slot,
            timezone: zone,
          }),
      )
    )
      return;
    // A closed stored opportunity is evidence. Never synthesize old schedules.
    const effectiveDate = getDateKey(
      new Date(localNoon(data.expiresDateKey, zone)),
      timezone,
    );
    // Coverage supersedes the gap; partial and failed entries remain visible.
    if (
      activities.some(
        item =>
          item.circleId === data.circleId &&
          item.dateKey === effectiveDate &&
          ['completed', 'skipped', 'restored'].includes(item.status),
      )
    )
      return;
    activities.push({
      id: `opportunity:${doc.id}`,
      circleId: data.circleId,
      dateKey: effectiveDate,
      title:
        metadata.get(data.circleId)?.title || data.title || 'Past commitment',
      category: metadata.get(data.circleId)?.category || 'Custom',
      status: 'missed',
      description: 'Missed opportunity',
      cadence: data.cadence || 'daily',
      periodKey: data.periodKey || data.expiresDateKey,
      sortKey: `000000000000:000000000:${doc.id}`,
    });
  });
  return {activities, today};
}
const monthSchema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    idToken: z.string().optional(),
  })
  .strict();
const daySchema = z
  .object({
    dateKey: z.string().refine(validDateKey),
    cursor: z.string().max(4096).optional(),
    idToken: z.string().optional(),
  })
  .strict();
export const getProgressMonth = onCall({timeoutSeconds: 120}, async request => {
  const account = await owner(request.auth?.uid, request.data?.idToken);
  const input = monthSchema.safeParse(request.data);
  if (!input.success)
    throw new HttpsError('invalid-argument', 'Choose a valid month.');
  if (
    input.data.monthKey > getDateKey(new Date(), account.timezone).slice(0, 7)
  )
    throw new HttpsError('invalid-argument', 'Future months are unavailable.');
  const {activities} = await readActivity(
    account.uid,
    account.timezone,
    input.data.monthKey,
  );
  return monthSummary(input.data.monthKey, account.timezone, activities);
});
export const getProgressDayActivity = onCall(
  {timeoutSeconds: 120},
  async request => {
    const account = await owner(request.auth?.uid, request.data?.idToken);
    const input = daySchema.safeParse(request.data);
    if (
      !input.success ||
      input.data.dateKey > getDateKey(new Date(), account.timezone)
    )
      throw new HttpsError(
        'invalid-argument',
        'Choose a valid past or current day.',
      );
    let after: string | undefined;
    if (input.data.cursor) {
      try {
        const cursor = JSON.parse(
          Buffer.from(input.data.cursor, 'base64url').toString(),
        );
        if (
          cursor.uid !== account.uid ||
          cursor.dateKey !== input.data.dateKey ||
          cursor.timezone !== account.timezone ||
          typeof cursor.after !== 'string'
        )
          throw new Error();
        after = cursor.after;
      } catch {
        throw new HttpsError(
          'invalid-argument',
          'This history cursor is invalid.',
        );
      }
    }
    const {activities} = await readActivity(
      account.uid,
      account.timezone,
      input.data.dateKey.slice(0, 7),
    );
    const {entries, nextSortKey} = pageActivities(
      activities.filter(item => item.dateKey === input.data.dateKey),
      after,
    );
    return {
      dateKey: input.data.dateKey,
      timezone: account.timezone,
      entries,
      nextCursor: nextSortKey
        ? Buffer.from(
            JSON.stringify({
              uid: account.uid,
              dateKey: input.data.dateKey,
              timezone: account.timezone,
              after: nextSortKey,
            }),
          ).toString('base64url')
        : null,
    };
  },
);
