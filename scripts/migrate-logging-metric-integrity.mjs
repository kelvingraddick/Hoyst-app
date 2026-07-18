#!/usr/bin/env node

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {
  calculateMomentumSummary,
  calculateMomentumStreaks,
  getOpportunitySlots,
  getOpportunityStatusForSlot,
  normalizeCommitmentSchedule,
} = require('../functions/lib/momentum/schedule.js');

const shouldCommit = process.argv.includes('--commit');
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const phaseArg = process.argv.find(arg => arg.startsWith('--phase='));
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const projectId = projectArg?.slice('--project='.length);
const selectedPhase = phaseArg?.slice('--phase='.length) ?? 'all';
const parsedLimit = Number(limitArg?.slice('--limit='.length));
const limit =
  Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.max(1, Math.round(parsedLimit))
    : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    ...(projectId ? {projectId} : {}),
  });
}

const db = admin.firestore();
const {FieldValue} = admin.firestore;
const phaseNames = [
  'memberships',
  'checkins',
  'opportunities',
  'effects',
  'momentum',
];

if (selectedPhase !== 'all' && !phaseNames.includes(selectedPhase)) {
  throw new Error(`Unknown phase: ${selectedPhase}`);
}

if (shouldCommit && selectedPhase === 'all') {
  throw new Error(
    'Committed runs require one explicit --phase so each phase can be verified before the next begins.',
  );
}

if (shouldCommit && limit) {
  throw new Error(
    'Committed runs cannot use --limit because partial phases cannot be verified safely.',
  );
}

const phaseStateRoot = db
  .collection('adminMigrations')
  .doc('loggingMetricIntegrity')
  .collection('phases');

function withOptionalLimit(query) {
  return limit ? query.limit(limit) : query;
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isCovered(checkIn) {
  return (
    checkIn?.coverageStatus === 'covered' ||
    checkIn?.coverageStatus === 'skipped' ||
    checkIn?.status === 'done' ||
    checkIn?.status === 'skip'
  );
}

function getCircleIdFromCheckIn(ref) {
  return ref.parent.parent?.parent.parent?.id;
}

function getDateKeyFromCheckIn(ref) {
  return ref.parent.parent?.id;
}

function getDateKey(timezone, value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value;
  if (!(date instanceof Date)) {
    return undefined;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function shiftDateKey(dateKey, days) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return dateKey;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMembershipSlotState(period, slot, timezone) {
  const joinedDateKey = getDateKey(timezone, period.joinedAt);
  const leftDateKey = getDateKey(timezone, period.leftAt);

  if (!joinedDateKey) {
    return {eligible: false, expectedForCircle: false};
  }

  const eligible =
    slot.availableDateKey > joinedDateKey ||
    (period.opportunityEligibility === 'include_current' &&
      slot.availableDateKey <= joinedDateKey &&
      slot.expiresDateKey >= joinedDateKey);
  const expectedForCircle =
    eligible && (!leftDateKey || slot.expiresDateKey < leftDateKey);

  return {eligible, expectedForCircle};
}

async function getCircleMembershipPeriods(circleSnapshot) {
  const history = await circleSnapshot.ref
    .collection('membershipHistory')
    .get();
  const periods = [];

  for (const historySnapshot of history.docs) {
    const uid = asString(historySnapshot.data().uid, historySnapshot.id);
    const periodSnapshots = await historySnapshot.ref
      .collection('periods')
      .get();
    periodSnapshots.docs.forEach(periodSnapshot => {
      const period = periodSnapshot.data();
      if (period.joinedAt) {
        periods.push({...period, uid});
      }
    });
  }

  if (periods.length > 0) {
    return periods;
  }

  const activeMembers = await circleSnapshot.ref
    .collection('members')
    .where('status', '==', 'active')
    .get();
  const circle = circleSnapshot.data();
  return activeMembers.docs.flatMap(memberSnapshot => {
    const member = memberSnapshot.data();
    const joinedAt = member.joinedAt ?? member.createdAt ?? circle.createdAt;
    return joinedAt
      ? [
          {
            joinedAt,
            opportunityEligibility:
              member.role === 'owner' ? 'include_current' : 'next_opening',
            role: member.role ?? 'member',
            uid: asString(member.uid, memberSnapshot.id),
          },
        ]
      : [];
  });
}

async function getCircleCheckIns(circleSnapshot) {
  const [days, scopedCheckIns] = await Promise.all([
    circleSnapshot.ref.collection('days').get(),
    db
      .collectionGroup('checkIns')
      .where('circleId', '==', circleSnapshot.id)
      .get(),
  ]);
  const daySnapshots = await Promise.all(
    days.docs.map(daySnapshot => daySnapshot.ref.collection('checkIns').get()),
  );
  const values = daySnapshots.flatMap((snapshot, index) =>
    snapshot.docs.map(checkInSnapshot => ({
      data: checkInSnapshot.data(),
      dateKey: days.docs[index].id,
      id: checkInSnapshot.id,
      ref: checkInSnapshot.ref,
      uid: asString(checkInSnapshot.data().uid, checkInSnapshot.id),
    })),
  );
  const byPath = new Map(values.map(value => [value.ref.path, value]));
  scopedCheckIns.docs.forEach(checkInSnapshot => {
    byPath.set(checkInSnapshot.ref.path, {
      data: checkInSnapshot.data(),
      dateKey: getDateKeyFromCheckIn(checkInSnapshot.ref),
      id: checkInSnapshot.id,
      ref: checkInSnapshot.ref,
      uid: asString(checkInSnapshot.data().uid, checkInSnapshot.id),
    });
  });

  return Array.from(byPath.values()).filter(value => value.dateKey);
}

function getHistoricalScheduleSlots({circle, earliestDateKey, timezone}) {
  const schedule = normalizeCommitmentSchedule(circle, timezone);
  const currentSlots = getOpportunitySlots(schedule, new Date());
  const currentPeriodKey = currentSlots[0]?.periodKey;
  const todayDateKey = getDateKey(timezone, new Date());
  const periodSlots = new Map();

  if (!currentPeriodKey || !todayDateKey) {
    return {currentPeriodKey, slots: []};
  }

  let cursor = shiftDateKey(earliestDateKey, -2);
  const end = shiftDateKey(todayDateKey, 2);
  while (cursor <= end) {
    const date = parseDateKey(cursor);
    if (date) {
      const slots = getOpportunitySlots(schedule, date);
      const periodKey = slots[0]?.periodKey;
      if (
        periodKey &&
        periodKey <= currentPeriodKey &&
        !periodSlots.has(periodKey)
      ) {
        periodSlots.set(periodKey, slots);
      }
    }
    cursor = shiftDateKey(cursor, 1);
  }

  return {
    currentPeriodKey,
    slots: Array.from(periodSlots.values()).flat(),
  };
}

async function writeOperations(operations) {
  if (!shouldCommit) {
    operations.slice(0, 20).forEach(operation => {
      console.log(
        `[dry-run] ${operation.kind} ${operation.ref.path}`,
        operation.data ? JSON.stringify(operation.data) : '',
      );
    });
    return {sampled: 0, verified: true, writes: operations.length};
  }

  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    operations.slice(index, index + 400).forEach(operation => {
      if (operation.kind === 'delete') {
        batch.delete(operation.ref);
      } else {
        batch.set(operation.ref, operation.data, {merge: true});
      }
    });
    await batch.commit();
  }

  const sample = operations.slice(0, 12);
  const snapshots = await Promise.all(
    sample.map(operation => operation.ref.get()),
  );
  const failedSamples = snapshots.filter((snapshot, index) =>
    sample[index].kind === 'delete' ? snapshot.exists : !snapshot.exists,
  );

  if (failedSamples.length > 0) {
    throw new Error(
      `Post-write verification failed for ${failedSamples.length} of ${sample.length} sampled documents.`,
    );
  }

  console.log(
    `verified: ${operations.length} writes counted, ${sample.length} documents sampled`,
  );
  return {sampled: sample.length, verified: true, writes: operations.length};
}

async function migrateMemberships() {
  const circles = await withOptionalLimit(db.collection('circles')).get();
  const operations = [];
  const unresolved = [];

  for (const circleSnapshot of circles.docs) {
    const circle = circleSnapshot.data();
    const members = await circleSnapshot.ref
      .collection('members')
      .where('status', '==', 'active')
      .get();

    members.docs.forEach(memberSnapshot => {
      const member = memberSnapshot.data();
      const uid = asString(member.uid, memberSnapshot.id);
      const joinedAt = member.joinedAt ?? member.createdAt ?? circle.createdAt;

      if (!joinedAt) {
        unresolved.push(memberSnapshot.ref.path);
        return;
      }

      const periodId = asString(member.membershipPeriodId, 'initial');
      const eligibility =
        member.role === 'owner' ? 'include_current' : 'next_opening';
      const historyRef = circleSnapshot.ref
        .collection('membershipHistory')
        .doc(uid);
      const periodRef = historyRef.collection('periods').doc(periodId);

      operations.push({
        data: {
          membershipPeriodId: periodId,
          opportunityEligibility: eligibility,
        },
        kind: 'set',
        ref: memberSnapshot.ref,
      });
      operations.push({
        data: {
          currentPeriodId: periodId,
          firstJoinedAt: joinedAt,
          lastJoinedAt: joinedAt,
          lastRole: member.role ?? 'member',
          status: 'active',
          uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        kind: 'set',
        ref: historyRef,
      });
      operations.push({
        data: {
          circleId: circleSnapshot.id,
          joinedAt,
          opportunityEligibility: eligibility,
          periodId,
          role: member.role ?? 'member',
          uid,
        },
        kind: 'set',
        ref: periodRef,
      });
    });
  }

  if (unresolved.length > 0) {
    unresolved
      .slice(0, 20)
      .forEach(path => console.error(`[unresolved membership] ${path}`));
    throw new Error(
      `Membership phase found ${unresolved.length} records without a reliable join timestamp.`,
    );
  }

  console.log(`memberships: ${operations.length} writes`);
  return writeOperations(operations);
}

async function migrateCheckIns() {
  const snapshots = await withOptionalLimit(
    db.collectionGroup('checkIns'),
  ).get();
  const operations = snapshots.docs.flatMap(snapshot => {
    const circleId = getCircleIdFromCheckIn(snapshot.ref);
    if (!circleId) {
      return [];
    }
    const data = snapshot.data();
    return [
      {
        data: {
          circleId,
          coverageRevision: asNumber(
            data.coverageRevision,
            isCovered(data) ? 1 : 0,
          ),
        },
        kind: 'set',
        ref: snapshot.ref,
      },
    ];
  });

  console.log(`checkins: ${operations.length} writes`);
  return writeOperations(operations);
}

async function migrateOpportunities() {
  const circles = await withOptionalLimit(db.collection('circles')).get();
  const processedCircleIds = new Set(circles.docs.map(snapshot => snapshot.id));
  const canonicalOpportunityPaths = new Set();
  const operations = [];

  for (const circleSnapshot of circles.docs) {
    const circle = circleSnapshot.data();
    const timezone = asString(circle.timezone, 'UTC');
    const [periods, checkIns] = await Promise.all([
      getCircleMembershipPeriods(circleSnapshot),
      getCircleCheckIns(circleSnapshot),
    ]);
    const dateKeys = [
      ...periods.map(period => getDateKey(timezone, period.joinedAt)),
      ...checkIns.map(checkIn => checkIn.dateKey),
    ].filter(Boolean);
    const earliestDateKey = dateKeys.sort()[0];

    if (!earliestDateKey) {
      continue;
    }
    const {currentPeriodKey, slots} = getHistoricalScheduleSlots({
      circle,
      earliestDateKey,
      timezone,
    });
    const slotByKey = new Map(
      slots.map(slot => [`${slot.periodKey}_${slot.slotIndex}`, slot]),
    );
    const memberSlotRecords = new Map();

    periods.forEach(period => {
      slots.forEach(slot => {
        const state = getMembershipSlotState(period, slot, timezone);
        if (!state.eligible) {
          return;
        }
        const key = `${period.uid}|${slot.periodKey}_${slot.slotIndex}`;
        const records = memberSlotRecords.get(key) ?? [];
        records.push({period, ...state});
        memberSlotRecords.set(key, records);
      });
    });

    const completions = new Map();
    const coveredByUid = new Map();
    checkIns
      .filter(checkIn => isCovered(checkIn.data))
      .forEach(checkIn => {
        const values = coveredByUid.get(checkIn.uid) ?? [];
        values.push(checkIn);
        coveredByUid.set(checkIn.uid, values);
      });

    coveredByUid.forEach((memberCheckIns, uid) => {
      const candidates = Array.from(memberSlotRecords.entries())
        .filter(([key]) => key.startsWith(`${uid}|`))
        .map(([key, records]) => ({
          key,
          records,
          slot: slotByKey.get(key.split('|')[1]),
        }))
        .filter(candidate => candidate.slot)
        .sort((left, right) =>
          `${left.slot.availableDateKey}_${left.slot.slotIndex}`.localeCompare(
            `${right.slot.availableDateKey}_${right.slot.slotIndex}`,
          ),
        );

      memberCheckIns
        .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
        .forEach(checkIn => {
          const candidate = candidates.find(value => {
            if (completions.has(value.key)) {
              return false;
            }
            if (
              value.slot.availableDateKey > checkIn.dateKey ||
              value.slot.expiresDateKey < checkIn.dateKey
            ) {
              return false;
            }
            return value.records.some(record => {
              const joinedDateKey = getDateKey(
                timezone,
                record.period.joinedAt,
              );
              const leftDateKey = getDateKey(timezone, record.period.leftAt);
              return (
                joinedDateKey <= checkIn.dateKey &&
                (!leftDateKey || checkIn.dateKey <= leftDateKey)
              );
            });
          });

          if (candidate) {
            completions.set(candidate.key, checkIn);
          }
        });
    });

    const aggregatesByPeriod = new Map();
    slots.forEach(slot => {
      const slotKey = `${slot.periodKey}_${slot.slotIndex}`;
      const aggregate = {
        completed: [],
        covered: [],
        expected: [],
        skipped: [],
      };

      const memberUids = new Set(periods.map(period => period.uid));
      memberUids.forEach(uid => {
        const recordKey = `${uid}|${slotKey}`;
        const records = memberSlotRecords.get(recordKey) ?? [];
        const expectedForCircle = records.some(
          record => record.expectedForCircle,
        );
        const completion = completions.get(recordKey);

        if (!expectedForCircle && !completion) {
          return;
        }

        const completionStatus = completion
          ? completion.data.status === 'skip' ||
            completion.data.coverageStatus === 'skipped'
            ? 'skipped'
            : 'completed'
          : undefined;
        const status = completionStatus
          ? completionStatus
          : getOpportunityStatusForSlot({slot, timezone});
        const opportunityRef = db
          .collection('userPrivate')
          .doc(uid)
          .collection('opportunities')
          .doc(`${circleSnapshot.id}_${slot.periodKey}_${slot.slotIndex}`);
        canonicalOpportunityPaths.add(opportunityRef.path);

        operations.push({
          data: {
            availableDateKey: slot.availableDateKey,
            cadence: normalizeCommitmentSchedule(circle, timezone).cadence,
            circleId: circleSnapshot.id,
            commitment: circle.commitment,
            countsTowardCircle: expectedForCircle,
            expiresDateKey: slot.expiresDateKey,
            expectedForCircle,
            isCurrentPeriod: slot.periodKey === currentPeriodKey,
            periodKey: slot.periodKey,
            slotIndex: slot.slotIndex,
            status,
            timezone,
            title: circle.title,
            uid,
            updatedAt: FieldValue.serverTimestamp(),
            ...(completion
              ? {
                  completedAt:
                    completion.data.updatedAt ??
                    completion.data.createdAt ??
                    FieldValue.serverTimestamp(),
                  completionDateKey: completion.dateKey,
                  linkedCheckInId: completion.id,
                }
              : {}),
          },
          kind: 'set',
          ref: opportunityRef,
        });

        if (expectedForCircle) {
          aggregate.expected.push(uid);
          if (status === 'completed' || status === 'skipped') {
            aggregate.covered.push(uid);
          }
          if (status === 'completed') {
            aggregate.completed.push(uid);
          }
          if (status === 'skipped') {
            aggregate.skipped.push(uid);
          }
        }
      });

      const periodAggregates = aggregatesByPeriod.get(slot.periodKey) ?? [];
      periodAggregates.push({aggregate, slot});
      aggregatesByPeriod.set(slot.periodKey, periodAggregates);
    });

    for (const [periodKey, periodAggregates] of aggregatesByPeriod) {
      const periodRef = circleSnapshot.ref
        .collection('opportunities')
        .doc(periodKey);
      for (const {aggregate, slot} of periodAggregates) {
        operations.push({
          data: {
            availableDateKey: slot.availableDateKey,
            completedMemberCount: aggregate.completed.length,
            completedMemberUids: aggregate.completed,
            coveredMemberCount: aggregate.covered.length,
            coveredMemberUids: aggregate.covered,
            expectedMemberCount: aggregate.expected.length,
            expectedMemberUids: aggregate.expected,
            expiresDateKey: slot.expiresDateKey,
            periodKey,
            skippedMemberCount: aggregate.skipped.length,
            skippedMemberUids: aggregate.skipped,
            slotIndex: slot.slotIndex,
            updatedAt: FieldValue.serverTimestamp(),
          },
          kind: 'set',
          ref: periodRef.collection('slots').doc(String(slot.slotIndex)),
        });
      }
      const values = periodAggregates.map(value => value.aggregate);
      const expectedOpportunityCount = values.reduce(
        (total, aggregate) => total + aggregate.expected.length,
        0,
      );
      const coveredOpportunityCount = values.reduce(
        (total, aggregate) => total + aggregate.covered.length,
        0,
      );
      operations.push({
        data: {
          completedMembers: coveredOpportunityCount,
          completedOpportunityCount: values.reduce(
            (total, aggregate) => total + aggregate.completed.length,
            0,
          ),
          coveredOpportunityCount,
          expectedMembers: new Set(
            values.flatMap(aggregate => aggregate.expected),
          ).size,
          expectedOpportunityCount,
          periodKey,
          progressPercent: expectedOpportunityCount
            ? Math.round(
                (coveredOpportunityCount / expectedOpportunityCount) * 100,
              )
            : 0,
          skippedOpportunityCount: values.reduce(
            (total, aggregate) => total + aggregate.skipped.length,
            0,
          ),
          updatedAt: FieldValue.serverTimestamp(),
        },
        kind: 'set',
        ref: periodRef,
      });
    }
  }

  const existingOpportunities = await withOptionalLimit(
    db.collectionGroup('opportunities'),
  ).get();
  existingOpportunities.docs
    .filter(
      snapshot =>
        snapshot.ref.path.startsWith('userPrivate/') &&
        processedCircleIds.has(asString(snapshot.data().circleId)) &&
        !canonicalOpportunityPaths.has(snapshot.ref.path),
    )
    .forEach(snapshot => {
      operations.push({
        data: {
          countsTowardCircle: false,
          expectedForCircle: false,
          isCurrentPeriod: false,
          updatedAt: FieldValue.serverTimestamp(),
        },
        kind: 'set',
        ref: snapshot.ref,
      });
    });

  console.log(`opportunities: ${operations.length} writes`);
  return writeOperations(operations);
}

async function migrateEffects() {
  const checkIns = await withOptionalLimit(
    db.collectionGroup('checkIns'),
  ).get();
  const operations = [];

  for (const checkInSnapshot of checkIns.docs) {
    const checkIn = checkInSnapshot.data();
    if (!isCovered(checkIn)) {
      continue;
    }
    const circleId = getCircleIdFromCheckIn(checkInSnapshot.ref);
    const dateKey = getDateKeyFromCheckIn(checkInSnapshot.ref);
    const uid = asString(checkIn.uid, checkInSnapshot.id);
    if (!circleId || !dateKey || !uid) {
      continue;
    }
    const sourceKey = `check_in:${circleId}:${dateKey}:${uid}`;
    const coverageRevision = asNumber(checkIn.coverageRevision, 1);
    const tapInActivityRef = db
      .collection('circles')
      .doc(circleId)
      .collection('feedItems')
      .doc(`tap_in_${dateKey}_${uid}`);
    const tapInActivitySnapshot = await tapInActivityRef.get();
    const tapInActivity = tapInActivitySnapshot.data();
    const isMetadataOnlyActivity =
      tapInActivitySnapshot.exists &&
      !tapInActivity?.type &&
      !tapInActivity?.actor &&
      !tapInActivity?.createdAt &&
      !tapInActivity?.kind &&
      !tapInActivity?.text;
    const circleActivityIds =
      tapInActivitySnapshot.exists && tapInActivity?.type === 'tap_in'
        ? [tapInActivityRef.id]
        : [];
    if (isMetadataOnlyActivity) {
      operations.push({kind: 'delete', ref: tapInActivityRef});
    }
    operations.push({
      data: {
        active: true,
        circleActivityIds,
        coverageRevision,
        notificationSourceKey: sourceKey,
        sourceKey,
        status: checkIn.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      kind: 'set',
      ref: db
        .collection('circles')
        .doc(circleId)
        .collection('checkInEffects')
        .doc(`${dateKey}_${uid}`),
    });
    operations.push({
      data: {
        active: true,
        circleActivityIds,
        coverageRevision,
        notificationSourceKey: sourceKey,
        sourceKey,
        status: checkIn.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      kind: 'set',
      ref: db
        .collection('circles')
        .doc(circleId)
        .collection('checkInEffects')
        .doc(`${dateKey}_${uid}`)
        .collection('revisions')
        .doc(String(coverageRevision)),
    });
    if (circleActivityIds.length > 0) {
      operations.push({
        data: {sourceKey, sourceRevision: coverageRevision},
        kind: 'set',
        ref: tapInActivityRef,
      });
    }
  }

  const inbox = await withOptionalLimit(db.collectionGroup('inbox')).get();
  const linkableTypes = new Set([
    'companion_achievement_unlocked',
    'companion_momentum_level_up',
    'companion_skipped',
    'companion_streak_milestone',
    'companion_tapped_in',
  ]);
  inbox.docs.forEach(snapshot => {
    const event = snapshot.data();
    const circleId = asString(event.circleId);
    const actorUid = asString(event.actor?.uid);
    const dateKey = snapshot.id.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!circleId || !actorUid || !dateKey || !linkableTypes.has(event.type)) {
      return;
    }
    operations.push({
      data: {
        sourceKey: `check_in:${circleId}:${dateKey}:${actorUid}`,
        sourceRevision: 1,
      },
      kind: 'set',
      ref: snapshot.ref,
    });
  });

  console.log(`effects: ${operations.length} writes`);
  return writeOperations(operations);
}

async function migrateMomentum() {
  const users = await withOptionalLimit(db.collection('userPrivate')).get();
  const operations = [];

  for (const userSnapshot of users.docs) {
    const opportunities = await userSnapshot.ref
      .collection('opportunities')
      .get();
    const mapped = opportunities.docs.flatMap(snapshot => {
      const data = snapshot.data();
      return data.availableDateKey && data.periodKey && data.status
        ? [
            {
              availableDateKey: data.availableDateKey,
              periodKey: data.periodKey,
              slotIndex: asNumber(data.slotIndex),
              status: data.status,
            },
          ]
        : [];
    });
    const summary = calculateMomentumSummary({
      opportunities: opportunities.docs
        .filter(snapshot => snapshot.data().isCurrentPeriod !== false)
        .flatMap(snapshot => {
          const data = snapshot.data();
          return data.availableDateKey && data.periodKey && data.status
            ? [
                {
                  availableDateKey: data.availableDateKey,
                  periodKey: data.periodKey,
                  slotIndex: asNumber(data.slotIndex),
                  status: data.status,
                },
              ]
            : [];
        }),
      periodKey: 'current',
    });
    const streaks = calculateMomentumStreaks({opportunities: mapped});
    operations.push({
      data: {
        ...summary,
        ...streaks,
        updatedAt: FieldValue.serverTimestamp(),
      },
      kind: 'set',
      ref: userSnapshot.ref.collection('momentum').doc('current'),
    });
  }

  console.log(`momentum: ${operations.length} writes`);
  return writeOperations(operations);
}

const runners = {
  checkins: migrateCheckIns,
  effects: migrateEffects,
  memberships: migrateMemberships,
  momentum: migrateMomentum,
  opportunities: migrateOpportunities,
};

for (const phaseName of phaseNames) {
  if (selectedPhase === 'all' || selectedPhase === phaseName) {
    if (shouldCommit) {
      const phaseIndex = phaseNames.indexOf(phaseName);
      const priorPhaseName = phaseNames[phaseIndex - 1];

      if (priorPhaseName) {
        const priorPhaseSnapshot = await phaseStateRoot
          .doc(priorPhaseName)
          .get();
        if (priorPhaseSnapshot.data()?.status !== 'complete') {
          throw new Error(
            `Complete and verify the ${priorPhaseName} phase before committing ${phaseName}.`,
          );
        }
      }
    }

    console.log(
      `Starting ${phaseName} phase (${shouldCommit ? 'commit' : 'dry-run'})`,
    );
    const result = await runners[phaseName]();
    if (shouldCommit) {
      await phaseStateRoot.doc(phaseName).set({
        completedAt: FieldValue.serverTimestamp(),
        sampled: result?.sampled ?? 0,
        status: 'complete',
        verified: result?.verified === true,
        writes: result?.writes ?? 0,
      });
    }
    console.log(`Finished ${phaseName} phase`);
  }
}

console.log(
  shouldCommit
    ? 'Migration commit completed. Run every phase again without --commit to verify zero or idempotent writes.'
    : 'Dry run completed. Re-run with --commit after reviewing every phase.',
);
