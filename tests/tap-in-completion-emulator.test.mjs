import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
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
const projectId = 'demo-hoyst-completion';
const uid = 'completion-owner';
const today = () => new Date().toISOString().slice(0, 10);
let db, environment, submitTapIn, removeTapIn, processTapInCompletion;
const call = (fn, data) => fn.run({auth: {uid, token: {}}, data});
const checkRef = () =>
  db.doc(`circles/circle-1/days/${today()}/checkIns/${uid}`);
const completionRef = id => db.doc(`userPrivate/${uid}/tapInCompletions/${id}`);
const save = (extra = {}) =>
  call(submitTapIn, {
    circleId: 'circle-1',
    progressVersion: 1,
    completionVersion: 2,
    ...extra,
  });

async function seed(extra = {}) {
  const joinedAt = admin.firestore.Timestamp.fromMillis(
    Date.now() - 3 * 86400000,
  );
  await db.doc(`users/${uid}`).set({
    onboardingStatus: 'complete',
    displayName: 'Test',
    handle: 'completion_test',
    timezone: 'UTC',
  });
  await db.doc('serverConfig/progress').set({earningEnabled: true});
  await db.doc('circles/circle-1').set({
    title: 'Walk',
    commitment: 'Walk',
    category: 'Fitness',
    circleMode: 'personal',
    ownerId: uid,
    memberCount: 1,
    lifecycleStatus: 'active',
    createdAt: joinedAt,
    commitmentCadence: 'daily',
    commitmentFrequency: {tapInsPerWeek: 7},
    commitmentType: 'build',
    buildTrackingMode: 'confirmation',
    proofRequirement: 'optional',
    timezone: 'UTC',
    unitLabel: 'Tap In',
    graceRules: {skip: {allowance: 2, windowDays: 7}},
    ...extra,
  });
  await db.doc(`circles/circle-1/members/${uid}`).set({
    uid,
    status: 'active',
    role: 'owner',
    joinedAt,
    opportunityEligibility: 'include_current',
  });
  await db
    .doc(`circles/circle-1/membershipHistory/${uid}`)
    .set({uid, firstJoinedAt: joinedAt});
  await db
    .doc(`circles/circle-1/membershipHistory/${uid}/periods/initial`)
    .set({uid, joinedAt, opportunityEligibility: 'include_current'});
}

describe('Confirmed Tap In saves and asynchronous completion', () => {
  before(async () => {
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
    admin.initializeApp({projectId});
    db = admin.firestore();
    ({submitTapIn, removeTapIn} = require('../functions/lib/checkins'));
    ({
      processTapInCompletion,
    } = require('../functions/lib/checkins/completion'));
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
    await environment?.cleanup();
    await admin.app().delete();
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    await seed();
  });

  it('commits the base credit and pending job before computing final results', async () => {
    const startedAt = Date.now();
    const result = await save();
    console.info('completion_emulator_save_ms', Date.now() - startedAt);
    assert.equal(result.status, 'done');
    assert.equal(result.progress.xpEarned, 20);
    assert.equal(result.circleProgress, undefined);
    assert.equal(result.momentum, undefined);
    assert.equal(
      (await checkRef().get()).data().completionId,
      result.completionId,
    );
    const ref = completionRef(result.completionId);
    const pending = (await ref.get()).data();
    assert.equal(pending.status, 'pending');
    assert.equal(pending.previousCheckIn, null);
    assert.deepEqual(pending.baseProgress, result.progress);
    await processTapInCompletion(ref);
    const completed = (await ref.get()).data();
    assert.equal(completed.status, 'complete');
    assert.equal(completed.momentum.currentStreak, 1);
    assert.equal(completed.momentum.streakDelta, 1);
    assert.equal(completed.circleProgress.viewer.progress.outcome, 'secured');
    const bonuses = await db
      .collection(`userPrivate/${uid}/progressLedger`)
      .where('sourceEventId', '==', result.completionId)
      .get();
    assert.equal(
      completed.progress.xpEarned,
      result.progress.xpEarned +
        bonuses.docs.reduce((sum, doc) => sum + (doc.data().xp || 0), 0),
    );
  });

  it('does not duplicate rewards on simultaneous delivery or retry', async () => {
    const result = await save();
    const ref = completionRef(result.completionId);
    await Promise.all([
      processTapInCompletion(ref),
      processTapInCompletion(ref),
    ]);
    const wallet = (
      await db.doc(`userPrivate/${uid}/progress/current`).get()
    ).data();
    const completed = (await ref.get()).data();
    await processTapInCompletion(ref);
    assert.deepEqual(
      (await db.doc(`userPrivate/${uid}/progress/current`).get()).data(),
      wallet,
    );
    assert.deepEqual((await ref.get()).data(), completed);
  });

  it('recovers after derived calculations fail without repeating earned XP', async () => {
    const result = await save();
    const ref = completionRef(result.completionId);
    const circleProgress = require('../functions/lib/circles/progress');
    const original = circleProgress.readCircleProgressSources;
    circleProgress.readCircleProgressSources = async () => {
      throw new Error('transient read');
    };
    try {
      await assert.rejects(processTapInCompletion(ref), /transient read/);
    } finally {
      circleProgress.readCircleProgressSources = original;
    }
    assert.equal((await ref.get()).data().status, 'pending');
    const xp = (
      await db.doc(`userPrivate/${uid}/progress/current`).get()
    ).data().totalXP;
    await processTapInCompletion(ref);
    assert.equal((await ref.get()).data().status, 'complete');
    assert.equal(
      (await db.doc(`userPrivate/${uid}/progress/current`).get()).data()
        .totalXP,
      xp,
    );
  });

  it('supersedes pending results after quantity edits and removal', async () => {
    await db
      .doc('circles/circle-1')
      .update({buildTrackingMode: 'quantity', targetValue: 10});
    const first = await save({currentValue: 4});
    assert.equal(first.status, 'partial');
    const next = await save({currentValue: 10});
    await processTapInCompletion(completionRef(first.completionId));
    assert.equal(
      (await completionRef(first.completionId).get()).data().status,
      'superseded',
    );
    await call(removeTapIn, {circleId: 'circle-1'});
    await processTapInCompletion(completionRef(next.completionId));
    assert.equal(
      (await completionRef(next.completionId).get()).data().status,
      'superseded',
    );
  });

  it('does not publish a result superseded while its calculations were running', async () => {
    const result = await save();
    const circleProgress = require('../functions/lib/circles/progress');
    const original = circleProgress.readCircleProgressSources;
    circleProgress.readCircleProgressSources = async (...args) => {
      const sources = await original(...args);
      await checkRef().update({completionId: 'later-operation'});
      return sources;
    };
    try {
      await processTapInCompletion(completionRef(result.completionId));
    } finally {
      circleProgress.readCircleProgressSources = original;
    }
    const completed = (await completionRef(result.completionId).get()).data();
    assert.equal(completed.status, 'superseded');
    assert.equal(completed.circleProgress, undefined);
    assert.equal(completed.progress, undefined);
  });

  it('computes group results for daily, weekly, and monthly commitments', async () => {
    for (const [cadence, frequency] of [
      ['daily', {tapInsPerWeek: 7}],
      ['weekly', {tapInsPerWeek: 3}],
      ['monthly', {tapInsPerMonth: 10}],
    ]) {
      await environment.clearFirestore();
      await seed({
        circleMode: 'group',
        commitmentCadence: cadence,
        commitmentFrequency: frequency,
      });
      const result = await save();
      await processTapInCompletion(completionRef(result.completionId));
      const completed = (await completionRef(result.completionId).get()).data();
      assert.equal(completed.status, 'complete');
      assert.equal(completed.circleProgress.viewer.cadence, cadence);
      assert.equal(completed.circleProgress.group.cadence, cadence);
      assert.equal(
        completed.circleProgress.viewer.progress.outcome,
        cadence === 'daily' ? 'secured' : 'open',
      );
    }
  });

  it('returns partial and outside-limit outcomes without crediting success', async () => {
    await db
      .doc('circles/circle-1')
      .update({commitmentType: 'limit', maximumValue: 3});
    const result = await save({currentValue: 8});
    assert.equal(result.status, 'failed');
    assert.equal(result.progress.xpEarned, 0);
    await processTapInCompletion(completionRef(result.completionId));
    const completed = (await completionRef(result.completionId).get()).data();
    assert.equal(completed.status, 'complete');
    assert.equal(completed.progress.xpEarned, 0);
  });

  it('compares a skip replacement against its previous covered state', async () => {
    const skip = await save({status: 'skip'});
    assert.equal(skip.status, 'skip');
    assert.equal(skip.progress.xpEarned, 0);
    await processTapInCompletion(completionRef(skip.completionId));
    const done = await save();
    await processTapInCompletion(completionRef(done.completionId));
    const result = (await completionRef(done.completionId).get()).data();
    assert.equal(result.previousCheckIn.status, 'skip');
    assert.equal(result.momentum.currentStreak, 1);
    assert.equal(result.momentum.streakDelta, 0);
    assert.equal(result.circleProgress.viewerStreakDelta, 0);
  });

  it('enforces required photos and inventory before creating a completion', async () => {
    await db.doc('circles/circle-1').update({proofRequirement: 'photo'});
    await assert.rejects(
      save(),
      error => error.details?.reason === 'photo-proof-required',
    );
    assert.equal(
      (await db.collection(`userPrivate/${uid}/tapInCompletions`).get()).size,
      0,
    );
    assert.equal((await checkRef().get()).exists, false);
    await db.doc('serverConfig/progress').update({inventoryEnforced: true});
    const result = await save({status: 'skip'});
    assert.equal(result.status, 'skip');
    const wallet = (
      await db.doc(`userPrivate/${uid}/progress/current`).get()
    ).data();
    assert.equal(wallet.inventoryEnforcedAt > 0, true);
    assert.equal(
      Object.values(wallet.lots).reduce((sum, lot) => sum + lot.skips, 0),
      2,
    );
  });

  it('keeps legacy callers synchronous', async () => {
    const result = await call(submitTapIn, {
      circleId: 'circle-1',
      progressVersion: 1,
    });
    assert.equal(result.completionId, undefined);
    assert.ok(result.momentum);
    assert.ok(result.circleProgress);
    assert.equal(
      (await db.collection(`userPrivate/${uid}/tapInCompletions`).get()).size,
      0,
    );
  });

  it('does not recreate account data after deletion, including a deletion racing reconciliation', async () => {
    const result = await save();
    const ref = completionRef(result.completionId);
    const progressModule = require('../functions/lib/progress');
    const original = progressModule.reconcileProgress;
    progressModule.reconcileProgress = async (...args) => {
      await db
        .doc(`users/${uid}`)
        .update({accountDeletionStartedAt: admin.firestore.Timestamp.now()});
      return original(...args);
    };
    try {
      await assert.rejects(
        processTapInCompletion(ref),
        /Complete your profile first/,
      );
    } finally {
      progressModule.reconcileProgress = original;
    }
    await db.doc(`users/${uid}`).delete();
    await db.recursiveDelete(db.doc(`userPrivate/${uid}`));
    await processTapInCompletion(ref);
    assert.equal((await ref.get()).exists, false);
    assert.equal(
      (await db.doc(`userPrivate/${uid}/progress/current`).get()).exists,
      false,
    );
  });

  it('allows owner reads and denies foreign reads and all client writes', async () => {
    const result = await save();
    const path = `userPrivate/${uid}/tapInCompletions/${result.completionId}`;
    const ownerDb = environment.authenticatedContext(uid).firestore();
    const otherDb = environment.authenticatedContext('other').firestore();
    const anonymousDb = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(ownerDb, path)));
    await assertFails(getDoc(doc(otherDb, path)));
    await assertFails(getDoc(doc(anonymousDb, path)));
    await assertFails(setDoc(doc(ownerDb, path), {status: 'complete'}));
    await assertFails(
      setDoc(doc(ownerDb, `userPrivate/${uid}/tapInCompletions/fake`), {
        status: 'pending',
      }),
    );
  });
});
