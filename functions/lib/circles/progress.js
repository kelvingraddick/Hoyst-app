"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileCircleProgressRollover = exports.reconcileCircleProgressConfiguration = exports.reconcileCircleProgressMembership = exports.reconcileCircleProgressCheckIn = exports.refreshCircleProgress = void 0;
exports.readCircleProgressSources = readCircleProgressSources;
exports.calculateCircleProgress = calculateCircleProgress;
exports.reconcileCircleProgress = reconcileCircleProgress;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_1 = require("../firebase");
const commitments_1 = require("../shared/commitments");
const circle_progress_1 = require("../shared/circle-progress");
function date(value, timezone) {
    const stamp = value;
    const parsed = value instanceof Date ? value : stamp?.toDate?.();
    return parsed ? (0, circle_progress_1.circleDateKey)(timezone, parsed) : undefined;
}
async function readCircleProgressSources(circleId) {
    const ref = firebase_1.db.collection('circles').doc(circleId);
    const [snapshot, members, histories, days, lifecycle, existingPeriods] = await Promise.all([
        ref.get(),
        ref.collection('members').get(),
        ref.collection('membershipHistory').get(),
        ref.collection('days').get(),
        ref.collection('lifecycleHistory').orderBy('at').get(),
        ref.collection('progressPeriods').get(),
    ]);
    if (!snapshot.exists) {
        return undefined;
    }
    const circle = snapshot.data();
    const config = (0, circle_progress_1.circleProgressConfiguration)(circle);
    const periods = await Promise.all(histories.docs.map(history => history.ref.collection('periods').get()));
    const spans = [];
    periods.forEach((period, index) => period.docs.forEach(entry => {
        const data = entry.data();
        const joined = date(data.joinedAt, config.timezone);
        if (!joined) {
            return;
        }
        spans.push({
            uid: data.uid || histories.docs[index].id,
            start: data.opportunityEligibility === 'include_current'
                ? joined
                : (0, circle_progress_1.shiftCircleDate)(joined, 1),
            end: date(data.leftAt, config.timezone),
            runId: entry.id,
        });
    }));
    // A current membership proves its own run, but not an entire historical group cohort.
    const historiesKnown = members.docs.every(member => member.data().status === 'pending' ||
        spans.some(span => span.uid === member.id));
    for (const member of members.docs) {
        const data = member.data();
        if (data.status === 'pending' ||
            spans.some(span => span.uid === member.id)) {
            continue;
        }
        const joined = date(data.joinedAt, config.timezone);
        if (joined) {
            spans.push({
                uid: member.id,
                start: data.opportunityEligibility === 'include_current'
                    ? joined
                    : (0, circle_progress_1.shiftCircleDate)(joined, 1),
                end: date(data.leftAt, config.timezone),
                runId: 'legacy',
            });
        }
    }
    const created = date(circle.createdAt, config.timezone);
    const start = created ?? spans.map(span => span.start).sort()[0];
    const intervals = start ? [{ start }] : [];
    let lifecycleKnown = true;
    if (lifecycle.empty &&
        (circle.lastArchivedAt || circle.opportunitiesResumeAfterDateKey)) {
        // Only the latest legacy pause is provable. Do not invent earlier active intervals.
        lifecycleKnown = false;
        intervals.splice(0);
        if (typeof circle.opportunitiesResumeAfterDateKey === 'string') {
            intervals.push({
                start: (0, circle_progress_1.shiftCircleDate)(circle.opportunitiesResumeAfterDateKey, 1),
            });
        }
    }
    else {
        for (const event of lifecycle.docs) {
            const data = event.data();
            if (data.historyKnownBefore === false) {
                lifecycleKnown = false;
            }
            const at = date(data.at, config.timezone);
            if (!at) {
                continue;
            }
            if (data.status === 'archived') {
                const open = intervals[intervals.length - 1];
                if (open && !open.end) {
                    open.end = at;
                }
            }
            else if (data.status === 'active' &&
                intervals[intervals.length - 1]?.end) {
                intervals.push({ start: (0, circle_progress_1.shiftCircleDate)(at, 1) });
            }
        }
    }
    if (circle.lifecycleStatus === 'archived') {
        const open = intervals[intervals.length - 1];
        if (open && !open.end) {
            open.end = date(circle.archivedAt, config.timezone);
        }
    }
    const checks = await Promise.all(days.docs.map(day => day.ref.collection('checkIns').get()));
    const byDate = new Map();
    checks.forEach((snapshot, index) => byDate.set(days.docs[index].id, new Map(snapshot.docs.map(check => [
        check.data().uid || check.id,
        check.data(),
    ]))));
    return {
        ref,
        circle,
        config,
        members,
        spans,
        intervals,
        byDate,
        start,
        historiesKnown: historiesKnown &&
            (members.docs.some(member => member.data().status === 'active') ||
                Number(circle.memberCount ?? 0) === 0) &&
            Array.from(byDate.values()).every(values => Array.from(values.keys()).every(uid => spans.some(span => span.uid === uid))) &&
            histories.docs.every((history, index) => {
                const first = date(history.data().firstJoinedAt, config.timezone);
                return (!first ||
                    periods[index].docs.some(period => {
                        const joined = date(period.data().joinedAt, config.timezone);
                        return joined && joined <= first;
                    }));
            }),
        lifecycleKnown,
        existingPeriods,
        existingDays: new Map(days.docs.map(day => [day.id, day.data().activityCoverage])),
    };
}
function calculateCircleProgress(sources, now = new Date()) {
    const { circle, config, spans, intervals, byDate, start, historiesKnown, lifecycleKnown, } = sources;
    const today = (0, circle_progress_1.circleDateKey)(config.timezone, now);
    const currentPeriod = (0, circle_progress_1.circlePeriodForDate)(today, config.cadence);
    const periodKeys = new Map();
    if (start) {
        for (const key of (0, circle_progress_1.circleDates)(start, today)) {
            const period = (0, circle_progress_1.circlePeriodForDate)(key, config.cadence);
            periodKeys.set(period.key, period);
        }
    }
    periodKeys.set(currentPeriod.key, currentPeriod);
    const periods = Array.from(periodKeys.values()).sort((a, b) => a.start.localeCompare(b.start));
    const uids = Array.from(new Set(spans.map(span => span.uid)));
    const coveredByUid = new Map(uids.map(uid => [
        uid,
        new Set(Array.from(byDate)
            .filter(([, values]) => (0, commitments_1.isCoveredCheckInData)(values.get(uid)))
            .map(([key]) => key)),
    ]));
    const personalPeriods = spans.flatMap(span => periods
        .filter(period => period.end >= span.start && (!span.end || period.start < span.end))
        .map(period => ({
        ...(0, circle_progress_1.evaluateMemberPeriod)({
            period,
            uid: span.uid,
            spans: [span],
            intervals,
            target: config.target,
            coveredDates: coveredByUid.get(span.uid),
            today,
            known: lifecycleKnown,
        }),
        runId: span.runId,
    })));
    const evaluateRuns = (uid, period, activity) => {
        const runs = spans
            .filter(span => span.uid === uid)
            .map(span => (0, circle_progress_1.evaluateMemberPeriod)({
            period,
            uid,
            spans: [span],
            intervals: activity,
            target: config.target,
            coveredDates: coveredByUid.get(uid),
            today,
            known: lifecycleKnown,
        }));
        const required = runs.filter(run => run.outcome !== 'neutral');
        return {
            ...period,
            uid,
            required: required.reduce((sum, run) => sum + run.required, 0),
            covered: required.reduce((sum, run) => sum + run.covered, 0),
            remaining: required.reduce((sum, run) => sum + run.remaining, 0),
            outcome: (0, circle_progress_1.groupPeriodOutcome)(runs, lifecycleKnown),
        };
    };
    const results = periods.map(period => ({
        period,
        members: uids.map(uid => evaluateRuns(uid, period, intervals)),
    }));
    const conversion = date(circle.convertedAt, config.timezone);
    const groupIntervals = conversion
        ? intervals.map(interval => ({
            ...interval,
            start: interval.start < conversion ? conversion : interval.start,
        }))
        : intervals;
    const groupResults = results.map(({ period }) => {
        const members = uids.map(uid => evaluateRuns(uid, period, groupIntervals));
        return {
            ...period,
            members,
            outcome: (0, circle_progress_1.groupPeriodOutcome)(members, historiesKnown && lifecycleKnown),
        };
    });
    const unit = (0, circle_progress_1.circleStreakUnit)(config.cadence);
    const base = {
        version: 2,
        revision: config.revision,
        asOfDateKey: today,
        cadence: config.cadence,
        period: currentPeriod,
    };
    const latestGroup = groupResults[groupResults.length - 1];
    const expected = latestGroup.members.filter(member => member.required > 0 && member.outcome !== 'neutral');
    const group = {
        ...base,
        streak: (0, circle_progress_1.countCirclePeriodStreak)(groupResults, unit),
        progress: {
            covered: expected.filter(member => member.outcome === 'secured').length,
            required: expected.length,
            outcome: latestGroup.outcome,
        },
    };
    const viewers = new Map();
    for (const uid of uids) {
        const latestRun = spans
            .filter(span => span.uid === uid)
            .sort((a, b) => b.start.localeCompare(a.start))[0];
        const runSpans = spans.filter(span => span.uid === uid && span.runId === latestRun.runId);
        const memberPeriods = periods.map(period => (0, circle_progress_1.evaluateMemberPeriod)({
            period,
            uid,
            spans: runSpans,
            intervals,
            target: config.target,
            coveredDates: coveredByUid.get(uid),
            today,
            known: lifecycleKnown,
        }));
        const latest = memberPeriods[memberPeriods.length - 1];
        viewers.set(uid, {
            ...base,
            streak: (0, circle_progress_1.countCirclePeriodStreak)(memberPeriods, unit),
            progress: {
                covered: latest.covered,
                required: latest.required,
                outcome: latest.outcome,
            },
        });
    }
    const daily = new Map();
    for (const day of (0, circle_progress_1.circleDates)(start ?? today, today)) {
        const values = byDate.get(day);
        const expectedUids = uids.filter(uid => (0, circle_progress_1.isCircleDateEligible)(day, spans.filter(span => span.uid === uid), intervals, (0, commitments_1.isCoveredCheckInData)(values?.get(uid))));
        const covered = expectedUids.filter(uid => (0, commitments_1.isCoveredCheckInData)(values?.get(uid)));
        daily.set(day, {
            known: historiesKnown && lifecycleKnown && expectedUids.length > 0,
            expectedUids,
            completedUids: covered.filter(uid => values?.get(uid)?.status === 'done'),
            skippedUids: covered.filter(uid => values?.get(uid)?.status === 'skip'),
            restoredUids: covered.filter(uid => values?.get(uid)?.protectionKind === 'restore'),
        });
    }
    return { group, viewers, daily, results, groupResults, personalPeriods };
}
async function reconcileCircleProgress({ circleId, uid, now = new Date(), phase = 'all', commit = true, }) {
    const lock = firebase_1.db.collection('circleProgressSources').doc(circleId);
    const token = (0, node_crypto_1.randomUUID)();
    if (commit) {
        await lock.set({ token, startedAt: firestore_1.FieldValue.serverTimestamp() });
    }
    const sources = await readCircleProgressSources(circleId);
    if (!sources) {
        return undefined;
    }
    const computed = calculateCircleProgress(sources, now);
    const writes = [];
    const updatedAt = firestore_1.FieldValue.serverTimestamp();
    if (phase === 'all' || phase === 'daily-coverage') {
        computed.daily.forEach((coverage, day) => {
            if (JSON.stringify(sources.existingDays.get(day)) !==
                JSON.stringify(coverage)) {
                writes.push({
                    ref: sources.ref.collection('days').doc(day),
                    data: { activityCoverage: coverage },
                });
            }
        });
    }
    if (phase === 'all' || phase === 'period-outcomes') {
        const existingPeriods = new Map(sources.existingPeriods.docs.map(period => [period.id, period.data()]));
        const personalFingerprint = (key) => (0, node_crypto_1.createHash)('sha256')
            .update(JSON.stringify(computed.personalPeriods.filter(period => period.key === key)))
            .digest('hex');
        computed.results.forEach(({ period }) => {
            if (existingPeriods.get(period.key)?.personalResultsFingerprint ===
                personalFingerprint(period.key) &&
                existingPeriods.get(period.key)?.revision === sources.config.revision) {
                return;
            }
            computed.personalPeriods
                .filter(member => member.key === period.key)
                .forEach(member => writes.push({
                ref: firebase_1.db.doc(`userPrivate/${member.uid}/circlePeriods/${circleId}_${member.runId}_${period.key}`),
                data: {
                    ...member,
                    target: member.required,
                    coveredCount: member.covered,
                    cadence: sources.config.cadence,
                    circleId,
                    evidenceAvailability: member.outcome === 'unknown' ? 'unavailable' : 'known',
                    revision: sources.config.revision,
                    updatedAt,
                },
            }));
        });
        computed.groupResults.forEach((period, index) => {
            const memberResultsFingerprint = JSON.stringify(computed.results[index].members);
            const previous = existingPeriods.get(period.key);
            if (previous?.revision === sources.config.revision &&
                previous?.outcome === period.outcome &&
                previous?.memberResultsFingerprint === memberResultsFingerprint &&
                previous?.personalResultsFingerprint === personalFingerprint(period.key)) {
                return;
            }
            writes.push({
                ref: sources.ref.collection('progressPeriods').doc(period.key),
                data: {
                    ...period,
                    cadence: sources.config.cadence,
                    target: period.members.filter(member => member.required > 0 && member.outcome !== 'neutral').length,
                    coveredCount: period.members.filter(member => member.outcome === 'secured').length,
                    evidenceAvailability: period.outcome === 'unknown' ? 'unavailable' : 'known',
                    memberResultsFingerprint,
                    personalResultsFingerprint: personalFingerprint(period.key),
                    revision: sources.config.revision,
                    updatedAt,
                },
            });
        });
    }
    if (phase === 'all' || phase === 'summaries') {
        if (sources.circle.circleMode !== 'personal') {
            writes.push({
                ref: sources.ref,
                data: { groupStreak: computed.group, circleProgressVersion: 2 },
            });
        }
        computed.viewers.forEach((viewer, viewerUid) => writes.push({
            ref: firebase_1.db.doc(`userPrivate/${viewerUid}/circleProgress/${circleId}`),
            data: { ...viewer, updatedAt },
        }));
        if (sources.circle.circleMode !== 'personal' &&
            sources.circle.privacy === 'public' &&
            sources.circle.lifecycleStatus !== 'archived') {
            writes.push({
                ref: firebase_1.db.doc(`publicCircleIndex/${circleId}`),
                data: { groupStreak: computed.group },
            });
        }
    }
    // Guard every batch, including metadata-only reconciliations, against stale source/config work.
    if (commit) {
        for (let index = 0; index < writes.length; index += 350) {
            const accepted = await firebase_1.db.runTransaction(async (transaction) => {
                const [latestLock, latestCircle] = await Promise.all([
                    transaction.get(lock),
                    transaction.get(sources.ref),
                ]);
                if (latestLock.data()?.token !== token ||
                    !latestCircle.exists ||
                    (0, circle_progress_1.circleProgressConfiguration)(latestCircle.data()).revision !==
                        sources.config.revision) {
                    return false;
                }
                const batch = writes.slice(index, index + 350);
                const owners = Array.from(new Set(batch
                    .filter(write => write.ref.path.startsWith('userPrivate/'))
                    .map(write => write.ref.path.split('/')[1])));
                const profiles = await Promise.all(owners.map(owner => transaction.get(firebase_1.db.doc(`users/${owner}`))));
                const allowed = new Set(profiles
                    .filter(profile => profile.exists && !profile.data()?.accountDeletionStartedAt)
                    .map(profile => profile.id));
                for (const write of batch) {
                    if (write.ref.path.startsWith('userPrivate/') &&
                        !allowed.has(write.ref.path.split('/')[1])) {
                        continue;
                    }
                    transaction.set(write.ref, write.data, { merge: true });
                }
                return true;
            });
            if (!accepted) {
                return undefined;
            }
        }
    }
    return {
        viewer: uid ? computed.viewers.get(uid) : undefined,
        group: sources.circle.circleMode === 'personal' ? undefined : computed.group,
    };
}
exports.refreshCircleProgress = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const circleId = request.data?.circleId;
    if (typeof circleId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(circleId)) {
        throw new https_1.HttpsError('invalid-argument', 'A Circle is required.');
    }
    const member = await firebase_1.db.doc(`circles/${circleId}/members/${uid}`).get();
    if (member.data()?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this Circle first.');
    }
    const result = await reconcileCircleProgress({ circleId, uid });
    if (!result) {
        throw new https_1.HttpsError('aborted', 'Progress is updating. Try again.');
    }
    // Undefined values are omitted from the callable payload.
    return JSON.parse(JSON.stringify(result));
});
exports.reconcileCircleProgressCheckIn = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true }, async (event) => {
    await reconcileCircleProgress({ circleId: event.params.circleId });
});
exports.reconcileCircleProgressMembership = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}/members/{uid}', retry: true }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (JSON.stringify([before?.status, before?.joinedAt, before?.leftAt]) ===
        JSON.stringify([after?.status, after?.joinedAt, after?.leftAt])) {
        return;
    }
    await reconcileCircleProgress({ circleId: event.params.circleId });
});
exports.reconcileCircleProgressConfiguration = (0, firestore_2.onDocumentWritten)({ document: 'circles/{circleId}', retry: true }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) {
        return;
    }
    const signature = (data) => JSON.stringify(data
        ? [
            (0, circle_progress_1.circleProgressConfiguration)(data).revision,
            data.lifecycleStatus,
            data.lifecycleRevision,
            data.convertedAt,
        ]
        : null);
    if (signature(before) === signature(after)) {
        return;
    }
    if (before &&
        (before.lifecycleStatus ?? 'active') !==
            (after.lifecycleStatus ?? 'active')) {
        const priorArchive = before.lastArchivedAt
            ? await event
                .data.after.ref.collection('lifecycleHistory')
                .where('at', '==', before.lastArchivedAt)
                .get()
            : undefined;
        const historyKnownBefore = !before.lastArchivedAt ||
            Boolean(priorArchive?.docs.some(doc => doc.data().status === 'archived'));
        await event
            .data.after.ref.collection('lifecycleHistory')
            .doc(String(after.lifecycleRevision || event.id))
            .set({
            status: after.lifecycleStatus || 'active',
            historyKnownBefore,
            at: after.archivedAt ||
                after.unarchivedAt ||
                event.data.after.updateTime,
        });
    }
    await reconcileCircleProgress({ circleId: event.params.circleId });
});
exports.reconcileCircleProgressRollover = (0, scheduler_1.onSchedule)('every 60 minutes', async () => {
    const circles = await firebase_1.db.collection('circles').get();
    for (const circle of circles.docs) {
        if (circle.data().lifecycleStatus !== 'archived') {
            await reconcileCircleProgress({ circleId: circle.id });
        }
    }
});
