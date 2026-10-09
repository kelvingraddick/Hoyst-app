#!/usr/bin/env node
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {searchTokens} = require('../functions/lib/discovery/model');
const projectId = process.argv
  .find(arg => arg.startsWith('--project='))
  ?.slice(10);
if (!projectId) {
  throw new Error(
    'Supply --project=<project-id>. Defaults to dry run; --commit applies.',
  );
}
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});
const db = admin.firestore();
const snapshot = await db.collection('publicCircleIndex').get();
let changed = 0;
for (const doc of snapshot.docs) {
  const tokens = searchTokens(doc.data());
  if (
    JSON.stringify(tokens) === JSON.stringify(doc.data().searchTokens) &&
    doc.data().searchVersion === 1
  ) {
    continue;
  }
  changed++;
  console.log(
    `${process.argv.includes('--commit') ? 'refresh' : 'dry-run'} ${doc.id}: ${
      tokens.length
    } tokens`,
  );
  if (process.argv.includes('--commit')) {
    // Transaction recomputes from current metadata, preserving concurrent edits and sort timestamps.
    await db.runTransaction(async tx => {
      const current = await tx.get(doc.ref);
      if (!current.exists) {
        return;
      }
      tx.update(doc.ref, {
        searchTokens: searchTokens(current.data()),
        searchVersion: 1,
      });
    });
  }
}
console.log(
  `${changed} of ${snapshot.size} indexes need refresh. No other fields are written.`,
);
