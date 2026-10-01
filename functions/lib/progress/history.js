"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgressDayActivity = exports.getProgressMonth = void 0;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const model_1 = require("./model");
const firebase_1 = require("../firebase");
const streak_1 = require("../profile/streak");
const eligibility_1 = require("../momentum/eligibility");
const history_model_1 = require("./history-model");
// Old check-ins lack an indexed effective date. Read in bounded pages without
// rewriting historical records or truncating an account's history.
async function pages(query) {
    const docs = [];
    let after;
    while (true) {
        let next = query.orderBy(firestore_1.FieldPath.documentId()).limit(500);
        if (after)
            next = next.startAfter(after);
        const page = await next.get();
        docs.push(...page.docs);
        if (page.size < 500)
            return docs;
        after = page.docs[page.size - 1];
    }
}
async function owner(authUid, idToken) {
    if (!authUid && typeof idToken === 'string') {
        try {
            authUid = (await (0, auth_1.getAuth)().verifyIdToken(idToken)).uid;
        }
        catch {
            throw new https_1.HttpsError('unauthenticated', 'Sign in to view your stats.');
        }
    }
    if (!authUid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to view your stats.');
    const profile = (await firebase_1.db.doc(`users/${authUid}`).get()).data();
    if (!profile || profile.onboardingStatus !== 'complete')
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    return { uid: authUid, timezone: (0, history_model_1.resolveTimezone)(profile.timezone) };
}
async function readActivity(uid, timezone, monthKey) {
    const [checks, opportunities, past] = await Promise.all([
        pages(firebase_1.db.collectionGroup('checkIns').where('uid', '==', uid)),
        pages(firebase_1.db.collection(`userPrivate/${uid}/opportunities`)),
        pages(firebase_1.db.collection(`userPrivate/${uid}/pastCircles`)),
    ]);
    const metadata = new Map();
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
        ...new Set(checks
            .map(doc => doc.data().circleId || doc.ref.parent.parent?.parent.parent?.id)
            .filter(Boolean)),
    ];
    // Circle labels are only returned for this owner's retained personal records.
    for (let i = 0; i < circleIds.length; i += 100) {
        const ids = circleIds.slice(i, i + 100);
        const docs = await firebase_1.db.getAll(...ids.flatMap(id => [
            firebase_1.db.doc(`circles/${id}`),
            firebase_1.db.doc(`circles/${id}/members/${uid}`),
        ]));
        ids.forEach((id, index) => {
            const circle = docs[index * 2];
            const member = docs[index * 2 + 1];
            // A retained check-in proves ownership of the entry, not access to a
            // private Circle's current metadata after leaving it.
            if (circle.exists &&
                (member.data()?.status === 'active' ||
                    circle.data()?.visibility === 'public')) {
                metadata.set(id, {
                    ...metadata.get(id),
                    title: circle.data()?.title,
                    category: circle.data()?.category,
                });
            }
        });
    }
    const activities = [];
    const seen = new Set();
    checks.forEach(doc => {
        const circleId = doc.data().circleId || doc.ref.parent.parent?.parent.parent?.id;
        if (!circleId || doc.data().uid !== uid)
            return;
        const originalDate = doc.ref.parent.parent?.id || '';
        const savedSlot = opportunities
            .find(slot => slot.data().circleId === circleId &&
            (slot.data().completionDateKey === originalDate ||
                (doc.data().protectionKind === 'restore' &&
                    slot.data().expiresDateKey === doc.data().effectiveDateKey)))
            ?.data();
        const item = (0, history_model_1.activityFromRecord)({
            id: doc.ref.path,
            circleId,
            storedDateKey: doc.ref.parent.parent?.id || '',
            data: doc.data(),
        }, timezone, {
            ...metadata.get(circleId),
            cadence: savedSlot?.cadence,
            periodKey: savedSlot?.periodKey,
        });
        if (item?.dateKey.startsWith(monthKey) && !seen.has(item.id)) {
            seen.add(item.id);
            activities.push(item);
        }
    });
    const today = (0, streak_1.getDateKey)(new Date(), timezone);
    const candidates = opportunities.filter(doc => {
        const data = doc.data();
        return (data.expectedForCircle === true &&
            ['missed', 'expired', 'open'].includes(data.status) &&
            (0, history_model_1.validDateKey)(data.expiresDateKey || '') &&
            data.expiresDateKey <
                (0, streak_1.getDateKey)(new Date(), (0, history_model_1.resolveTimezone)(data.timezone)) &&
            (0, streak_1.getDateKey)(new Date((0, model_1.localNoon)(data.expiresDateKey, (0, history_model_1.resolveTimezone)(data.timezone))), timezone).startsWith(monthKey));
    });
    const membership = new Map();
    for (const circleId of [
        ...new Set(candidates.map(doc => doc.data().circleId)),
    ]) {
        if (typeof circleId !== 'string' || circleId.includes('/'))
            continue;
        const [history, member] = await Promise.all([
            pages(firebase_1.db.collection(`circles/${circleId}/membershipHistory/${uid}/periods`)),
            firebase_1.db.doc(`circles/${circleId}/members/${uid}`).get(),
        ]);
        membership.set(circleId, history.length
            ? history.map(doc => doc.data())
            : member.exists
                ? [member.data()]
                : []);
    }
    candidates.forEach(doc => {
        const data = doc.data();
        const zone = (0, history_model_1.resolveTimezone)(data.timezone);
        const slot = {
            availableDateKey: data.availableDateKey,
            expiresDateKey: data.expiresDateKey,
            periodKey: data.periodKey,
            slotIndex: data.slotIndex,
        };
        if (!(0, history_model_1.validDateKey)(slot.availableDateKey || '') ||
            !membership.get(data.circleId)?.some(period => period.joinedAt &&
                (0, eligibility_1.isMemberExpectedForSlot)({
                    member: { ...period, status: 'active' },
                    slot,
                    timezone: zone,
                })))
            return;
        // A closed stored opportunity is evidence. Never synthesize old schedules.
        const effectiveDate = (0, streak_1.getDateKey)(new Date((0, model_1.localNoon)(data.expiresDateKey, zone)), timezone);
        // Coverage supersedes the gap; partial and failed entries remain visible.
        if (activities.some(item => item.circleId === data.circleId &&
            item.dateKey === effectiveDate &&
            ['completed', 'skipped', 'restored'].includes(item.status)))
            return;
        activities.push({
            id: `opportunity:${doc.id}`,
            circleId: data.circleId,
            dateKey: effectiveDate,
            title: metadata.get(data.circleId)?.title || data.title || 'Past commitment',
            category: metadata.get(data.circleId)?.category || 'Custom',
            status: 'missed',
            description: 'Missed opportunity',
            cadence: data.cadence || 'daily',
            periodKey: data.periodKey || data.expiresDateKey,
            sortKey: `000000000000:000000000:${doc.id}`,
        });
    });
    return { activities, today };
}
const monthSchema = zod_1.z
    .object({
    monthKey: zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    idToken: zod_1.z.string().optional(),
})
    .strict();
const daySchema = zod_1.z
    .object({
    dateKey: zod_1.z.string().refine(history_model_1.validDateKey),
    cursor: zod_1.z.string().max(4096).optional(),
    idToken: zod_1.z.string().optional(),
})
    .strict();
exports.getProgressMonth = (0, https_1.onCall)({ timeoutSeconds: 120 }, async (request) => {
    const account = await owner(request.auth?.uid, request.data?.idToken);
    const input = monthSchema.safeParse(request.data);
    if (!input.success)
        throw new https_1.HttpsError('invalid-argument', 'Choose a valid month.');
    if (input.data.monthKey > (0, streak_1.getDateKey)(new Date(), account.timezone).slice(0, 7))
        throw new https_1.HttpsError('invalid-argument', 'Future months are unavailable.');
    const { activities } = await readActivity(account.uid, account.timezone, input.data.monthKey);
    return (0, history_model_1.monthSummary)(input.data.monthKey, account.timezone, activities);
});
exports.getProgressDayActivity = (0, https_1.onCall)({ timeoutSeconds: 120 }, async (request) => {
    const account = await owner(request.auth?.uid, request.data?.idToken);
    const input = daySchema.safeParse(request.data);
    if (!input.success ||
        input.data.dateKey > (0, streak_1.getDateKey)(new Date(), account.timezone))
        throw new https_1.HttpsError('invalid-argument', 'Choose a valid past or current day.');
    let after;
    if (input.data.cursor) {
        try {
            const cursor = JSON.parse(Buffer.from(input.data.cursor, 'base64url').toString());
            if (cursor.uid !== account.uid ||
                cursor.dateKey !== input.data.dateKey ||
                cursor.timezone !== account.timezone ||
                typeof cursor.after !== 'string')
                throw new Error();
            after = cursor.after;
        }
        catch {
            throw new https_1.HttpsError('invalid-argument', 'This history cursor is invalid.');
        }
    }
    const { activities } = await readActivity(account.uid, account.timezone, input.data.dateKey.slice(0, 7));
    const { entries, nextSortKey } = (0, history_model_1.pageActivities)(activities.filter(item => item.dateKey === input.data.dateKey), after);
    return {
        dateKey: input.data.dateKey,
        timezone: account.timezone,
        entries,
        nextCursor: nextSortKey
            ? Buffer.from(JSON.stringify({
                uid: account.uid,
                dateKey: input.data.dateKey,
                timezone: account.timezone,
                after: nextSortKey,
            })).toString('base64url')
            : null,
    };
});
