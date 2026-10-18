import {createHash, randomUUID} from 'node:crypto';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {db} from '../firebase';
import {isCoveredCheckInData} from '../shared/commitments';
import {
  circleDateKey,
  circleDates,
  circlePeriodForDate,
  circleProgressConfiguration,
  circleStreakUnit,
  countCirclePeriodStreak,
  evaluateMemberPeriod,
  groupPeriodOutcome,
  isCircleDateEligible,
  shiftCircleDate,
  type ActivityInterval,
  type CircleDayCoverage,
  type CircleProgressResult,
  type CircleProgressSummary,
  type MembershipSpan,
} from '../shared/circle-progress';

function date(value: unknown, timezone: string): string | undefined {
  const stamp = value as {toDate?: () => Date} | undefined;
  const parsed = value instanceof Date ? value : stamp?.toDate?.();
  return parsed ? circleDateKey(timezone, parsed) : undefined;
}

export async function readCircleProgressSources(circleId: string) {
  const ref = db.collection('circles').doc(circleId);
  const [snapshot, members, histories, days, lifecycle, existingPeriods] =
    await Promise.all([
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
  const circle = snapshot.data()!;
  const config = circleProgressConfiguration(circle);
  const periods = await Promise.all(
    histories.docs.map(history => history.ref.collection('periods').get()),
  );
  const spans: MembershipSpan[] = [];
  periods.forEach((period, index) =>
    period.docs.forEach(entry => {
      const data = entry.data();
      const joined = date(data.joinedAt, config.timezone);
      if (!joined) {
        return;
      }
      spans.push({
        uid: data.uid || histories.docs[index].id,
        start:
          data.opportunityEligibility === 'include_current'
            ? joined
            : shiftCircleDate(joined, 1),
        end: date(data.leftAt, config.timezone),
        runId: entry.id,
      });
    }),
  );
  // A current membership proves its own run, but not an entire historical group cohort.
  const historiesKnown = members.docs.every(
    member =>
      member.data().status === 'pending' ||
      spans.some(span => span.uid === member.id),
  );
  for (const member of members.docs) {
    const data = member.data();
    if (
      data.status === 'pending' ||
      spans.some(span => span.uid === member.id)
    ) {
      continue;
    }
    const joined = date(data.joinedAt, config.timezone);
    if (joined) {
      spans.push({
        uid: member.id,
        start:
          data.opportunityEligibility === 'include_current'
            ? joined
            : shiftCircleDate(joined, 1),
        end: date(data.leftAt, config.timezone),
        runId: 'legacy',
      });
    }
  }
  const created = date(circle.createdAt, config.timezone);
  const start = created ?? spans.map(span => span.start).sort()[0];
  const intervals: ActivityInterval[] = start ? [{start}] : [];
  let lifecycleKnown = true;
  if (
    lifecycle.empty &&
    (circle.lastArchivedAt || circle.opportunitiesResumeAfterDateKey)
  ) {
    // Only the latest legacy pause is provable. Do not invent earlier active intervals.
    lifecycleKnown = false;
    intervals.splice(0);
    if (typeof circle.opportunitiesResumeAfterDateKey === 'string') {
      intervals.push({
        start: shiftCircleDate(circle.opportunitiesResumeAfterDateKey, 1),
      });
    }
  } else {
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
      } else if (
        data.status === 'active' &&
        intervals[intervals.length - 1]?.end
      ) {
        intervals.push({start: shiftCircleDate(at, 1)});
      }
    }
  }
  if (circle.lifecycleStatus === 'archived') {
    const open = intervals[intervals.length - 1];
    if (open && !open.end) {
      open.end = date(circle.archivedAt, config.timezone);
    }
  }
  const checks = await Promise.all(
    days.docs.map(day => day.ref.collection('checkIns').get()),
  );
  const byDate = new Map<string, Map<string, DocumentData>>();
  checks.forEach((snapshot, index) =>
    byDate.set(
      days.docs[index].id,
      new Map(
        snapshot.docs.map(check => [
          check.data().uid || check.id,
          check.data(),
        ]),
      ),
    ),
  );
  return {
    ref,
    circle,
    config,
    members,
    spans,
    intervals,
    byDate,
    start,
    historiesKnown:
      historiesKnown &&
      (members.docs.some(member => member.data().status === 'active') ||
        Number(circle.memberCount ?? 0) === 0) &&
      Array.from(byDate.values()).every(values =>
        Array.from(values.keys()).every(uid =>
          spans.some(span => span.uid === uid),
        ),
      ) &&
      histories.docs.every((history, index) => {
        const first = date(history.data().firstJoinedAt, config.timezone);
        return (
          !first ||
          periods[index].docs.some(period => {
            const joined = date(period.data().joinedAt, config.timezone);
            return joined && joined <= first;
          })
        );
      }),
    lifecycleKnown,
    existingPeriods,
    existingDays: new Map(
      days.docs.map(day => [day.id, day.data().activityCoverage]),
    ),
  };
}

export function calculateCircleProgress(
  sources: NonNullable<Awaited<ReturnType<typeof readCircleProgressSources>>>,
  now = new Date(),
) {
  const {
    circle,
    config,
    spans,
    intervals,
    byDate,
    start,
    historiesKnown,
    lifecycleKnown,
  } = sources;
  const today = circleDateKey(config.timezone, now);
  const currentPeriod = circlePeriodForDate(today, config.cadence);
  const periodKeys = new Map<string, ReturnType<typeof circlePeriodForDate>>();
  if (start) {
    for (const key of circleDates(start, today)) {
      const period = circlePeriodForDate(key, config.cadence);
      periodKeys.set(period.key, period);
    }
  }
  periodKeys.set(currentPeriod.key, currentPeriod);
  const periods = Array.from(periodKeys.values()).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const uids = Array.from(new Set(spans.map(span => span.uid)));
  const coveredByUid = new Map(
    uids.map(uid => [
      uid,
      new Set(
        Array.from(byDate)
          .filter(([, values]) => isCoveredCheckInData(values.get(uid)))
          .map(([key]) => key),
      ),
    ]),
  );
  const personalPeriods = spans.flatMap(span =>
    periods
      .filter(
        period =>
          period.end >= span.start && (!span.end || period.start < span.end),
      )
      .map(period => ({
        ...evaluateMemberPeriod({
          period,
          uid: span.uid,
          spans: [span],
          intervals,
          target: config.target,
          coveredDates: coveredByUid.get(span.uid)!,
          today,
          known: lifecycleKnown,
        }),
        runId: span.runId,
      })),
  );
  const evaluateRuns = (
    uid: string,
    period: typeof currentPeriod,
    activity: ActivityInterval[],
  ) => {
    const runs = spans
      .filter(span => span.uid === uid)
      .map(span =>
        evaluateMemberPeriod({
          period,
          uid,
          spans: [span],
          intervals: activity,
          target: config.target,
          coveredDates: coveredByUid.get(uid)!,
          today,
          known: lifecycleKnown,
        }),
      );
    const required = runs.filter(run => run.outcome !== 'neutral');
    return {
      ...period,
      uid,
      required: required.reduce((sum, run) => sum + run.required, 0),
      covered: required.reduce((sum, run) => sum + run.covered, 0),
      remaining: required.reduce((sum, run) => sum + run.remaining, 0),
      outcome: groupPeriodOutcome(runs, lifecycleKnown),
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
  const groupResults = results.map(({period}) => {
    const members = uids.map(uid => evaluateRuns(uid, period, groupIntervals));
    return {
      ...period,
      members,
      outcome: groupPeriodOutcome(members, historiesKnown && lifecycleKnown),
    };
  });
  const unit = circleStreakUnit(config.cadence);
  const base = {
    version: 2 as const,
    revision: config.revision,
    asOfDateKey: today,
    cadence: config.cadence,
    period: currentPeriod,
  };
  const latestGroup = groupResults[groupResults.length - 1];
  const expected = latestGroup.members.filter(
    member => member.required > 0 && member.outcome !== 'neutral',
  );
  const group: CircleProgressSummary = {
    ...base,
    streak: countCirclePeriodStreak(groupResults, unit),
    progress: {
      covered: expected.filter(member => member.outcome === 'secured').length,
      required: expected.length,
      outcome: latestGroup.outcome,
    },
  };
  const viewers = new Map<string, CircleProgressSummary>();
  for (const uid of uids) {
    const latestRun = spans
      .filter(span => span.uid === uid)
      .sort((a, b) => b.start.localeCompare(a.start))[0];
    const runSpans = spans.filter(
      span => span.uid === uid && span.runId === latestRun.runId,
    );
    const memberPeriods = periods.map(period =>
      evaluateMemberPeriod({
        period,
        uid,
        spans: runSpans,
        intervals,
        target: config.target,
        coveredDates: coveredByUid.get(uid)!,
        today,
        known: lifecycleKnown,
      }),
    );
    const latest = memberPeriods[memberPeriods.length - 1];
    viewers.set(uid, {
      ...base,
      streak: countCirclePeriodStreak(memberPeriods, unit),
      progress: {
        covered: latest.covered,
        required: latest.required,
        outcome: latest.outcome,
      },
    });
  }
  const daily = new Map<string, CircleDayCoverage>();
  for (const day of circleDates(start ?? today, today)) {
    const values = byDate.get(day);
    const expectedUids = uids.filter(uid =>
      isCircleDateEligible(
        day,
        spans.filter(span => span.uid === uid),
        intervals,
        isCoveredCheckInData(values?.get(uid)),
      ),
    );
    const covered = expectedUids.filter(uid =>
      isCoveredCheckInData(values?.get(uid)),
    );
    daily.set(day, {
      known: historiesKnown && lifecycleKnown && expectedUids.length > 0,
      expectedUids,
      completedUids: covered.filter(uid => values?.get(uid)?.status === 'done'),
      skippedUids: covered.filter(uid => values?.get(uid)?.status === 'skip'),
      restoredUids: covered.filter(
        uid => values?.get(uid)?.protectionKind === 'restore',
      ),
    });
  }
  return {group, viewers, daily, results, groupResults, personalPeriods};
}

type ProgressPhase = 'daily-coverage' | 'period-outcomes' | 'summaries' | 'all';
export async function reconcileCircleProgress({
  circleId,
  uid,
  now = new Date(),
  phase = 'all',
  commit = true,
}: {
  circleId: string;
  uid?: string;
  now?: Date;
  phase?: ProgressPhase;
  commit?: boolean;
}): Promise<CircleProgressResult | undefined> {
  const lock = db.collection('circleProgressSources').doc(circleId);
  const token = randomUUID();
  if (commit) {
    await lock.set({token, startedAt: FieldValue.serverTimestamp()});
  }
  const sources = await readCircleProgressSources(circleId);
  if (!sources) {
    return undefined;
  }
  const computed = calculateCircleProgress(sources, now);
  const writes: {ref: DocumentReference; data: DocumentData}[] = [];
  const updatedAt = FieldValue.serverTimestamp();
  if (phase === 'all' || phase === 'daily-coverage') {
    computed.daily.forEach((coverage, day) => {
      if (
        JSON.stringify(sources.existingDays.get(day)) !==
        JSON.stringify(coverage)
      ) {
        writes.push({
          ref: sources.ref.collection('days').doc(day),
          data: {activityCoverage: coverage},
        });
      }
    });
  }
  if (phase === 'all' || phase === 'period-outcomes') {
    const existingPeriods = new Map(
      sources.existingPeriods.docs.map(period => [period.id, period.data()]),
    );
    const personalFingerprint = (key: string) =>
      createHash('sha256')
        .update(
          JSON.stringify(
            computed.personalPeriods.filter(period => period.key === key),
          ),
        )
        .digest('hex');
    computed.results.forEach(({period}) => {
      if (
        existingPeriods.get(period.key)?.personalResultsFingerprint ===
          personalFingerprint(period.key) &&
        existingPeriods.get(period.key)?.revision === sources.config.revision
      ) {
        return;
      }
      computed.personalPeriods
        .filter(member => member.key === period.key)
        .forEach(member =>
          writes.push({
            ref: db.doc(
              `userPrivate/${member.uid}/circlePeriods/${circleId}_${member.runId}_${period.key}`,
            ),
            data: {
              ...member,
              target: member.required,
              coveredCount: member.covered,
              cadence: sources.config.cadence,
              circleId,
              evidenceAvailability:
                member.outcome === 'unknown' ? 'unavailable' : 'known',
              revision: sources.config.revision,
              updatedAt,
            },
          }),
        );
    });
    computed.groupResults.forEach((period, index) => {
      const memberResultsFingerprint = JSON.stringify(
        computed.results[index].members,
      );
      const previous = existingPeriods.get(period.key);
      if (
        previous?.revision === sources.config.revision &&
        previous?.outcome === period.outcome &&
        previous?.memberResultsFingerprint === memberResultsFingerprint &&
        previous?.personalResultsFingerprint === personalFingerprint(period.key)
      ) {
        return;
      }
      writes.push({
        ref: sources.ref.collection('progressPeriods').doc(period.key),
        data: {
          ...period,
          cadence: sources.config.cadence,
          target: period.members.filter(
            member => member.required > 0 && member.outcome !== 'neutral',
          ).length,
          coveredCount: period.members.filter(
            member => member.outcome === 'secured',
          ).length,
          evidenceAvailability:
            period.outcome === 'unknown' ? 'unavailable' : 'known',
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
        data: {groupStreak: computed.group, circleProgressVersion: 2},
      });
    }
    computed.viewers.forEach((viewer, viewerUid) =>
      writes.push({
        ref: db.doc(`userPrivate/${viewerUid}/circleProgress/${circleId}`),
        data: {...viewer, updatedAt},
      }),
    );
    if (
      sources.circle.circleMode !== 'personal' &&
      sources.circle.privacy === 'public' &&
      sources.circle.lifecycleStatus !== 'archived'
    ) {
      writes.push({
        ref: db.doc(`publicCircleIndex/${circleId}`),
        data: {groupStreak: computed.group},
      });
    }
  }
  // Guard every batch, including metadata-only reconciliations, against stale source/config work.
  if (commit) {
    for (let index = 0; index < writes.length; index += 350) {
      const accepted = await db.runTransaction(async transaction => {
        const [latestLock, latestCircle] = await Promise.all([
          transaction.get(lock),
          transaction.get(sources.ref),
        ]);
        if (
          latestLock.data()?.token !== token ||
          !latestCircle.exists ||
          circleProgressConfiguration(latestCircle.data()!).revision !==
            sources.config.revision
        ) {
          return false;
        }
        const batch = writes.slice(index, index + 350);
        const owners = Array.from(
          new Set(
            batch
              .filter(write => write.ref.path.startsWith('userPrivate/'))
              .map(write => write.ref.path.split('/')[1]),
          ),
        );
        const profiles = await Promise.all(
          owners.map(owner => transaction.get(db.doc(`users/${owner}`))),
        );
        const allowed = new Set(
          profiles
            .filter(
              profile =>
                profile.exists && !profile.data()?.accountDeletionStartedAt,
            )
            .map(profile => profile.id),
        );
        for (const write of batch) {
          if (
            write.ref.path.startsWith('userPrivate/') &&
            !allowed.has(write.ref.path.split('/')[1])
          ) {
            continue;
          }
          transaction.set(write.ref, write.data, {merge: true});
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
    group:
      sources.circle.circleMode === 'personal' ? undefined : computed.group,
  };
}

export const refreshCircleProgress = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }
  const circleId = request.data?.circleId;
  if (
    typeof circleId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(circleId)
  ) {
    throw new HttpsError('invalid-argument', 'A Circle is required.');
  }
  const member = await db.doc(`circles/${circleId}/members/${uid}`).get();
  if (member.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'Join this Circle first.');
  }
  const result = await reconcileCircleProgress({circleId, uid});
  if (!result) {
    throw new HttpsError('aborted', 'Progress is updating. Try again.');
  }
  // Undefined values are omitted from the callable payload.
  return JSON.parse(JSON.stringify(result));
});

export const reconcileCircleProgressCheckIn = onDocumentWritten(
  {document: 'circles/{circleId}/days/{dateKey}/checkIns/{uid}', retry: true},
  async event => {
    await reconcileCircleProgress({circleId: event.params.circleId});
  },
);
export const reconcileCircleProgressMembership = onDocumentWritten(
  {document: 'circles/{circleId}/members/{uid}', retry: true},
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (
      JSON.stringify([before?.status, before?.joinedAt, before?.leftAt]) ===
      JSON.stringify([after?.status, after?.joinedAt, after?.leftAt])
    ) {
      return;
    }
    await reconcileCircleProgress({circleId: event.params.circleId});
  },
);
export const reconcileCircleProgressConfiguration = onDocumentWritten(
  {document: 'circles/{circleId}', retry: true},
  async event => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) {
      return;
    }
    const signature = (data?: DocumentData) =>
      JSON.stringify(
        data
          ? [
              circleProgressConfiguration(data).revision,
              data.lifecycleStatus,
              data.lifecycleRevision,
              data.convertedAt,
            ]
          : null,
      );
    if (signature(before) === signature(after)) {
      return;
    }
    if (
      before &&
      (before.lifecycleStatus ?? 'active') !==
        (after.lifecycleStatus ?? 'active')
    ) {
      const priorArchive = before.lastArchivedAt
        ? await event
            .data!.after.ref.collection('lifecycleHistory')
            .where('at', '==', before.lastArchivedAt)
            .get()
        : undefined;
      const historyKnownBefore =
        !before.lastArchivedAt ||
        Boolean(
          priorArchive?.docs.some(doc => doc.data().status === 'archived'),
        );
      await event
        .data!.after.ref.collection('lifecycleHistory')
        .doc(String(after.lifecycleRevision || event.id))
        .set({
          status: after.lifecycleStatus || 'active',
          historyKnownBefore,
          at:
            after.archivedAt ||
            after.unarchivedAt ||
            event.data!.after.updateTime,
        });
    }
    await reconcileCircleProgress({circleId: event.params.circleId});
  },
);
export const reconcileCircleProgressRollover = onSchedule(
  'every 60 minutes',
  async () => {
    const circles = await db.collection('circles').get();
    for (const circle of circles.docs) {
      if (circle.data().lifecycleStatus !== 'archived') {
        await reconcileCircleProgress({circleId: circle.id});
      }
    }
  },
);
