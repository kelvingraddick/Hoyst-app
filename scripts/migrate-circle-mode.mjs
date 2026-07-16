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

async function migrateCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const updates = snapshot.docs
    .filter(doc => doc.data().circleMode !== 'group')
    .map(doc => ({ref: doc.ref, update: {circleMode: 'group'}}));

  console.log(
    `${collectionName}: ${updates.length} of ${snapshot.size} documents need updates.`,
  );

  if (!shouldCommit) {
    updates.slice(0, 20).forEach(({ref, update}) => {
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
  const invalid = snapshot.docs.filter(
    doc => doc.data().circleMode !== 'group',
  );

  if (invalid.length > 0) {
    invalid.slice(0, 20).forEach(doc => {
      console.error(`[verify] ${doc.ref.path}: circleMode is not group`);
    });
  } else {
    console.log(`${collectionName}: verification passed.`);
  }

  return invalid.length;
}

const circleCount = await migrateCollection('circles');
const publicCircleCount = await migrateCollection('publicCircleIndex');

if (shouldCommit) {
  const problemCount =
    (await verifyCollection('circles')) +
    (await verifyCollection('publicCircleIndex'));

  if (problemCount > 0) {
    throw new Error(
      `Migration verification failed with ${problemCount} issues.`,
    );
  }
}

console.log(
  shouldCommit
    ? `Committed ${circleCount + publicCircleCount} updates.`
    : 'Dry run complete. Re-run with --commit to write changes.',
);
