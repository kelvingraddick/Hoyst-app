import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {after, before, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const projectId = 'hoyst-firebase-app';
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const migrationScript = fileURLToPath(
  new URL('../scripts/migrate-momentum-integrity.mjs', import.meta.url),
);

function runMigration(...args) {
  return spawnSync(
    process.execPath,
    [migrationScript, `--project=${projectId}`, ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {...process.env, GCLOUD_PROJECT: projectId},
    },
  );
}

function formatDateKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

describe('momentum integrity migration', () => {
  let db;
  let todayDateKey;

  before(async () => {
    if (!admin.apps.length) {
      admin.initializeApp({projectId});
    }
    db = admin.firestore();

    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
    if (!emulatorHost) {
      throw new Error('FIRESTORE_EMULATOR_HOST is required.');
    }
    const clearResponse = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      {method: 'DELETE'},
    );
    if (!clearResponse.ok) {
      throw new Error(
        `Could not clear Firestore emulator: ${clearResponse.status}`,
      );
    }

    todayDateKey = formatDateKey(new Date());
    const userPrivateRef = db.collection('userPrivate').doc('user-1');
    const opportunitiesRef = userPrivateRef.collection('opportunities');
    await Promise.all([
      userPrivateRef.set({onboardingStatus: 'complete'}),
      userPrivateRef
        .collection('momentum')
        .doc('current')
        .set({
          availableOpportunities: 1,
          creditedOpportunities: 1,
          percentage: 100,
          periodKey: 'current',
          rollingMomentum: {
            hasUnrecoveredMiss: false,
            percentage: 100,
            resolvedOpportunityCount: 1,
            status: 'peak_momentum',
            windowDays: 14,
          },
          status: 'peak_momentum',
        }),
      opportunitiesRef.doc('completed').set({
        availableDateKey: shiftDateKey(todayDateKey, -2),
        expectedForCircle: true,
        expiresDateKey: shiftDateKey(todayDateKey, -2),
        isCurrentPeriod: false,
        periodKey: shiftDateKey(todayDateKey, -2),
        slotIndex: 0,
        status: 'completed',
        timezone: 'UTC',
      }),
      opportunitiesRef.doc('expired-current-flag').set({
        availableDateKey: shiftDateKey(todayDateKey, -1),
        expectedForCircle: true,
        expiresDateKey: shiftDateKey(todayDateKey, -1),
        isCurrentPeriod: true,
        periodKey: shiftDateKey(todayDateKey, -1),
        slotIndex: 0,
        status: 'available',
        timezone: 'UTC',
      }),
      opportunitiesRef.doc('expired-non-current-flag').set({
        availableDateKey: shiftDateKey(todayDateKey, -1),
        expectedForCircle: true,
        expiresDateKey: shiftDateKey(todayDateKey, -1),
        isCurrentPeriod: false,
        periodKey: shiftDateKey(todayDateKey, -1),
        slotIndex: 1,
        status: 'upcoming',
        timezone: 'UTC',
      }),
      opportunitiesRef.doc('current').set({
        availableDateKey: todayDateKey,
        expectedForCircle: true,
        expiresDateKey: todayDateKey,
        isCurrentPeriod: true,
        periodKey: todayDateKey,
        slotIndex: 0,
        status: 'available',
        timezone: 'UTC',
      }),
    ]);
  });

  after(async () => {
    await admin.app().delete();
  });

  it('dry-runs without writes and rejects partial committed runs', async () => {
    const dryRun = runMigration('--phase=opportunities');
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.match(dryRun.stdout, /"affectedDocuments": 2/);
    assert.match(dryRun.stdout, /Dry run completed with zero writes/);

    const unchanged = await db
      .collection('userPrivate')
      .doc('user-1')
      .collection('opportunities')
      .doc('expired-current-flag')
      .get();
    assert.equal(unchanged.data().status, 'available');

    const partialCommit = runMigration(
      '--phase=opportunities',
      '--uid=user-1',
      '--commit',
    );
    assert.notEqual(partialCommit.status, 0);
    assert.match(
      `${partialCommit.stdout}${partialCommit.stderr}`,
      /partial-user writes/,
    );
  });

  it('repairs opportunities, recalculates summaries, and retries cleanly', async () => {
    const opportunities = runMigration('--phase=opportunities', '--commit');
    assert.equal(
      opportunities.status,
      0,
      opportunities.stderr || opportunities.stdout,
    );
    assert.match(
      opportunities.stdout,
      /no expected expired opportunity remains open/,
    );

    for (const id of ['expired-current-flag', 'expired-non-current-flag']) {
      const snapshot = await db
        .collection('userPrivate')
        .doc('user-1')
        .collection('opportunities')
        .doc(id)
        .get();
      assert.equal(snapshot.data().status, 'missed');
      assert.equal(snapshot.data().isCurrentPeriod, false);
      assert.ok(snapshot.data().resolvedAt);
    }

    const summaries = runMigration('--phase=summaries', '--commit');
    assert.equal(summaries.status, 0, summaries.stderr || summaries.stdout);
    assert.match(summaries.stdout, /rolling summaries recomputed/);

    const momentum = await db
      .collection('userPrivate')
      .doc('user-1')
      .collection('momentum')
      .doc('current')
      .get();
    assert.deepEqual(momentum.data().rollingMomentum, {
      hasUnrecoveredMiss: true,
      percentage: 33,
      resolvedOpportunityCount: 3,
      status: 'strong_momentum',
      windowDays: 14,
    });
    assert.equal(momentum.data().availableOpportunities, 1);
    assert.equal(momentum.data().creditedOpportunities, 0);

    const opportunityRetry = runMigration('--phase=opportunities');
    assert.equal(
      opportunityRetry.status,
      0,
      opportunityRetry.stderr || opportunityRetry.stdout,
    );
    assert.match(opportunityRetry.stdout, /"affectedDocuments": 0/);

    const summaryRetry = runMigration('--phase=summaries');
    assert.equal(
      summaryRetry.status,
      0,
      summaryRetry.stderr || summaryRetry.stdout,
    );
    assert.match(summaryRetry.stdout, /"affectedDocuments": 0/);
  });
});
