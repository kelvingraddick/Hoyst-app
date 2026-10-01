import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {
  ensureProgress,
  completeProgressTask,
} = require('../functions/lib/progress');
const {submitTapIn, removeTapIn} = require('../functions/lib/checkins');
const {applyVerifiedPurchase} = require('../functions/lib/progress/purchases');
const {
  getRestoreOptions,
  restoreStreak,
} = require('../functions/lib/progress/restores');
const {Timestamp} = createRequire(
  new URL('../functions/package.json', import.meta.url),
)('firebase-admin/firestore');
const {dateKey} = require('../functions/lib/progress/model');
const {getOpportunitySlots} = require('../functions/lib/momentum/schedule');
const request = (uid, data = {}) => ({auth: {uid, token: {}}, data});
const today = dateKey(Date.now(), 'UTC');
describe('Progress server transactions and rules', () => {
  let environment;
  before(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'hoyst-firebase-app',
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
    await db.terminate();
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    await db.doc('serverConfig/progress').set({
      earningEnabled: true,
      inventoryEnforced: true,
      restoringEnabled: true,
      buyingEnabled: false,
    });
    for (const uid of ['owner', 'other'])
      await db.doc('users/' + uid).set({
        onboardingStatus: 'complete',
        displayName: uid,
        handle: uid,
        timezone: 'UTC',
      });
    for (const id of ['a', 'b', 'c', 'd']) {
      await db.doc('circles/' + id).set({
        circleMode: 'personal',
        lifecycleStatus: 'active',
        ownerId: 'owner',
        commitment: id,
        title: id,
        timezone: 'UTC',
        commitmentCadence: 'daily',
        commitmentFrequency: {opportunitiesPerPeriod: 1, tapInsPerWeek: 7},
        memberCount: 1,
        commitmentType: 'build',
        graceRules: {skip: {allowance: 100, windowDays: 7}},
      });
      await db.doc(`circles/${id}/members/owner`).set({
        uid: 'owner',
        status: 'active',
        joinedAt: Timestamp.fromMillis(Date.now() - 30 * 86400000),
        opportunityEligibility: 'include_current',
      });
    }
  });
  it('initializes once under concurrent retries and isolates owners', async () => {
    const results = await Promise.all(
      Array.from({length: 4}, () => ensureProgress.run(request('owner'))),
    );
    results.forEach(result => assert.equal(result.totalXP, 20));
    const wallet = (
      await db.doc('userPrivate/owner/progress/current').get()
    ).data();
    assert.deepEqual(wallet.inventory, {skips: 3, restores: 1});
    assert.equal(
      (await db.collection('userPrivate/owner/progressLedger').get()).size,
      3,
    );
    const other = await ensureProgress.run(request('other'));
    assert.equal(other.totalXP, 10);
    assert.equal(other.inventory.skips, 3);
  });
  it('credits three daily successes, caps the fourth, and preserves credit after removal', async () => {
    await ensureProgress.run(request('owner'));
    for (const id of ['a', 'b', 'c', 'd'])
      await submitTapIn.run(
        request('owner', {circleId: id, status: 'done', progressVersion: 1}),
      );
    const ref = db.doc('userPrivate/owner/progress/current');
    const before = (await ref.get()).data();
    assert.equal(before.window.earned, 30);
    await removeTapIn.run(request('owner', {circleId: 'a'}));
    await submitTapIn.run(
      request('owner', {circleId: 'a', status: 'done', progressVersion: 1}),
    );
    assert.equal((await ref.get()).data().totalXP, before.totalXP);
  });
  it('serializes shared token spending and returns open skips once', async () => {
    await ensureProgress.run(request('owner'));
    const results = await Promise.allSettled(
      ['a', 'b', 'c', 'd'].map(circleId =>
        submitTapIn.run(
          request('owner', {circleId, status: 'skip', progressVersion: 1}),
        ),
      ),
    );
    assert.equal(
      results.filter(result => result.status === 'fulfilled').length,
      3,
    );
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      0,
    );
    const successful = ['a', 'b', 'c', 'd'][
      results.findIndex(result => result.status === 'fulfilled')
    ];
    await removeTapIn.run(request('owner', {circleId: successful}));
    await removeTapIn.run(request('owner', {circleId: successful}));
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      1,
    );
  });
  it('blocks older clients when shared inventory enforcement is active', async () => {
    await assert.rejects(
      submitTapIn.run(request('owner', {circleId: 'a', status: 'skip'})),
      /Update Hoyst/,
    );
  });
  it('revalidates historical restore confirmation and deduplicates concurrent repair', async () => {
    await ensureProgress.run(request('owner'));
    const date = dayOffset => dateKey(Date.now() + dayOffset * 86400000, 'UTC');
    for (const offset of [-3, -2, -1]) {
      const day = date(offset);
      const status = offset === -2 ? 'missed' : 'completed';
      await db.doc(`userPrivate/owner/opportunities/a_${day}_0`).set({
        id: `a_${day}_0`,
        circleId: 'a',
        status,
        cadence: 'daily',
        availableDateKey: day,
        expiresDateKey: day,
        periodKey: day,
        slotIndex: 0,
        timezone: 'UTC',
        expectedForCircle: true,
      });
      if (status === 'completed')
        await db.doc(`circles/a/days/${day}/checkIns/owner`).set({
          uid: 'owner',
          status: 'done',
          coverageStatus: 'covered',
          createdAt: Timestamp.fromDate(new Date(day + 'T12:00:00Z')),
        });
    }
    const previews = await getRestoreOptions.run(request('owner'));
    assert.equal(previews.options.length, 1);
    assert.equal(previews.options[0].resultingStreak, 3);
    const data = {
      opportunityId: previews.options[0].slot.id,
      requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    };
    const results = await Promise.all([
      restoreStreak.run(request('owner', data)),
      restoreStreak.run(request('owner', data)),
    ]);
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.restores,
      0,
    );
    const repaired = (
      await db.doc(`circles/a/days/${date(-2)}/checkIns/owner`).get()
    ).data();
    assert.equal(repaired.status, 'skip');
    assert.equal(repaired.protectionKind, 'restore');
    assert.equal(repaired.effectiveDateKey, date(-2));
  });
  it('deduplicates provider transactions across accounts and revokes only remaining paid units', async () => {
    await ensureProgress.run(request('owner'));
    for (const circleId of ['a', 'b', 'c'])
      await submitTapIn.run(
        request('owner', {circleId, status: 'skip', progressVersion: 1}),
      );
    const purchase = {
      uid: 'owner',
      transactionId: 'store-1',
      productId: 'hoyst_skips_3',
      store: 'APP_STORE',
      environment: 'SANDBOX',
    };
    await Promise.all([
      applyVerifiedPurchase(purchase),
      applyVerifiedPurchase(purchase),
    ]);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      3,
    );
    await assert.rejects(
      applyVerifiedPurchase({...purchase, uid: 'other'}),
      /different Hoyst account/,
    );
    await submitTapIn.run(
      request('owner', {circleId: 'd', status: 'skip', progressVersion: 1}),
    );
    await applyVerifiedPurchase({...purchase, refunded: true});
    await applyVerifiedPurchase(purchase);
    const wallet = (
      await db.doc('userPrivate/owner/progress/current').get()
    ).data();
    assert.equal(wallet.inventory.skips, 0);
    await removeTapIn.run(request('owner', {circleId: 'd'}));
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      0,
    );
  });
  it('retains refund-before-delivery tombstones', async () => {
    const purchase = {
      uid: 'owner',
      transactionId: 'store-2',
      productId: 'hoyst_restore_1',
      store: 'PLAY_STORE',
      environment: 'SANDBOX',
    };
    await applyVerifiedPurchase({...purchase, refunded: true});
    await applyVerifiedPurchase(purchase);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.restores,
      1,
    );
  });
  it('retains checklist evidence while earning is paused and credits it once after activation', async () => {
    await db
      .doc('serverConfig/progress')
      .set({earningEnabled: false, inventoryEnforced: false});
    await db.doc('userPrivate/owner').set({
      reminderPreferenceSavedAt: Timestamp.now(),
      notificationSettings: {tapInReminders: false},
    });
    await db
      .doc('circles/a')
      .set({circleMode: 'group', inviteCode: 'valid'}, {merge: true});
    await db.doc('circles/a/members/owner').set({role: 'owner'}, {merge: true});
    await completeProgressTask.run(
      request('owner', {task: 'share_invite', circleId: 'a'}),
    );
    const paused = await ensureProgress.run(request('owner'));
    assert.equal(paused.totalXP, 0);
    assert.equal(paused.tasks.share_invite, true);
    assert.equal(paused.tasks.reminders, true);
    await db
      .doc('serverConfig/progress')
      .set({earningEnabled: true, inventoryEnforced: true});
    const activated = await ensureProgress.run(request('owner'));
    assert.equal(activated.totalXP, 50);
    assert.equal((await ensureProgress.run(request('owner'))).totalXP, 50);
    await assert.rejects(
      completeProgressTask.run(
        request('other', {task: 'share_invite', circleId: 'a'}),
      ),
      /cannot share/,
    );
  });
  it('returns an open skip when replaced by an actual success, without crediting protection itself', async () => {
    const initial = await ensureProgress.run(request('owner'));
    const skipped = await submitTapIn.run(
      request('owner', {circleId: 'a', status: 'skip', progressVersion: 1}),
    );
    assert.equal(skipped.progress.xpEarned, 0);
    assert.equal(
      (await ensureProgress.run(request('owner'))).totalXP,
      initial.totalXP,
    );
    const done = await submitTapIn.run(
      request('owner', {circleId: 'a', status: 'done', progressVersion: 1}),
    );
    assert.ok(done.progress.xpEarned >= 10);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      3,
    );
  });
  it('preserves previously completed routine history without backfilling or recrediting it', async () => {
    const day = today;
    await db.doc(`circles/a/days/${day}/checkIns/owner`).set({
      uid: 'owner',
      status: 'done',
      coverageStatus: 'covered',
      createdAt: Timestamp.fromMillis(Date.now() - 3600000),
    });
    await db.doc(`userPrivate/owner/opportunities/a_${day}_0`).set({
      circleId: 'a',
      status: 'completed',
      availableDateKey: day,
      expiresDateKey: day,
      periodKey: day,
      slotIndex: 0,
      timezone: 'UTC',
      firstSuccessfulAt: Timestamp.fromMillis(Date.now() - 3600000),
    });
    const initial = await ensureProgress.run(request('owner'));
    assert.equal(initial.window.earned, 0);
    await removeTapIn.run(request('owner', {circleId: 'a'}));
    await submitTapIn.run(
      request('owner', {circleId: 'a', status: 'done', progressVersion: 1}),
    );
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data().window
        .earned,
      0,
    );
  });
  it('rejects restoration outside historical membership and leaves the wallet unchanged', async () => {
    await ensureProgress.run(request('owner'));
    const day = offset => dateKey(Date.now() + offset * 86400000, 'UTC');
    for (const offset of [-3, -2, -1])
      await db.doc(`userPrivate/owner/opportunities/a_${day(offset)}_0`).set({
        circleId: 'a',
        status: offset === -2 ? 'missed' : 'completed',
        availableDateKey: day(offset),
        expiresDateKey: day(offset),
        periodKey: day(offset),
        cadence: 'daily',
        slotIndex: 0,
        timezone: 'UTC',
        expectedForCircle: true,
      });
    await db
      .doc('circles/a/members/owner')
      .set({joinedAt: Timestamp.now()}, {merge: true});
    assert.equal(
      (await getRestoreOptions.run(request('owner'))).options.length,
      0,
    );
    await assert.rejects(
      restoreStreak.run(
        request('owner', {
          opportunityId: `a_${day(-2)}_0`,
          requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        }),
      ),
      /can no longer reconnect/,
    );
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.restores,
      1,
    );
  });
  for (const cadence of ['weekly', 'monthly'])
    it(`repairs original legacy ${cadence} periods without changing actual Tap In totals or XP`, async () => {
      await ensureProgress.run(request('owner'));
      const previous = new Date();
      if (cadence === 'monthly') {
        previous.setUTCDate(1);
        previous.setUTCMonth(previous.getUTCMonth() - 1);
      } else previous.setUTCDate(previous.getUTCDate() - 7);
      const schedule = {
        pace: cadence,
        opportunitiesPerPeriod: 2,
        slotPolicy: 'scheduled_slots',
        timezone: 'UTC',
      };
      const prior = getOpportunitySlots(schedule, previous);
      const current = getOpportunitySlots(schedule).filter(
        slot => slot.availableDateKey <= today,
      );
      await db.doc('circles/a').set(
        {
          commitmentCadence: cadence,
          commitmentFrequency: {opportunitiesPerPeriod: 2},
        },
        {merge: true},
      );
      await db
        .doc('circles/a/members/owner')
        .set(
          {joinedAt: Timestamp.fromMillis(Date.now() - 180 * 86400000)},
          {merge: true},
        );
      const missing = prior[prior.length - 1];
      for (const slot of [...prior, ...current]) {
        const id = `a_${slot.periodKey}_${slot.slotIndex}`,
          missed = slot === missing;
        await db.doc('userPrivate/owner/opportunities/' + id).set({
          ...slot,
          circleId: 'a',
          status: missed ? 'missed' : 'completed',
          cadence,
          timezone: 'UTC',
          expectedForCircle: true,
          isCurrentPeriod: slot.periodKey === current[0]?.periodKey,
        });
        if (!missed)
          await db
            .doc(`circles/a/days/${slot.availableDateKey}/checkIns/owner`)
            .set({
              uid: 'owner',
              status: 'done',
              coverageStatus: 'covered',
              createdAt: Timestamp.fromDate(
                new Date(slot.availableDateKey + 'T12:00:00Z'),
              ),
            });
      }
      const before = (
        await db.collectionGroup('checkIns').where('uid', '==', 'owner').get()
      ).docs.filter(doc => doc.data().status === 'done').length;
      const preview = await getRestoreOptions.run(request('owner'));
      assert.equal(preview.options.length, 1);
      assert.equal(preview.options[0].slot.periodKey, missing.periodKey);
      await restoreStreak.run(
        request('owner', {
          opportunityId: preview.options[0].slot.id,
          requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        }),
      );
      const repaired = (
        await db
          .doc(`circles/a/days/${missing.expiresDateKey}/checkIns/owner`)
          .get()
      ).data();
      assert.equal(repaired.restoration.originalSlotIndex, missing.slotIndex);
      assert.equal(repaired.restoration.originalPeriodKey, missing.periodKey);
      assert.equal(
        (
          await db.collectionGroup('checkIns').where('uid', '==', 'owner').get()
        ).docs.filter(doc => doc.data().status === 'done').length,
        before,
      );
      assert.equal(
        (await db.doc('userPrivate/owner/progress/current').get()).data()
          .totalXP,
        20,
      );
      assert.equal(
        (
          await db
            .doc(
              `circles/a/opportunities/${missing.periodKey}/slots/${missing.slotIndex}`,
            )
            .get()
        ).data().coveredMemberCount,
        1,
      );
      assert.equal(
        (await db.collection('userPrivate/owner/inbox').get()).docs[0].data()
          .type,
        'streak_restored',
      );
    });
  it('retains closed protection without returning its token when a later day is opened', async () => {
    await ensureProgress.run(request('owner'));
    const yesterday = dateKey(Date.now() - 86400000, 'UTC');
    await db
      .doc('userPrivate/owner/progress/current')
      .update({'inventory.skips': 2, 'lots.starter.skips': 2});
    await db.doc(`circles/a/days/${yesterday}/checkIns/owner`).set({
      uid: 'owner',
      status: 'skip',
      coverageStatus: 'skipped',
      skipFunding: 'starter',
      skipSpendId: 'old',
      createdAt: Timestamp.fromMillis(Date.now() - 86400000),
    });
    await db.doc(`userPrivate/owner/opportunities/a_${yesterday}_0`).set({
      circleId: 'a',
      status: 'skipped',
      availableDateKey: yesterday,
      expiresDateKey: yesterday,
      periodKey: yesterday,
      slotIndex: 0,
      timezone: 'UTC',
      cadence: 'daily',
      expectedForCircle: true,
    });
    const removed = await removeTapIn.run(request('owner', {circleId: 'a'}));
    assert.equal(removed.removed, false);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data()
        .inventory.skips,
      2,
    );
    assert.equal(
      (await db.doc(`circles/a/days/${yesterday}/checkIns/owner`).get()).exists,
      true,
    );
  });
  it('credits only covered outcomes and not partial or failed quantity entries', async () => {
    await ensureProgress.run(request('owner'));
    await db
      .doc('circles/a')
      .set(
        {commitmentType: 'build', targetValue: 100, unitLabel: 'minutes'},
        {merge: true},
      );
    await db
      .doc('circles/b')
      .set(
        {commitmentType: 'limit', maximumValue: 5, unitLabel: 'cups'},
        {merge: true},
      );
    for (const data of [
      {circleId: 'a', currentValue: 10},
      {circleId: 'b', currentValue: 10},
    ]) {
      const result = await submitTapIn.run(
        request('owner', {...data, status: 'done', progressVersion: 1}),
      );
      assert.equal(result.progress.xpEarned, 0);
    }
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data().window
        .earned,
      0,
    );
    await submitTapIn.run(
      request('owner', {
        circleId: 'a',
        currentValue: 100,
        status: 'done',
        progressVersion: 1,
      }),
    );
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data().window
        .earned,
      10,
    );
  });
  it('backfills provable milestone and checklist XP once without historical routine credit', async () => {
    for (let i = 0; i < 50; i++) {
      const day = dateKey(Date.now() - (i % 30) * 86400000, 'UTC'),
        circle = i < 30 ? 'a' : 'b';
      await db.doc(`circles/${circle}/days/${day}/checkIns/owner`).set({
        uid: 'owner',
        status: 'done',
        coverageStatus: 'covered',
        createdAt: Timestamp.fromDate(new Date(day + 'T12:00:00Z')),
      });
    }
    await db
      .doc('userPrivate/owner/momentum/current')
      .set({rollingMomentum: {status: 'peak_momentum'}});
    const result = await ensureProgress.run(request('owner'));
    assert.equal(result.totalXP, 250);
    assert.equal(result.level, 4);
    assert.deepEqual(result.inventory, {skips: 6, restores: 2});
    assert.equal(result.window.earned, 0);
    assert.equal((await ensureProgress.run(request('owner'))).totalXP, 250);
  });
  it('does not turn protection-driven momentum into XP on the next summary refresh', async () => {
    for (const circleId of ['a', 'b', 'c'])
      await submitTapIn.run(
        request('owner', {circleId, status: 'skip', progressVersion: 1}),
      );
    const after = await ensureProgress.run(request('owner'));
    assert.equal(after.totalXP, 20);
    assert.equal(after.inventory.skips, 0);
    assert.equal(after.milestones.momentum_peak, undefined);
  });
  it('credits historical self milestone evidence after current momentum has dropped', async () => {
    await db
      .doc('userPrivate/owner/momentum/current')
      .set({rollingMomentum: {status: 'building_momentum'}});
    await db
      .doc(
        'userPrivate/owner/inbox/self_companion_momentum_level_up_2026-09-01_owner_peak_momentum_r1',
      )
      .set({type: 'companion_momentum_level_up', actor: {uid: 'owner'}});
    await db
      .doc(
        'userPrivate/owner/inbox/self_companion_streak_milestone_2026-09-01_other_30-day-streak_r1',
      )
      .set({type: 'companion_streak_milestone', actor: {uid: 'other'}});
    assert.equal((await ensureProgress.run(request('owner'))).totalXP, 70);
    assert.equal((await ensureProgress.run(request('owner'))).totalXP, 70);
  });
  it('keeps shared inventory enforcement latched during rollback', async () => {
    await ensureProgress.run(request('owner'));
    await db.doc('serverConfig/progress').set({
      earningEnabled: false,
      inventoryEnforced: false,
      buyingEnabled: false,
    });
    const state = await ensureProgress.run(request('owner'));
    assert.equal(state.flags.inventory, true);
    await assert.rejects(
      submitTapIn.run(request('owner', {circleId: 'a', status: 'skip'})),
      /Update Hoyst/,
    );
  });
  it('awards actual stored momentum statuses once', async () => {
    await db
      .doc('userPrivate/owner/momentum/current')
      .set({rollingMomentum: {status: 'peak_momentum'}});
    const state = await ensureProgress.run(request('owner'));
    assert.equal(state.totalXP, 70);
    assert.equal(state.inventory.skips, 4);
    assert.equal((await ensureProgress.run(request('owner'))).totalXP, 70);
  });
  it('makes summaries and ledgers owner-readable and denies all client writes', async () => {
    await ensureProgress.run(request('owner'));
    const owner = environment.authenticatedContext('owner').firestore(),
      other = environment.authenticatedContext('other').firestore();
    await assertSucceeds(
      getDoc(doc(owner, 'userPrivate/owner/progress/current')),
    );
    await assertSucceeds(
      getDoc(doc(owner, 'userPrivate/owner/progressLedger/starter')),
    );
    await assertFails(getDoc(doc(other, 'userPrivate/owner/progress/current')));
    await assertFails(
      getDoc(doc(other, 'userPrivate/owner/progressLedger/starter')),
    );
    await assertFails(
      setDoc(doc(owner, 'userPrivate/owner/progress/current'), {totalXP: 999}),
    );
    await assertFails(
      setDoc(doc(owner, 'userPrivate/owner/progressLedger/fake'), {skips: 999}),
    );
  });
});
