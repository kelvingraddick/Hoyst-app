#!/usr/bin/env node

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {
  calculateMomentumStreaks,
  calculateMomentumSummary,
  calculateRollingMomentumSummary,
  isExpiredExpectedOpenOpportunity,
} = require('../functions/lib/momentum/schedule.js');

const shouldCommit = process.argv.includes('--commit');
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const phaseArg = process.argv.find(arg => arg.startsWith('--phase='));
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const uidArg = process.argv.find(arg => arg.startsWith('--uid='));
const projectId = projectArg?.slice('--project='.length);
const selectedPhase = phaseArg?.slice('--phase='.length);
const selectedUid = uidArg?.slice('--uid='.length);
const parsedLimit = Number(limitArg?.slice('--limit='.length));
const limit =
  Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.max(1, Math.round(parsedLimit))
    : undefined;
const phaseNames = ['opportunities', 'summaries'];

if (!projectId) {
  throw new Error('--project is required.');
}

if (!selectedPhase || !phaseNames.includes(selectedPhase)) {
  throw new Error('--phase must be opportunities or summaries.');
}

if (shouldCommit && (limit || selectedUid)) {
  throw new Error(
    'Committed runs cannot use --limit or --uid because partial-user writes cannot be verified globally.',
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const db = admin.firestore();
const {FieldValue} = admin.firestore;
const phaseStateRoot = db
  .collection('adminMigrations')
  .doc('momentumIntegrity')
  .collection('phases');

function asNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asTimestampMs(value) {
  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }
  return undefined;
}

function getUidFromOpportunityRef(ref) {
  const segments = ref.path.split('/');
  return segments.length === 4 &&
    segments[0] === 'userPrivate' &&
    segments[2] === 'opportunities'
    ? segments[1]
    : undefined;
}

function mapOpportunity(snapshot, overrides = {}) {
  const data = {...snapshot.data(), ...overrides};
  return {
    availableDateKey: asString(data.availableDateKey),
    expectedForCircle:
      typeof data.expectedForCircle === 'boolean'
        ? data.expectedForCircle
        : undefined,
    expiresDateKey: asString(data.expiresDateKey) || undefined,
    periodKey: asString(data.periodKey),
    resolvedAtMs:
      asTimestampMs(data.resolvedAt) ??
      asTimestampMs(data.completedAt) ??
      asTimestampMs(data.updatedAt),
    resolvedDateKey:
      asString(data.completionDateKey) ||
      asString(data.expiresDateKey) ||
      undefined,
    slotIndex: asNumber(data.slotIndex, 0),
    status: data.status,
    timezone: asString(data.timezone, 'UTC'),
  };
}

function getExpectedSummary(opportunityRecords) {
  const allOpportunities = opportunityRecords.map(record =>
    mapOpportunity(record.snapshot, record.overrides),
  );
  const currentOpportunities = opportunityRecords
    .filter(
      record =>
        (record.overrides?.isCurrentPeriod ??
          record.snapshot.data().isCurrentPeriod) !== false,
    )
    .map(record => mapOpportunity(record.snapshot, record.overrides));
  const streaks = calculateMomentumStreaks({
    opportunities: allOpportunities,
  });
  const summary = calculateMomentumSummary({
    opportunities: currentOpportunities,
    periodKey: 'current',
  });

  return {
    ...summary,
    ...streaks,
    rollingMomentum: calculateRollingMomentumSummary({
      opportunities: allOpportunities,
    }),
  };
}

function getComparableSummary(summary) {
  return {
    availableOpportunities: asNumber(summary?.availableOpportunities, 0),
    bestStreak: asNumber(summary?.bestStreak, 0),
    creditedOpportunities: asNumber(summary?.creditedOpportunities, 0),
    completedOpportunities: asNumber(summary?.completedOpportunities, 0),
    currentStreak: asNumber(summary?.currentStreak, 0),
    label: asString(summary?.label),
    percentage: asNumber(summary?.percentage, 0),
    periodKey: asString(summary?.periodKey, 'current'),
    rollingMomentum: {
      hasUnrecoveredMiss: summary?.rollingMomentum?.hasUnrecoveredMiss === true,
      percentage: asNumber(summary?.rollingMomentum?.percentage, 0),
      resolvedOpportunityCount: asNumber(
        summary?.rollingMomentum?.resolvedOpportunityCount,
        0,
      ),
      status: asString(summary?.rollingMomentum?.status, 'getting_started'),
      windowDays: asNumber(summary?.rollingMomentum?.windowDays, 14),
    },
    skippedOpportunities: asNumber(summary?.skippedOpportunities, 0),
    status: asString(summary?.status, 'getting_started'),
    tapInOpportunities: asNumber(summary?.tapInOpportunities, 0),
  };
}

function summariesMatch(left, right) {
  return (
    JSON.stringify(getComparableSummary(left)) ===
    JSON.stringify(getComparableSummary(right))
  );
}

function createDistribution() {
  return {
    building_momentum: 0,
    getting_started: 0,
    peak_momentum: 0,
    strong_momentum: 0,
  };
}

function addToDistribution(distribution, summary) {
  const status = asString(summary?.rollingMomentum?.status, 'getting_started');
  if (Object.hasOwn(distribution, status)) {
    distribution[status] += 1;
  }
}

function createCalibrationCounts() {
  return {
    calibrated: 0,
    resolved0: 0,
    resolved1: 0,
    resolved2: 0,
  };
}

function addToCalibrationCounts(counts, summary) {
  const resolved = asNumber(
    summary?.rollingMomentum?.resolvedOpportunityCount,
    0,
  );
  if (resolved >= 3) {
    counts.calibrated += 1;
  } else {
    counts[`resolved${resolved}`] += 1;
  }
}

async function getOpportunityRecordsByUid() {
  const [privateUsers, snapshots] = await Promise.all([
    db.collection('userPrivate').get(),
    db.collectionGroup('opportunities').get(),
  ]);
  const byUid = new Map();

  privateUsers.docs.forEach(snapshot => {
    if (!selectedUid || snapshot.id === selectedUid) {
      byUid.set(snapshot.id, []);
    }
  });
  snapshots.docs.forEach(snapshot => {
    const uid = getUidFromOpportunityRef(snapshot.ref);
    if (!uid || (selectedUid && uid !== selectedUid)) {
      return;
    }
    const values = byUid.get(uid) ?? [];
    values.push({snapshot});
    byUid.set(uid, values);
  });

  const selectedEntries = Array.from(byUid.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, limit);

  return new Map(selectedEntries);
}

function getStoredRollingSummary(snapshot) {
  return snapshot.exists
    ? {rollingMomentum: snapshot.data().rollingMomentum}
    : undefined;
}

async function writeBatches(operations) {
  if (!shouldCommit) {
    operations.slice(0, 20).forEach(operation => {
      console.log(
        `[dry-run] set ${operation.ref.path}`,
        JSON.stringify(operation.preview),
      );
    });
    return;
  }

  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    operations.slice(index, index + 400).forEach(operation => {
      batch.set(operation.ref, operation.data, {merge: true});
    });
    await batch.commit();
  }
}

async function verifyNoExpiredExpectedOpportunityRemains() {
  const recordsByUid = await getOpportunityRecordsByUid();
  const remaining = [];

  recordsByUid.forEach(records => {
    records.forEach(record => {
      const opportunity = mapOpportunity(record.snapshot);
      if (isExpiredExpectedOpenOpportunity({opportunity})) {
        remaining.push(record.snapshot.ref.path);
      }
    });
  });

  if (remaining.length > 0) {
    throw new Error(
      `Read-back found ${
        remaining.length
      } expected expired opportunities still open. Sample: ${remaining
        .slice(0, 10)
        .join(', ')}`,
    );
  }
}

async function runOpportunitiesPhase() {
  const recordsByUid = await getOpportunityRecordsByUid();
  const operations = [];
  const affectedUids = new Set();
  const statusChanges = {};
  const unresolvedEligibilityRecords = [];
  const beforeDistribution = createDistribution();
  const afterDistribution = createDistribution();
  const beforeCalibrationCounts = createCalibrationCounts();
  const afterCalibrationCounts = createCalibrationCounts();

  for (const [uid, records] of recordsByUid) {
    const momentumRef = db
      .collection('userPrivate')
      .doc(uid)
      .collection('momentum')
      .doc('current');
    const storedMomentum = await momentumRef.get();
    const beforeSummary = getStoredRollingSummary(storedMomentum);
    addToDistribution(beforeDistribution, beforeSummary);
    addToCalibrationCounts(beforeCalibrationCounts, beforeSummary);

    records.forEach(record => {
      const data = record.snapshot.data();
      if (typeof data.expectedForCircle !== 'boolean') {
        unresolvedEligibilityRecords.push(record.snapshot.ref.path);
      }
      const opportunity = mapOpportunity(record.snapshot);
      if (!isExpiredExpectedOpenOpportunity({opportunity})) {
        return;
      }

      record.overrides = {
        isCurrentPeriod: false,
        status: 'missed',
      };
      affectedUids.add(uid);
      const transition = `${asString(data.status, 'unknown')}->missed`;
      statusChanges[transition] = (statusChanges[transition] ?? 0) + 1;
      operations.push({
        data: {
          isCurrentPeriod: false,
          resolvedAt: FieldValue.serverTimestamp(),
          status: 'missed',
          updatedAt: FieldValue.serverTimestamp(),
        },
        preview: record.overrides,
        ref: record.snapshot.ref,
      });
    });

    const afterSummary = getExpectedSummary(records);
    addToDistribution(afterDistribution, afterSummary);
    addToCalibrationCounts(afterCalibrationCounts, afterSummary);
  }

  const report = {
    affectedDocuments: operations.length,
    affectedUsers: affectedUids.size,
    afterCalibrationCounts,
    afterMomentumDistribution: afterDistribution,
    beforeCalibrationCounts,
    beforeMomentumDistribution: beforeDistribution,
    mode: shouldCommit ? 'commit' : 'dry-run',
    phase: 'opportunities',
    scannedUsers: recordsByUid.size,
    statusChanges,
    unresolvedEligibilityCount: unresolvedEligibilityRecords.length,
    unresolvedEligibilitySample: unresolvedEligibilityRecords.slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));
  await writeBatches(operations);

  if (shouldCommit) {
    await verifyNoExpiredExpectedOpportunityRemains();
    await phaseStateRoot.doc('opportunities').set(
      {
        ...report,
        completedAt: FieldValue.serverTimestamp(),
        verified: true,
      },
      {merge: true},
    );
    console.log('verified: no expected expired opportunity remains open');
  } else {
    console.log('Dry run completed with zero writes.');
  }
}

async function verifySummaries(changedUids) {
  const recordsByUid = await getOpportunityRecordsByUid();
  const failures = [];

  for (const uid of changedUids) {
    const records = recordsByUid.get(uid) ?? [];
    const expected = getExpectedSummary(records);
    const snapshot = await db
      .collection('userPrivate')
      .doc(uid)
      .collection('momentum')
      .doc('current')
      .get();
    if (!snapshot.exists || !summariesMatch(snapshot.data(), expected)) {
      failures.push(uid);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Independent summary read-back failed for ${
        failures.length
      } users. Sample: ${failures.slice(0, 10).join(', ')}`,
    );
  }
}

async function runSummariesPhase() {
  if (shouldCommit) {
    const opportunityPhase = await phaseStateRoot.doc('opportunities').get();
    if (opportunityPhase.data()?.verified !== true) {
      throw new Error(
        'The opportunities phase must be committed and verified before summaries.',
      );
    }
  }

  const recordsByUid = await getOpportunityRecordsByUid();
  const operations = [];
  const changedUids = [];
  const beforeDistribution = createDistribution();
  const afterDistribution = createDistribution();
  const beforeCalibrationCounts = createCalibrationCounts();
  const afterCalibrationCounts = createCalibrationCounts();

  for (const [uid, records] of recordsByUid) {
    const momentumRef = db
      .collection('userPrivate')
      .doc(uid)
      .collection('momentum')
      .doc('current');
    const storedMomentum = await momentumRef.get();
    const beforeSummary = getStoredRollingSummary(storedMomentum);
    const expectedSummary = getExpectedSummary(records);
    addToDistribution(beforeDistribution, beforeSummary);
    addToCalibrationCounts(beforeCalibrationCounts, beforeSummary);
    addToDistribution(afterDistribution, expectedSummary);
    addToCalibrationCounts(afterCalibrationCounts, expectedSummary);

    if (
      storedMomentum.exists &&
      summariesMatch(storedMomentum.data(), expectedSummary)
    ) {
      continue;
    }

    changedUids.push(uid);
    operations.push({
      data: {
        ...expectedSummary,
        updatedAt: FieldValue.serverTimestamp(),
      },
      preview: getComparableSummary(expectedSummary),
      ref: momentumRef,
    });
  }

  const report = {
    affectedDocuments: operations.length,
    affectedUsers: changedUids.length,
    afterCalibrationCounts,
    afterMomentumDistribution: afterDistribution,
    beforeCalibrationCounts,
    beforeMomentumDistribution: beforeDistribution,
    mode: shouldCommit ? 'commit' : 'dry-run',
    phase: 'summaries',
    scannedUsers: recordsByUid.size,
    unresolvedEligibilityCount: Array.from(recordsByUid.values())
      .flat()
      .filter(
        record => typeof record.snapshot.data().expectedForCircle !== 'boolean',
      ).length,
  };
  console.log(JSON.stringify(report, null, 2));
  await writeBatches(operations);

  if (shouldCommit) {
    await verifySummaries(changedUids);
    await phaseStateRoot.doc('summaries').set(
      {
        ...report,
        completedAt: FieldValue.serverTimestamp(),
        verified: true,
      },
      {merge: true},
    );
    console.log(`verified: ${changedUids.length} rolling summaries recomputed`);
  } else {
    console.log('Dry run completed with zero writes.');
  }
}

if (selectedPhase === 'opportunities') {
  await runOpportunitiesPhase();
} else {
  await runSummariesPhase();
}
