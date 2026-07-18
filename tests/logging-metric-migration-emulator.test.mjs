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
  new URL('../scripts/migrate-logging-metric-integrity.mjs', import.meta.url),
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

describe('logging and metric integrity migration', () => {
  let db;

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

    const circleRef = db.collection('circles').doc('migration-circle');
    const ownerJoinedAt = admin.firestore.Timestamp.fromDate(
      new Date('2026-07-13T12:00:00Z'),
    );
    const memberJoinedAt = admin.firestore.Timestamp.fromDate(
      new Date('2026-07-14T12:00:00Z'),
    );

    await Promise.all([
      circleRef.set({
        circleMode: 'group',
        commitment: 'Read consistently',
        commitmentCadence: 'weekly',
        commitmentFrequency: {opportunitiesPerPeriod: 2, tapInsPerWeek: 2},
        createdAt: ownerJoinedAt,
        memberCount: 2,
        timezone: 'UTC',
        title: 'Migration Circle',
      }),
      circleRef.collection('members').doc('owner-1').set({
        joinedAt: ownerJoinedAt,
        role: 'owner',
        status: 'active',
        uid: 'owner-1',
      }),
      circleRef.collection('members').doc('member-1').set({
        joinedAt: memberJoinedAt,
        role: 'member',
        status: 'active',
        uid: 'member-1',
      }),
      circleRef.collection('days').doc('2026-07-13').set({
        checkInCount: 1,
        dateKey: '2026-07-13',
      }),
      circleRef.collection('days').doc('2026-07-16').set({
        checkInCount: 1,
        dateKey: '2026-07-16',
      }),
      circleRef
        .collection('days')
        .doc('2026-07-13')
        .collection('checkIns')
        .doc('owner-1')
        .set({
          createdAt: ownerJoinedAt,
          status: 'done',
          uid: 'owner-1',
        }),
      circleRef
        .collection('days')
        .doc('2026-07-16')
        .collection('checkIns')
        .doc('member-1')
        .set({
          createdAt: admin.firestore.Timestamp.fromDate(
            new Date('2026-07-16T12:00:00Z'),
          ),
          status: 'skip',
          uid: 'member-1',
        }),
      db.collection('userPrivate').doc('owner-1').set({
        onboardingStatus: 'complete',
      }),
      db.collection('userPrivate').doc('member-1').set({
        onboardingStatus: 'complete',
      }),
      db
        .collection('userPrivate')
        .doc('member-1')
        .collection('opportunities')
        .doc('migration-circle_2026-07-13_0')
        .set({
          availableDateKey: '2026-07-13',
          circleId: 'migration-circle',
          expiresDateKey: '2026-07-15',
          isCurrentPeriod: true,
          periodKey: '2026-07-13',
          slotIndex: 0,
          status: 'missed',
        }),
      circleRef.collection('feedItems').doc('tap_in_2026-07-13_owner-1').set({
        text: 'Owner tapped in',
        type: 'tap_in',
      }),
      circleRef.collection('feedItems').doc('tap_in_2026-07-16_member-1').set({
        mediaImageUrl: null,
        note: null,
        updatedAt: memberJoinedAt,
      }),
      db
        .collection('userPrivate')
        .doc('member-1')
        .collection('inbox')
        .doc('companion_tapped_in_2026-07-13_owner-1_member-1')
        .set({
          actor: {uid: 'owner-1'},
          circleId: 'migration-circle',
          type: 'companion_tapped_in',
        }),
    ]);
  });

  after(async () => {
    await admin.app().delete();
  });

  it('runs all phases as a no-write dry run', async () => {
    const result = runMigration('--phase=all', '--limit=10');

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Dry run completed/);
    assert.equal(
      (
        await db
          .collection('circles')
          .doc('migration-circle')
          .collection('membershipHistory')
          .doc('owner-1')
          .get()
      ).exists,
      false,
    );
  });

  it('blocks committed phases until the prior phase is verified', () => {
    const result = runMigration('--phase=checkins', '--commit');

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /memberships phase/);
  });

  it('rejects limited committed runs before they can mark a partial phase complete', () => {
    const result = runMigration(
      '--phase=memberships',
      '--limit=10',
      '--commit',
    );

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /cannot use --limit/);
  });

  it('commits, verifies, and safely retries every phase', async () => {
    for (const phase of [
      'memberships',
      'checkins',
      'opportunities',
      'effects',
      'momentum',
    ]) {
      const first = runMigration(`--phase=${phase}`, '--commit');
      assert.equal(first.status, 0, first.stderr || first.stdout);
      assert.match(first.stdout, /verified:/);

      const retry = runMigration(`--phase=${phase}`, '--commit');
      assert.equal(retry.status, 0, retry.stderr || retry.stdout);
    }

    const circleRef = db.collection('circles').doc('migration-circle');
    const [ownerHistory, memberHistory, ownerCheckIn, memberCheckIn] =
      await Promise.all([
        circleRef.collection('membershipHistory').doc('owner-1').get(),
        circleRef.collection('membershipHistory').doc('member-1').get(),
        circleRef
          .collection('days')
          .doc('2026-07-13')
          .collection('checkIns')
          .doc('owner-1')
          .get(),
        circleRef
          .collection('days')
          .doc('2026-07-16')
          .collection('checkIns')
          .doc('member-1')
          .get(),
      ]);

    assert.equal(ownerHistory.data().status, 'active');
    assert.equal(memberHistory.data().status, 'active');
    assert.equal(ownerCheckIn.data().circleId, 'migration-circle');
    assert.equal(ownerCheckIn.data().coverageRevision, 1);
    assert.equal(memberCheckIn.data().coverageRevision, 1);

    const period = await circleRef
      .collection('opportunities')
      .doc('2026-07-13')
      .get();
    assert.equal(period.data().expectedOpportunityCount, 3);
    assert.equal(period.data().coveredOpportunityCount, 2);
    assert.equal(period.data().completedOpportunityCount, 1);
    assert.equal(period.data().skippedOpportunityCount, 1);

    const memberOpportunity = await db
      .collection('userPrivate')
      .doc('member-1')
      .collection('opportunities')
      .doc('migration-circle_2026-07-13_1')
      .get();
    assert.equal(memberOpportunity.data().status, 'skipped');
    assert.equal(memberOpportunity.data().expectedForCircle, true);

    const staleMemberOpportunity = await db
      .collection('userPrivate')
      .doc('member-1')
      .collection('opportunities')
      .doc('migration-circle_2026-07-13_0')
      .get();
    assert.equal(staleMemberOpportunity.data().expectedForCircle, false);
    assert.equal(staleMemberOpportunity.data().isCurrentPeriod, false);

    const memberMomentum = await db
      .collection('userPrivate')
      .doc('member-1')
      .collection('momentum')
      .doc('current')
      .get();
    assert.equal(memberMomentum.data().creditedOpportunities, 1);
    assert.equal(memberMomentum.data().skippedOpportunities, 1);
    assert.equal(memberMomentum.data().tapInOpportunities, 0);
    assert.equal(memberMomentum.data().currentStreak, 1);

    const effect = await circleRef
      .collection('checkInEffects')
      .doc('2026-07-13_owner-1')
      .get();
    const revision = await effect.ref.collection('revisions').doc('1').get();
    assert.equal(
      effect.data().sourceKey,
      'check_in:migration-circle:2026-07-13:owner-1',
    );
    assert.equal(revision.exists, true);

    const feedItems = await circleRef.collection('feedItems').get();
    assert.equal(feedItems.size, 1);
    assert.equal(
      feedItems.docs[0].data().sourceKey,
      'check_in:migration-circle:2026-07-13:owner-1',
    );
  });
});
