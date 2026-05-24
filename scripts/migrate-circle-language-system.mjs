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
const defaultCommitmentFrequency = {tapInsPerWeek: 7};

function normalizeCircleUpdate(data) {
  const update = {};

  if (typeof data.dailyTask === 'string' && !data.commitment) {
    update.commitment = data.dailyTask;
  }

  if (!data.commitmentFrequency?.tapInsPerWeek) {
    update.commitmentFrequency = defaultCommitmentFrequency;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'dailyTask')) {
    update.dailyTask = admin.firestore.FieldValue.delete();
  }

  return update;
}

function normalizePreferencesUpdate(data) {
  const preferences = data.onboardingPreferences;

  if (
    !preferences ||
    typeof preferences !== 'object' ||
    !Object.prototype.hasOwnProperty.call(preferences, 'goal')
  ) {
    return undefined;
  }

  const nextPreferences = {...preferences};

  if (!nextPreferences.focusArea && typeof preferences.goal === 'string') {
    nextPreferences.focusArea = preferences.goal;
  }

  delete nextPreferences.goal;

  return {onboardingPreferences: nextPreferences};
}

async function migrateCollection(collectionName, buildUpdate) {
  const snapshot = await db.collection(collectionName).get();
  const updates = [];

  snapshot.docs.forEach(doc => {
    const update = buildUpdate(doc.data());

    if (update && Object.keys(update).length > 0) {
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

async function verifyCollection(collectionName, getProblems) {
  const snapshot = await db.collection(collectionName).get();
  const problems = [];

  snapshot.docs.forEach(doc => {
    const docProblems = getProblems(doc.data());

    if (docProblems.length > 0) {
      problems.push({path: doc.ref.path, problems: docProblems});
    }
  });

  if (problems.length > 0) {
    console.error(`${collectionName}: ${problems.length} documents failed verification.`);
    problems.slice(0, 20).forEach(({path, problems: docProblems}) => {
      console.error(`[verify] ${path}: ${docProblems.join(', ')}`);
    });
  } else {
    console.log(`${collectionName}: verification passed.`);
  }

  return problems.length;
}

function getCircleProblems(data) {
  const problems = [];

  if (Object.prototype.hasOwnProperty.call(data, 'dailyTask')) {
    problems.push('legacy dailyTask still present');
  }

  if (typeof data.commitment !== 'string' || !data.commitment.trim()) {
    problems.push('commitment missing');
  }

  if (
    !Number.isInteger(data.commitmentFrequency?.tapInsPerWeek) ||
    data.commitmentFrequency.tapInsPerWeek < 1 ||
    data.commitmentFrequency.tapInsPerWeek > 7
  ) {
    problems.push('commitmentFrequency.tapInsPerWeek invalid');
  }

  return problems;
}

function getUserPrivateProblems(data) {
  const preferences = data.onboardingPreferences;

  if (
    preferences &&
    typeof preferences === 'object' &&
    Object.prototype.hasOwnProperty.call(preferences, 'goal')
  ) {
    return ['legacy onboardingPreferences.goal still present'];
  }

  return [];
}

const circleCount = await migrateCollection('circles', normalizeCircleUpdate);
const publicCircleCount = await migrateCollection(
  'publicCircleIndex',
  normalizeCircleUpdate,
);
const userPrivateCount = await migrateCollection(
  'userPrivate',
  normalizePreferencesUpdate,
);

if (shouldCommit) {
  const problemCount =
    (await verifyCollection('circles', getCircleProblems)) +
    (await verifyCollection('publicCircleIndex', getCircleProblems)) +
    (await verifyCollection('userPrivate', getUserPrivateProblems));

  if (problemCount > 0) {
    throw new Error(`Migration verification failed with ${problemCount} issues.`);
  }
}

console.log(
  shouldCommit
    ? `Committed ${circleCount + publicCircleCount + userPrivateCount} updates.`
    : 'Dry run complete. Re-run with --commit to write changes.',
);
