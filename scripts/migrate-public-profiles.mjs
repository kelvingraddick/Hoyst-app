#!/usr/bin/env node
import {createRequire} from 'node:module';
const projectId = process.argv
  .find(value => value.startsWith('--project='))
  ?.slice(10);
if (!projectId)
  throw new Error(
    'Pass --project=<project-id> explicitly. Dry run is the default.',
  );
process.env.GCLOUD_PROJECT = projectId;
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {
  publicProfile,
  syncPublicProfile,
} = require('../functions/lib/profile/public');
const commit = process.argv.includes('--commit');
let checked = 0;
let changed = 0;
let cursor;
try {
  while (true) {
    let query = db.collection('users').orderBy('__name__').limit(200);
    if (cursor) query = query.startAfter(cursor);
    const accounts = await query.get();
    if (accounts.empty) break;
    for (const account of accounts.docs) {
      const data = account.data();
      const target = await db.doc(`publicProfiles/${account.id}`).get();
      const expected =
        data.onboardingStatus === 'complete' && !data.accountDeletionStartedAt
          ? publicProfile(data)
          : undefined;
      const equal = expected
        ? target.exists &&
          Object.keys(target.data()).length === 4 &&
          Object.entries(expected).every(
            ([key, value]) => target.data()[key] === value,
          )
        : !target.exists;
      checked++;
      if (!equal) {
        changed++;
        if (commit) await syncPublicProfile(account.id);
      }
    }
    cursor = accounts.docs.at(-1);
  }
  // Orphan projections must also be removed, including accounts deleted before
  // the projection trigger was deployed. No profile values are logged.
  cursor = undefined;
  while (true) {
    let query = db.collection('publicProfiles').orderBy('__name__').limit(200);
    if (cursor) query = query.startAfter(cursor);
    const profiles = await query.get();
    if (profiles.empty) break;
    for (const profile of profiles.docs) {
      if (!(await db.doc(`users/${profile.id}`).get()).exists) {
        changed++;
        if (commit) await syncPublicProfile(profile.id);
      }
    }
    cursor = profiles.docs.at(-1);
  }
  console.log(
    JSON.stringify({
      projectId,
      mode: commit ? 'committed' : 'dry-run',
      checked,
      changed,
    }),
  );
  if (commit)
    console.log(
      'Re-run without --commit to verify changed is zero before restricting account reads.',
    );
} finally {
  await db.terminate();
}
