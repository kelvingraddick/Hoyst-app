#!/usr/bin/env node
// Read-only aggregate check. Requires normal Google ADC for this Firebase project.
import {createRequire} from 'node:module';
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const {initializeApp, applicationDefault} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const position = arg.indexOf('=');
    return [arg.slice(2, position), arg.slice(position + 1)];
  }),
);
if (!args.project || !args.start || !args.end)
  throw new Error(
    'Pass --project=ID --start=ISO_TIMESTAMP --end=ISO_TIMESTAMP. End is exclusive.',
  );
const start = new Date(args.start),
  end = new Date(args.end);
if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start)
  throw new Error('Invalid date range');
initializeApp({credential: applicationDefault(), projectId: args.project});
const db = getFirestore();
const exclude = new Set(
  (process.env.BETA_INTERNAL_UIDS ?? '').split(',').filter(Boolean),
);
const bounded = query =>
  query
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end));
const [users, circles, taps] = await Promise.all([
  bounded(db.collection('users')).get(),
  bounded(db.collection('circles')).get(),
  bounded(db.collectionGroup('checkIns')).get(),
]);
const cohort = new Set(
  users.docs
    .filter(
      doc => doc.data().onboardingStatus === 'complete' && !exclude.has(doc.id),
    )
    .map(doc => doc.id),
);
const outcomes = new Set(['done', 'partial', 'failed']);
const saved = taps.docs.filter(
  doc =>
    cohort.has(doc.data().uid ?? doc.id) && outcomes.has(doc.data().status),
);
console.log(
  JSON.stringify(
    {
      start: start.toISOString(),
      endExclusive: end.toISOString(),
      onboardedAccounts: cohort.size,
      commitmentsCreated: circles.docs.filter(doc =>
        cohort.has(doc.data().ownerId),
      ).length,
      currentNonSkipTapInRecords: saved.length,
      onboardedAccountsWithCurrentNonSkipTapIns: new Set(
        saved.map(doc => doc.data().uid ?? doc.id),
      ).size,
      caveat:
        'Current surviving Firebase records, not historical event totals. Edits, removals and account deletion can differ from PostHog. createdAt is a profile timestamp, not a guaranteed exact onboarding-completion timestamp. No records are changed.',
    },
    null,
    2,
  ),
);
