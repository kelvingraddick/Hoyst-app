#!/usr/bin/env node

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {
  calculateGroupDailyStreak,
  isMemberExpectedForGroupDate,
} = require('../functions/lib/circles/group-streak.js');
const {
  isCoveredCheckInData,
} = require('../functions/lib/shared/commitments.js');
const {getDateKey} = require('../functions/lib/profile/streak.js');

const shouldCommit = process.argv.includes('--commit');
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const phaseArg = process.argv.find(arg => arg.startsWith('--phase='));
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const projectId = projectArg?.slice('--project='.length);
const phase = phaseArg?.slice('--phase='.length);
const parsedLimit = Number(limitArg?.slice('--limit='.length));
const limit =
  Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.max(1, Math.round(parsedLimit))
    : undefined;

if (!projectId) {
  throw new Error('--project is required.');
}

if (!phase || !['days', 'summaries'].includes(phase)) {
  throw new Error('--phase must be days or summaries.');
}

if (shouldCommit && limit) {
  throw new Error('Committed runs cannot use --limit.');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const db = admin.firestore();
const {FieldValue} = admin.firestore;

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getGroupStreakStartDateKey(circle, timezone) {
  const convertedAt = circle?.convertedAt;
  const convertedDate =
    convertedAt && typeof convertedAt.toDate === 'function'
      ? convertedAt.toDate()
      : undefined;

  return convertedDate ? getDateKey(convertedDate, timezone) : undefined;
}

async function getMembershipPeriods(circleRef) {
  const histories = await circleRef.collection('membershipHistory').get();

  if (histories.empty) {
    return {isKnown: false, periods: []};
  }

  const periods = [];
  for (const history of histories.docs) {
    const periodSnapshots = await history.ref.collection('periods').get();
    periodSnapshots.docs.forEach(periodSnapshot => {
      const period = periodSnapshot.data();
      const uid = asString(period.uid, history.id);

      if (uid && period.joinedAt) {
        periods.push({...period, uid});
      }
    });
  }

  return {isKnown: periods.length > 0, periods};
}

function getExpectedMembers({dateKey, periods, timezone}) {
  return Array.from(
    new Set(
      periods
        .filter(period =>
          isMemberExpectedForGroupDate({dateKey, period, timezone}),
        )
        .map(period => period.uid),
    ),
  ).sort();
}

async function buildDayWrites(circleSnapshot) {
  const circle = circleSnapshot.data();
  const timezone = asString(circle.timezone, 'UTC');
  const {isKnown: periodsKnown, periods} = await getMembershipPeriods(
    circleSnapshot.ref,
  );
  const days = await circleSnapshot.ref.collection('days').get();
  const groupStreakStartDateKey = getGroupStreakStartDateKey(circle, timezone);
  const groupDays = days.docs.filter(
    day => !groupStreakStartDateKey || day.id >= groupStreakStartDateKey,
  );
  const checkIns = await Promise.all(
    groupDays.map(day => day.ref.collection('checkIns').get()),
  );

  let unknownDays = 0;
  let writes = 0;
  const operations = groupDays.map((day, index) => {
    const expectedMemberUids = periodsKnown
      ? getExpectedMembers({dateKey: day.id, periods, timezone})
      : [];
    const known = periodsKnown && expectedMemberUids.length > 0;
    const expectedUids = new Set(expectedMemberUids);
    const coveredMemberUids = checkIns[index].docs
      .filter(snapshot => isCoveredCheckInData(snapshot.data()))
      .map(snapshot => asString(snapshot.data().uid, snapshot.id))
      .filter(uid => expectedUids.has(uid));
    const uniqueCoveredMemberUids = Array.from(
      new Set(coveredMemberUids),
    ).sort();
    const complete =
      known && uniqueCoveredMemberUids.length === expectedMemberUids.length;

    if (!known) {
      unknownDays += 1;
    }
    writes += 1;

    return {
      data: {
        dateKey: day.id,
        groupStreakCohortKnown: known,
        groupStreakComplete: complete,
        groupStreakCoveredMemberCount: uniqueCoveredMemberUids.length,
        groupStreakCoveredMemberUids: uniqueCoveredMemberUids,
        groupStreakExpectedMemberCount: expectedMemberUids.length,
        groupStreakExpectedMemberUids: expectedMemberUids,
        groupStreakUpdatedAt: FieldValue.serverTimestamp(),
      },
      ref: day.ref,
    };
  });

  return {operations, unknownDays, writes};
}

async function commitOperations(operations) {
  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    operations.slice(index, index + 400).forEach(({data, ref}) => {
      batch.set(ref, data, {merge: true});
    });
    await batch.commit();
  }
}

async function migrateDays(circles) {
  let affectedDays = 0;
  let unknownDays = 0;

  for (const circle of circles) {
    const result = await buildDayWrites(circle);
    affectedDays += result.writes;
    unknownDays += result.unknownDays;

    if (shouldCommit) {
      await commitOperations(result.operations);
    }
  }

  return {affectedDays, unknownDays};
}

async function migrateSummaries(circles) {
  let affectedCircles = 0;

  for (const circleSnapshot of circles) {
    const circle = circleSnapshot.data();
    const timezone = asString(circle.timezone, 'UTC');
    const groupStreakStartDateKey = getGroupStreakStartDateKey(
      circle,
      timezone,
    );
    const days = await circleSnapshot.ref.collection('days').get();
    const completedDateKeys = days.docs
      .filter(
        day =>
          (!groupStreakStartDateKey || day.id >= groupStreakStartDateKey) &&
          day.data().groupStreakCohortKnown === true &&
          day.data().groupStreakComplete === true,
      )
      .map(day => day.id);
    const groupStreakDays = calculateGroupDailyStreak({
      completedDateKeys,
      startDateKey: groupStreakStartDateKey,
      timezone,
    });
    const write = {
      groupStreakDays,
      groupStreakUpdatedAt: FieldValue.serverTimestamp(),
    };

    affectedCircles += 1;
    if (shouldCommit) {
      const batch = db.batch();
      batch.set(circleSnapshot.ref, write, {merge: true});
      if (circle.privacy === 'public') {
        batch.set(
          db.collection('publicCircleIndex').doc(circleSnapshot.id),
          write,
          {merge: true},
        );
      }
      await batch.commit();
    }
  }

  return {affectedCircles};
}

const circleQuery = db.collection('circles').where('circleMode', '==', 'group');
const circleSnapshot = await (limit
  ? circleQuery.limit(limit)
  : circleQuery
).get();
const result =
  phase === 'days'
    ? await migrateDays(circleSnapshot.docs)
    : await migrateSummaries(circleSnapshot.docs);

console.log(JSON.stringify({phase, ...result}, null, 2));
console.log(
  shouldCommit
    ? 'Committed group streak migration phase.'
    : 'Dry run completed with zero writes. Re-run with --commit to write.',
);
