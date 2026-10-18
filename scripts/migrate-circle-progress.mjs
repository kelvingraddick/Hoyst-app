#!/usr/bin/env node
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const args = process.argv.slice(2);
const arg = name =>
  args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const project = arg('project');
const phase = arg('phase');
const commit = args.includes('--commit');
if (!project) {
  throw new Error('An explicit --project is required.');
}
if (!/^[a-z][a-z0-9-]{4,62}$/.test(project)) {
  throw new Error('Use a valid explicit Firebase project ID.');
}
if (arg('circle') && !/^[a-zA-Z0-9_-]{1,128}$/.test(arg('circle'))) {
  throw new Error('Use a Circle document ID.');
}
if (!['daily-coverage', 'period-outcomes', 'summaries'].includes(phase)) {
  throw new Error('Choose --phase=daily-coverage|period-outcomes|summaries.');
}
if (commit && arg('limit')) {
  throw new Error(
    '--limit is for dry runs only. Use --circle for an explicit canary.',
  );
}
const pageSize = Math.min(100, Math.max(1, Number(arg('page-size')) || 25));
// Select the target before application imports initialize Admin. Credentials
// authorize access, but must not implicitly choose a different project.
admin.initializeApp({projectId: project});
const {
  reconcileCircleProgress,
  readCircleProgressSources,
  calculateCircleProgress,
} = require('../functions/lib/circles/progress.js');
const db = admin.firestore();
if (
  admin.app().options.projectId &&
  admin.app().options.projectId !== project &&
  !process.env.FIRESTORE_EMULATOR_HOST
) {
  throw new Error(
    'Configured project does not match --project. Set GCLOUD_PROJECT to the explicit project.',
  );
}
const checkpoint = db.doc(`adminMigrations/circleProgressV2/phases/${phase}`);
let cursor =
  arg('after-id') ??
  (args.includes('--resume')
    ? (await checkpoint.get()).data()?.lastId
    : undefined);
let processed = 0;
let unavailable = 0;
let changed = 0;
const maximum = Number(arg('limit')) || Infinity;
do {
  let query = db
    .collection('circles')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(Math.min(pageSize, maximum - processed));
  if (cursor) {
    query = query.startAfter(cursor);
  }
  const selected = arg('circle')
    ? {docs: [await db.doc(`circles/${arg('circle')}`).get()]}
    : await query.get();
  if (!selected.docs.length) {
    break;
  }
  for (const circle of selected.docs) {
    if (!circle.exists) {
      throw new Error('Requested Circle does not exist.');
    }
    const sources = await readCircleProgressSources(circle.id);
    if (!sources) {
      continue;
    }
    const computed = calculateCircleProgress(sources);
    const before = circle.data().groupStreak?.streak?.count;
    const after = computed.group.streak.count;
    if (after === null) {
      unavailable++;
    }
    if (before !== after) {
      changed++;
    }
    if (
      commit &&
      !(await reconcileCircleProgress({circleId: circle.id, phase}))
    ) {
      throw new Error(
        `Circle ${circle.id} changed during reconciliation. Rerun with --resume; the checkpoint was not advanced.`,
      );
    }
    processed++;
    cursor = circle.id;
    console.log(
      JSON.stringify({
        circleId: circle.id,
        phase,
        commit,
        groupBefore: before ?? null,
        groupAfter: after,
        unit: computed.group.streak.unit,
        days: computed.daily.size,
        periods: computed.results.length,
      }),
    );
    if (commit && !arg('circle')) {
      await checkpoint.set(
        {
          lastId: cursor,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
    }
  }
  if (arg('circle') || processed >= maximum) {
    break;
  }
} while (true);
console.log(
  JSON.stringify({
    phase,
    commit,
    processed,
    unavailable,
    changed,
    lastId: cursor ?? null,
  }),
);
