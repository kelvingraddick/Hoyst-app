#!/usr/bin/env node

import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const shouldCommit = process.argv.includes('--commit');
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const projectId = projectArg?.slice('--project='.length);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    ...(projectId ? {projectId} : {}),
  });
}

const db = admin.firestore();

function getTapInsPerWeek(data) {
  const value = data.commitmentFrequency?.tapInsPerWeek;

  return Number.isFinite(value) ? Math.min(7, Math.max(1, Math.round(value))) : 7;
}

function getCommitmentCadence(data) {
  if (data.commitmentCadence === 'daily' || data.commitmentCadence === 'weekly') {
    return data.commitmentCadence;
  }

  return getTapInsPerWeek(data) >= 7 ? 'daily' : 'weekly';
}

function buildCircleUpdate(data) {
  const update = {};
  const tapInsPerWeek = getTapInsPerWeek(data);

  if (data.commitmentCadence !== 'daily' && data.commitmentCadence !== 'weekly') {
    update.commitmentCadence = getCommitmentCadence(data);
  }

  if (data.commitmentFrequency?.tapInsPerWeek !== tapInsPerWeek) {
    update.commitmentFrequency = {
      ...(data.commitmentFrequency && typeof data.commitmentFrequency === 'object'
        ? data.commitmentFrequency
        : {}),
      tapInsPerWeek,
    };
  }

  return update;
}

async function migrateCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const updates = [];

  snapshot.docs.forEach(doc => {
    const update = buildCircleUpdate(doc.data());

    if (Object.keys(update).length > 0) {
      updates.push({ref: doc.ref, update});
    }
  });

  console.log(
    `${collectionName}: ${updates.length} of ${snapshot.size} documents need updates.`,
  );

  if (!shouldCommit) {
    updates.slice(0, 10).forEach(({ref, update}) => {
      console.log(`[dry-run] ${ref.path}`, JSON.stringify(update));
    });
    return updates.length;
  }

  for (let index = 0; index < updates.length; index += 450) {
    const batch = db.batch();

    updates.slice(index, index + 450).forEach(({ref, update}) => {
      batch.update(ref, update);
    });

    await batch.commit();
  }

  return updates.length;
}

async function verifyCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const problems = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();

    if (data.commitmentCadence !== 'daily' && data.commitmentCadence !== 'weekly') {
      problems.push({path: doc.ref.path, problem: 'commitmentCadence invalid'});
    }

    if (
      !Number.isInteger(data.commitmentFrequency?.tapInsPerWeek) ||
      data.commitmentFrequency.tapInsPerWeek < 1 ||
      data.commitmentFrequency.tapInsPerWeek > 7
    ) {
      problems.push({
        path: doc.ref.path,
        problem: 'commitmentFrequency.tapInsPerWeek invalid',
      });
    }
  });

  if (problems.length > 0) {
    console.error(`${collectionName}: ${problems.length} documents failed verification.`);
    problems.slice(0, 20).forEach(({path, problem}) => {
      console.error(`[verify] ${path}: ${problem}`);
    });
  } else {
    console.log(`${collectionName}: verification passed.`);
  }

  return problems.length;
}

const circleCount = await migrateCollection('circles');
const publicCircleCount = await migrateCollection('publicCircleIndex');

if (shouldCommit) {
  const problemCount =
    (await verifyCollection('circles')) +
    (await verifyCollection('publicCircleIndex'));

  if (problemCount > 0) {
    throw new Error(`Migration verification failed with ${problemCount} issues.`);
  }
}

console.log(
  shouldCommit
    ? `Committed ${circleCount + publicCircleCount} updates.`
    : 'Dry run complete. Re-run with --commit to write changes.',
);
