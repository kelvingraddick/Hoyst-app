import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {doc, getDoc} from 'firebase/firestore';
const require = createRequire(import.meta.url);
const {db} = require('../functions/lib/firebase');
const {
  getProgressMonth,
  getProgressDayActivity,
} = require('../functions/lib/progress/history');
const {Timestamp} = createRequire(
  new URL('../functions/package.json', import.meta.url),
)('firebase-admin/firestore');
const request = (uid, data = {}) => ({
  auth: uid ? {uid, token: {}} : undefined,
  data,
});
const stamp = Timestamp.fromDate(new Date('2026-09-29T15:00:00Z'));
async function check(uid, circle, date, data = {}) {
  await db.doc(`circles/${circle}/days/${date}/checkIns/${uid}`).set({
    uid,
    circleId: circle,
    status: 'done',
    coverageStatus: 'covered',
    createdAt: stamp,
    ...data,
  });
}
describe('Progress history endpoints and owner reads', () => {
  let env;
  before(async () => {
    env = await initializeTestEnvironment({
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
    await env.cleanup();
    await db.terminate();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    for (const uid of ['owner', 'other'])
      await db
        .doc(`users/${uid}`)
        .set({onboardingStatus: 'complete', timezone: 'America/New_York'});
  });
  it('requires authentication and rejects invalid/future dates and foreign request fields', async () => {
    await assert.rejects(
      getProgressMonth.run(request(undefined, {monthKey: '2026-09'})),
      e => e.code === 'unauthenticated',
    );
    for (const data of [
      {monthKey: '2026-13'},
      {monthKey: '2099-01'},
      {monthKey: '2026-09', uid: 'other'},
    ])
      await assert.rejects(
        getProgressMonth.run(request('owner', data)),
        e => e.code === 'invalid-argument',
      );
    await assert.rejects(
      getProgressDayActivity.run(request('owner', {dateKey: '2026-02-29'})),
      e => e.code === 'invalid-argument',
    );
  });
  it('isolates owners, includes retained past records, and preserves protection dates', async () => {
    await db
      .doc('userPrivate/owner/pastCircles/past')
      .set({circleId: 'past', title: 'Old reading', category: 'Writing'});
    await db.doc('circles/past').set({
      title: 'Private updated title',
      category: 'Custom',
      visibility: 'private',
    });
    await db.doc('circles/past/members/owner').set({status: 'left'});
    await check('owner', 'past', '2026-09-29');
    await check('other', 'foreign', '2026-09-29');
    await check('owner', 'restore', '2026-09-18', {
      status: 'skip',
      coverageStatus: 'skipped',
      protectionKind: 'restore',
      effectiveDateKey: '2026-09-18',
      restoration: {personalEffectiveDateKey: '2026-09-18'},
    });
    const month = await getProgressMonth.run(
      request('owner', {monthKey: '2026-09'}),
    );
    assert.equal(month.tapIns, 1);
    assert.equal(month.activeDays, 1);
    assert.equal(month.days[17].status, 'protected');
    const day = await getProgressDayActivity.run(
      request('owner', {dateKey: '2026-09-29'}),
    );
    assert.equal(day.entries.length, 1);
    assert.equal(day.entries[0].title, 'Old reading');
    await assertSucceeds(
      getDoc(
        doc(
          env.authenticatedContext('owner').firestore(),
          'circles/past/days/2026-09-29/checkIns/owner',
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other').firestore(),
          'circles/past/days/2026-09-29/checkIns/owner',
        ),
      ),
    );
  });
  it('pages a busy day without duplicate entries and binds cursors to owner and date', async () => {
    await Promise.all(
      Array.from({length: 27}, (_, i) =>
        check('owner', `c${i}`, '2026-09-29', {
          createdAt: new Timestamp(stamp.seconds, i),
        }),
      ),
    );
    const first = await getProgressDayActivity.run(
      request('owner', {dateKey: '2026-09-29'}),
    );
    assert.equal(first.entries.length, 20);
    assert.ok(first.nextCursor);
    const second = await getProgressDayActivity.run(
      request('owner', {dateKey: '2026-09-29', cursor: first.nextCursor}),
    );
    assert.equal(second.entries.length, 7);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.entries, ...second.entries].map(e => e.id)).size,
      27,
    );
    await assert.rejects(
      getProgressDayActivity.run(
        request('other', {dateKey: '2026-09-29', cursor: first.nextCursor}),
      ),
      e => e.code === 'invalid-argument',
    );
    await assert.rejects(
      getProgressDayActivity.run(
        request('owner', {dateKey: '2026-09-28', cursor: first.nextCursor}),
      ),
      e => e.code === 'invalid-argument',
    );
  });
  it('reports only provable missed slots across daily, weekly, monthly and membership periods', async () => {
    for (const [i, cadence] of ['daily', 'weekly', 'monthly'].entries()) {
      const circle = `old-${cadence}`;
      await db
        .doc(`circles/${circle}/membershipHistory/owner/periods/one`)
        .set({
          joinedAt: Timestamp.fromDate(new Date('2026-01-01')),
          leftAt: Timestamp.fromDate(new Date('2026-09-30')),
        });
      await db.doc(`userPrivate/owner/opportunities/${circle}`).set({
        circleId: circle,
        title: circle,
        status: 'missed',
        expectedForCircle: true,
        availableDateKey: '2026-09-15',
        expiresDateKey: `2026-09-${20 + i}`,
        periodKey: '2026-09',
        slotIndex: 0,
        timezone: 'UTC',
        cadence,
      });
    }
    await db.doc('userPrivate/owner/opportunities/unproven').set({
      circleId: 'none',
      title: 'Unproven',
      status: 'missed',
      expectedForCircle: true,
      availableDateKey: '2026-09-15',
      expiresDateKey: '2026-09-22',
      periodKey: '2026-09',
      slotIndex: 0,
    });
    const month = await getProgressMonth.run(
      request('owner', {monthKey: '2026-09'}),
    );
    assert.equal(month.tapIns, 0);
    assert.equal(
      month.days.reduce((n, d) => n + d.activityCount, 0),
      3,
    );
    for (const dateKey of ['2026-09-20', '2026-09-21', '2026-09-22']) {
      const day = await getProgressDayActivity.run(request('owner', {dateKey}));
      assert.equal(day.entries.length, 1);
      assert.equal(day.entries[0].status, 'missed');
      assert.ok(day.entries[0].cadence);
    }
  });
  it('handles legacy timestamps, partial/failed entries, edits and removals without changing XP', async () => {
    await check('owner', 'legacy', '2026-09-03', {createdAt: null});
    await check('owner', 'partial', '2026-09-29', {
      status: 'partial',
      coverageStatus: 'partial',
      currentValue: 6,
      unitLabel: 'hours',
    });
    await check('owner', 'failed', '2026-09-29', {
      status: 'failed',
      coverageStatus: 'failed',
    });
    await db.doc('userPrivate/owner/progress/current').set({totalXP: 110});
    let month = await getProgressMonth.run(
      request('owner', {monthKey: '2026-09'}),
    );
    assert.equal(month.tapIns, 1);
    assert.equal(month.days[28].status, 'partial');
    await db
      .doc('circles/legacy/days/2026-09-03/checkIns/owner')
      .update({note: 'Edited'});
    month = await getProgressMonth.run(request('owner', {monthKey: '2026-09'}));
    assert.equal(month.tapIns, 1);
    await db.doc('circles/legacy/days/2026-09-03/checkIns/owner').delete();
    month = await getProgressMonth.run(request('owner', {monthKey: '2026-09'}));
    assert.equal(month.tapIns, 0);
    assert.equal(
      (await db.doc('userPrivate/owner/progress/current').get()).data().totalXP,
      110,
    );
  });
});
