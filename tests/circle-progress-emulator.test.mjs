import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {before, after, beforeEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const projectId = 'demo-hoyst-circle-progress';
const now = new Date('2026-10-17T16:00:00Z');
const stamp = day =>
  admin.firestore.Timestamp.fromDate(new Date(`${day}T12:00:00Z`));
let db, progress, materialize, environment;

describe('Circle progress reconciliation and migration', () => {
  before(async () => {
    assert.ok(
      process.env.FIRESTORE_EMULATOR_HOST,
      'Firestore emulator is required',
    );
    if (!admin.apps.length) {
      admin.initializeApp({projectId});
    }
    db = admin.firestore();
    progress = require('../functions/lib/circles/progress.js');
    materialize =
      require('../functions/lib/momentum/index.js').materializeCurrentCircleOpportunities;
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(
          new URL('../firestore.rules', import.meta.url),
          'utf8',
        ),
      },
    });
  });
  after(async () => {
    await environment.cleanup();
    await admin.app().delete();
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    const circle = db.doc('circles/test-circle');
    await circle.set({
      circleMode: 'group',
      privacy: 'public',
      lifecycleStatus: 'active',
      createdAt: stamp('2026-09-28'),
      commitmentCadence: 'weekly',
      commitmentFrequency: {tapInsPerWeek: 3, opportunitiesPerPeriod: 3},
      timezone: 'UTC',
      memberCount: 2,
      title: 'Test Circle',
      commitment: 'Move',
    });
    for (const uid of ['me', 'other']) {
      await db.doc(`users/${uid}`).set({displayName: uid, timezone: 'UTC'});
      await circle
        .collection('members')
        .doc(uid)
        .set({
          uid,
          joinedAt: stamp('2026-09-28'),
          status: 'active',
          opportunityEligibility: 'include_current',
        });
      await circle.collection('membershipHistory').doc(uid).set({uid});
      await circle
        .collection('membershipHistory')
        .doc(uid)
        .collection('periods')
        .doc('initial')
        .set({
          uid,
          joinedAt: stamp('2026-09-28'),
          opportunityEligibility: 'include_current',
        });
      for (const day of [
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-12',
        '2026-10-13',
        ...(uid === 'me' ? ['2026-10-14'] : []),
      ]) {
        await circle.collection('days').doc(day).set({dateKey: day});
        await circle
          .collection('days')
          .doc(day)
          .collection('checkIns')
          .doc(uid)
          .set({
            uid,
            status: 'done',
            coverageStatus: 'covered',
            createdAt: stamp(day),
          });
      }
    }
  });
  it('persists independent personal/group counts and historical daily coverage', async () => {
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.count, 3);
    assert.equal(result.group.streak.count, 2);
    assert.equal(result.viewer.streak.unit, 'week');
    assert.deepEqual(result.group.progress, {
      covered: 1,
      required: 2,
      outcome: 'open',
    });
    const day = (
      await db.doc('circles/test-circle/days/2026-10-14').get()
    ).data().activityCoverage;
    assert.equal(day.known, true);
    assert.deepEqual(day.completedUids, ['me']);
    assert.equal(
      (await db.doc('userPrivate/me/circleProgress/test-circle').get()).data()
        .streak.count,
      3,
    );
    assert.equal(
      (await db.doc('publicCircleIndex/test-circle').get()).data().groupStreak
        .streak.count,
      2,
    );
  });
  it('recalculates on corrections and valid protected days without touching the wallet', async () => {
    await db
      .doc('circles/test-circle/days/2026-10-14/checkIns/me')
      .update({status: 'partial', coverageStatus: 'partial'});
    let result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.count, 2);
    await db.doc('circles/test-circle/days/2026-10-14/checkIns/me').update({
      status: 'skip',
      coverageStatus: 'skipped',
      protectionKind: 'restore',
    });
    result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.count, 3);
    assert.equal(
      (await db.collection('userPrivate/me/progressLedger').get()).size,
      0,
    );
    assert.deepEqual(
      (await db.doc('circles/test-circle/days/2026-10-14').get()).data()
        .activityCoverage.restoredUids,
      ['me'],
    );
  });
  it('does not turn missing membership history into zero or an invented cohort', async () => {
    await db
      .doc('circles/test-circle/membershipHistory/other/periods/initial')
      .delete();
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.group.streak.availability, 'unavailable');
    assert.equal(result.group.streak.count, null);
    assert.equal(result.viewer.streak.count, 3);
  });
  it('uses membership history instead of current membership for past days', async () => {
    await db
      .doc('circles/test-circle/membershipHistory/other/periods/initial')
      .update({leftAt: stamp('2026-10-13')});
    await db
      .doc('circles/test-circle/members/other')
      .update({status: 'inactive', leftAt: stamp('2026-10-13')});
    await progress.reconcileCircleProgress({circleId: 'test-circle', now});
    const before = (
      await db.doc('circles/test-circle/days/2026-10-12').get()
    ).data().activityCoverage;
    const after = (
      await db.doc('circles/test-circle/days/2026-10-14').get()
    ).data().activityCoverage;
    assert.deepEqual(before.expectedUids, ['me', 'other']);
    assert.deepEqual(after.expectedUids, ['me']);
  });
  it('starts a new personal run on rejoining', async () => {
    await db
      .doc('circles/test-circle/membershipHistory/me/periods/initial')
      .update({leftAt: stamp('2026-10-14')});
    await db
      .doc('circles/test-circle/membershipHistory/me/periods/rejoin')
      .set({
        uid: 'me',
        joinedAt: stamp('2026-10-15'),
        opportunityEligibility: 'next_opening',
      });
    await db.doc('circles/test-circle/members/me').update({
      joinedAt: stamp('2026-10-15'),
      opportunityEligibility: 'next_opening',
    });
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.count, 0);
    assert.equal(result.viewer.progress.required, 3);
    assert.equal(result.viewer.progress.covered, 0);
  });
  it('freezes an archive without awarding a partially completed period', async () => {
    await db.doc('circles/test-circle/days/2026-10-13/checkIns/me').delete();
    await db.doc('circles/test-circle/days/2026-10-14/checkIns/me').delete();
    await db
      .doc('circles/test-circle')
      .update({lifecycleStatus: 'archived', archivedAt: stamp('2026-10-14')});
    await db
      .doc('circles/test-circle/lifecycleHistory/2')
      .set({status: 'archived', at: stamp('2026-10-14')});
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.count, 2);
    assert.equal(result.viewer.progress.outcome, 'neutral');
  });
  it('keeps recomputation idempotent under concurrent calls', async () => {
    const results = await Promise.all([
      progress.reconcileCircleProgress({
        circleId: 'test-circle',
        uid: 'me',
        now,
      }),
      progress.reconcileCircleProgress({
        circleId: 'test-circle',
        uid: 'me',
        now,
      }),
    ]);
    assert.ok(results.some(Boolean));
    assert.equal(
      (await db.doc('userPrivate/me/circleProgress/test-circle').get()).data()
        .streak.count,
      3,
    );
    await progress.reconcileCircleProgress({circleId: 'test-circle', now});
    assert.equal(
      (await db.collection('userPrivate/me/circlePeriods').get()).size,
      3,
    );
  });
  it('hydrates period-quota opportunities from dated facts without minting XP', async () => {
    await materialize('test-circle', now);
    const slots = await db.collection('userPrivate/me/opportunities').get();
    assert.equal(slots.size, 3);
    assert.ok(
      slots.docs.every(
        slot =>
          slot.data().status === 'completed' &&
          slot.data().policyVersion === 2 &&
          slot.data().creditLocked === true,
      ),
    );
    assert.equal(
      (await db.collection('userPrivate/me/progressLedger').get()).size,
      0,
    );
    await materialize('test-circle', now);
    assert.equal(
      (await db.collection('userPrivate/me/opportunities').get()).size,
      3,
    );
  });
  it('dry runs every migration phase without writes, then reruns a committed canary safely', async () => {
    const run = (...args) =>
      spawnSync(
        process.execPath,
        [
          'scripts/migrate-circle-progress.mjs',
          `--project=${projectId}`,
          '--circle=test-circle',
          ...args,
        ],
        {
          cwd: new URL('..', import.meta.url),
          env: {...process.env, GCLOUD_PROJECT: projectId},
          encoding: 'utf8',
        },
      );
    for (const phase of ['daily-coverage', 'period-outcomes', 'summaries']) {
      const dry = run(`--phase=${phase}`);
      assert.equal(dry.status, 0, dry.stderr);
    }
    assert.equal(
      (await db.doc('circleProgressSources/test-circle').get()).exists,
      false,
    );
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const phase of ['daily-coverage', 'period-outcomes', 'summaries']) {
        const committed = run(`--phase=${phase}`, '--commit');
        assert.equal(committed.status, 0, committed.stderr);
      }
    }
    assert.equal(
      (await db.collection('userPrivate/me/progressLedger').get()).size,
      0,
    );
    assert.ok(
      (await db.doc('userPrivate/me/circleProgress/test-circle').get()).exists,
    );
  });
  it('protects private summaries and blocks client writes to every new aggregate', async () => {
    await progress.reconcileCircleProgress({circleId: 'test-circle', now});
    const me = environment.authenticatedContext('me').firestore();
    const other = environment.authenticatedContext('other').firestore();
    const guest = environment.unauthenticatedContext().firestore();
    await assertSucceeds(
      getDoc(doc(me, 'userPrivate/me/circleProgress/test-circle')),
    );
    await assertFails(
      getDoc(doc(other, 'userPrivate/me/circleProgress/test-circle')),
    );
    await assertFails(
      getDoc(doc(guest, 'circles/test-circle/days/2026-10-14')),
    );
    await assertSucceeds(
      getDoc(doc(other, 'circles/test-circle/days/2026-10-14')),
    );
    await assertFails(
      setDoc(doc(me, 'userPrivate/me/circleProgress/test-circle'), {
        streak: {count: 999},
      }),
    );
    await assertFails(
      setDoc(doc(me, 'circles/test-circle/progressPeriods/2026-10-12'), {
        outcome: 'secured',
      }),
    );
  });
  it('charges one skip for one quota contribution, deduplicates retries, and refunds an open reversal', async () => {
    const {submitTapIn, removeTapIn} = require('../functions/lib/checkins');
    const {ensureProgress} = require('../functions/lib/progress');
    const request = (data = {}) => ({auth: {uid: 'me', token: {}}, data});
    await db.doc('serverConfig/progress').set({
      earningEnabled: true,
      inventoryEnforced: true,
      restoringEnabled: true,
    });
    await db.doc('users/me').set(
      {
        onboardingStatus: 'complete',
        displayName: 'Me',
        handle: 'me',
        timezone: 'UTC',
      },
      {merge: true},
    );
    await db.doc('circles/test-circle').set(
      {
        commitmentType: 'build',
        graceRules: {skip: {allowance: 100, windowDays: 7}},
      },
      {merge: true},
    );
    await ensureProgress.run(request());
    const wallet = db.doc('userPrivate/me/progress/current');
    const initial = (await wallet.get()).data().inventory.skips;
    for (const day of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      await db.doc(`circles/test-circle/days/${day}/checkIns/me`).delete();
    }
    const first = await submitTapIn.run(
      request({circleId: 'test-circle', status: 'skip', progressVersion: 1}),
    );
    assert.equal(first.circleProgress.viewer.progress.covered, 1);
    assert.equal(first.circleProgress.viewer.streak.unit, 'week');
    await assert.rejects(
      submitTapIn.run(
        request({circleId: 'test-circle', status: 'skip', progressVersion: 1}),
      ),
      /already tapped in/,
    );
    assert.equal((await wallet.get()).data().inventory.skips, initial - 1);
    await removeTapIn.run(request({circleId: 'test-circle'}));
    await removeTapIn.run(request({circleId: 'test-circle'}));
    assert.equal((await wallet.get()).data().inventory.skips, initial);
  });
  it('rebuilds from recorded coverage after cadence edits without regrading quantity entries', async () => {
    await db
      .doc('circles/test-circle/days/2026-10-15')
      .set({dateKey: '2026-10-15'});
    await db.doc('circles/test-circle/days/2026-10-15/checkIns/me').set({
      uid: 'me',
      status: 'done',
      coverageStatus: 'partial',
      currentValue: 99,
    });
    await db.doc('circles/test-circle').set(
      {
        commitmentCadence: 'monthly',
        commitmentFrequency: {opportunitiesPerPeriod: 3, tapInsPerWeek: 3},
        quantity: {minimum: 1000},
      },
      {merge: true},
    );
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.streak.unit, 'month');
    assert.equal(result.viewer.progress.covered, 3);
    assert.equal(result.viewer.progress.outcome, 'secured');
  });

  it('restores exactly one missing quota contribution, charges once, and rejects a deficient period', async () => {
    const {
      getRestoreOptions,
      restoreStreak,
    } = require('../functions/lib/progress/restores');
    const {ensureProgress} = require('../functions/lib/progress');
    const request = (data = {}) => ({auth: {uid: 'me', token: {}}, data});
    await db.doc('serverConfig/progress').set({
      earningEnabled: true,
      inventoryEnforced: true,
      restoringEnabled: true,
    });
    await db.doc('users/me').set(
      {
        onboardingStatus: 'complete',
        displayName: 'Me',
        handle: 'me',
        timezone: 'UTC',
      },
      {merge: true},
    );
    await ensureProgress.run(request());
    await db.doc('circles/test-circle/days/2026-10-07/checkIns/me').delete();
    for (const [start, end] of [
      ['2026-09-28', '2026-10-04'],
      ['2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-18'],
    ]) {
      for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
        await db
          .doc(
            `userPrivate/me/opportunities/test-circle_${start}_v2_${slotIndex}`,
          )
          .set({
            circleId: 'test-circle',
            cadence: 'weekly',
            policyVersion: 2,
            periodKey: start,
            slotIndex,
            availableDateKey: start,
            expiresDateKey: end,
            timezone: 'UTC',
            expectedForCircle: true,
            opportunitiesPerPeriod: 3,
            status:
              start === '2026-10-05' && slotIndex === 2
                ? 'missed'
                : 'completed',
          });
      }
    }
    const choices = await getRestoreOptions.run(request());
    assert.equal(choices.options.length, 1);
    await db.doc('circles/test-circle/days/2026-10-06/checkIns/me').delete();
    assert.equal((await getRestoreOptions.run(request())).options.length, 0);
    await db.doc('circles/test-circle/days/2026-10-06/checkIns/me').set({
      uid: 'me',
      status: 'done',
      coverageStatus: 'covered',
      createdAt: stamp('2026-10-06'),
    });
    const input = {
      opportunityId: choices.options[0].slot.id,
      requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    };
    const results = await Promise.all([
      restoreStreak.run(request(input)),
      restoreStreak.run(request(input)),
    ]);
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.equal(
      (await db.doc('userPrivate/me/progress/current').get()).data().inventory
        .restores,
      0,
    );
    const outcome = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(outcome.viewer.streak.count, 3);
  });

  it('keeps a new membership run responsible after leaving and rejoining within the same period', async () => {
    const ref = db.doc(
      'circles/test-circle/membershipHistory/me/periods/initial',
    );
    await ref.set({leftAt: stamp('2026-10-15')}, {merge: true});
    await db
      .doc('circles/test-circle/membershipHistory/me/periods/rejoined')
      .set({
        uid: 'me',
        joinedAt: stamp('2026-10-16'),
        opportunityEligibility: 'next_opening',
      });
    await db.doc('circles/test-circle/members/me').set({
      uid: 'me',
      joinedAt: stamp('2026-10-16'),
      opportunityEligibility: 'next_opening',
      status: 'active',
    });
    const result = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(result.viewer.progress.required, 2);
    assert.equal(result.viewer.progress.covered, 0);
    assert.equal(result.viewer.streak.count, 0);
    const groupMe = (
      await db.doc('circles/test-circle/progressPeriods/2026-10-12').get()
    )
      .data()
      .members.find(member => member.uid === 'me');
    assert.equal(groupMe.outcome, 'open');
    assert.equal(groupMe.required, 5);
    const privatePeriods = await db
      .collection('userPrivate/me/circlePeriods')
      .get();
    assert.ok(privatePeriods.docs.some(doc => doc.data().runId === 'initial'));
    assert.ok(privatePeriods.docs.some(doc => doc.data().runId === 'rejoined'));
  });
  it('does not replay XP when a hydrated success is replaced by protection and completed again', async () => {
    const {submitTapIn} = require('../functions/lib/checkins');
    const {ensureProgress} = require('../functions/lib/progress');
    const request = data => ({auth: {uid: 'me', token: {}}, data});
    await db
      .doc('serverConfig/progress')
      .set({earningEnabled: true, inventoryEnforced: true});
    await db
      .doc('users/me')
      .set(
        {
          onboardingStatus: 'complete',
          displayName: 'Me',
          handle: 'me',
          timezone: 'UTC',
        },
        {merge: true},
      );
    await db
      .doc('circles/test-circle')
      .set({commitmentType: 'build'}, {merge: true});
    const today = new Date().toISOString().slice(0, 10);
    await db.doc(`circles/test-circle/days/${today}`).set({dateKey: today});
    await db
      .doc(`circles/test-circle/days/${today}/checkIns/me`)
      .set({
        uid: 'me',
        status: 'done',
        coverageStatus: 'covered',
        createdAt: admin.firestore.Timestamp.now(),
      });
    await db.doc('circles/test-circle/days/2026-10-14/checkIns/me').delete();
    await ensureProgress.run(request({}));
    await materialize('test-circle');
    await submitTapIn.run(
      request({circleId: 'test-circle', status: 'skip', progressVersion: 1}),
    );
    await submitTapIn.run(
      request({circleId: 'test-circle', status: 'done', progressVersion: 1}),
    );
    assert.equal(
      (await db.collection('userPrivate/me/progressLedger').get()).docs.filter(
        doc => doc.id.startsWith('opportunity_'),
      ).length,
      0,
    );
  });
  it('marks incomplete lifecycle evidence unavailable and starts group history at conversion', async () => {
    await db
      .doc('circles/test-circle/lifecycleHistory/unknown')
      .set({
        status: 'active',
        at: stamp('2026-10-11'),
        historyKnownBefore: false,
      });
    let value = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(value.viewer.streak.count, null);
    await db.doc('circles/test-circle/lifecycleHistory/unknown').delete();
    await db
      .doc('circles/test-circle')
      .set({convertedAt: stamp('2026-10-13')}, {merge: true});
    value = await progress.reconcileCircleProgress({
      circleId: 'test-circle',
      uid: 'me',
      now,
    });
    assert.equal(value.viewer.streak.count, 3);
    assert.equal(value.group.streak.count, 0);
  });
});
