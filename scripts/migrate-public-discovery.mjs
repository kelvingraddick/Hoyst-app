#!/usr/bin/env node
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {
  searchTokens,
  isPublicActive,
} = require('../functions/lib/discovery/model.js');
const projectId = process.argv
  .find(arg => arg.startsWith('--project='))
  ?.slice(10);
if (!projectId) {
  throw new Error('--project is required.');
}
const commit = process.argv.includes('--commit');
const activate = process.argv.includes('--activate-activity');
admin.initializeApp({
  projectId,
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();
let reviewed = 0;
let changed = 0;
let last;
// Page through the full index and reread each record in a transaction before writing.
for (;;) {
  let query = db
    .collection('publicCircleIndex')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(200);
  if (last) {
    query = query.startAfter(last);
  }
  const page = await query.get();
  if (page.empty) {
    break;
  }
  for (const doc of page.docs) {
    reviewed++;
    await db.runTransaction(async transaction => {
      const [current, circle] = await Promise.all([
        transaction.get(doc.ref),
        transaction.get(db.collection('circles').doc(doc.id)),
      ]);
      if (!current.exists || !isPublicActive(circle.data())) {
        return;
      }
      const data = current.data();
      const tokens = searchTokens(data);
      if (
        data.searchVersion === 1 &&
        data.circleMode === 'group' &&
        data.lifecycleStatus === 'active' &&
        JSON.stringify(data.searchTokens) === JSON.stringify(tokens)
      ) {
        return;
      }
      changed++;
      if (commit) {
        transaction.update(doc.ref, {
          searchVersion: 1,
          searchTokens: tokens,
          circleMode: 'group',
          lifecycleStatus: 'active',
        });
      }
    });
  }
  last = page.docs.at(-1);
}
if (activate) {
  const ref = db.collection('serverConfig').doc('publicDiscovery');
  await db.runTransaction(async transaction => {
    const config = await transaction.get(ref);
    if (config.data()?.activityActivatedAt) {
      console.log(
        'Activity already activated; preserving its original boundary.',
      );
      return;
    }
    if (commit) {
      transaction.set(
        ref,
        {activityActivatedAt: admin.firestore.Timestamp.now()},
        {merge: true},
      );
    }
    console.log(
      commit
        ? 'New Tap In previews activated.'
        : 'Would activate new Tap In previews.',
    );
  });
}
console.log(
  JSON.stringify({mode: commit ? 'commit' : 'dry-run', reviewed, changed}),
);
