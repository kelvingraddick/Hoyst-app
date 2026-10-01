import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {it} from 'node:test';
import {
  backfillWindow,
  dateKeys,
  evaluateRecord,
  markerFor,
} from '../scripts/backfill-public-tap-ins.mjs';

const require = createRequire(import.meta.url);
const {Timestamp} =
  require('../functions/node_modules/firebase-admin').firestore;
const {
  isPublicationOnlyUpdate,
} = require('../functions/lib/checkins/publication-only.js');
const stamp = time => Timestamp.fromMillis(time);
const end = stamp(Date.parse('2026-09-30T01:34:27.726Z'));
const window = backfillWindow(end);
const submitted = stamp(end.toMillis() - 1000);
const input = () => ({
  window,
  circle: {
    privacy: 'public',
    circleMode: 'group',
    lifecycleStatus: 'active',
    createdAt: window.start,
  },
  index: {circleMode: 'group', lifecycleStatus: 'active'},
  member: {status: 'active', joinedAt: window.start},
  profile: {displayName: 'Ava'},
  checkIn: {
    status: 'done',
    coverageStatus: 'covered',
    coverageRevision: 1,
    createdAt: submitted,
    updatedAt: submitted,
  },
});

it('freezes exactly 30 days before activation and includes timezone boundary days', () => {
  assert.equal(window.end, end);
  assert.equal(window.end.toMillis() - window.start.toMillis(), 30 * 86400000);
  assert.ok(dateKeys(window).includes('2026-08-30'));
  assert.ok(dateKeys(window).includes('2026-10-01'));
  assert.throws(() => backfillWindow(undefined));
});
it('includes the lower bound and excludes activation, with full timestamp precision', () => {
  for (const [time, reason] of [
    [window.start, 'eligible'],
    [end, 'outside_window'],
    [stamp(window.start.toMillis() - 1), 'outside_window'],
  ]) {
    const data = input();
    data.checkIn.createdAt = data.checkIn.updatedAt = time;
    assert.equal(evaluateRecord(data), reason);
  }
  const data = input();
  data.checkIn.updatedAt = new Timestamp(
    submitted.seconds,
    submitted.nanoseconds + 1,
  );
  assert.equal(evaluateRecord(data), 'ambiguous_timestamp');
});
for (const [name, edit, expected] of [
  ['private', d => (d.circle.privacy = 'private'), 'circle_not_public_active'],
  [
    'personal',
    d => (d.circle.circleMode = 'personal'),
    'circle_not_public_active',
  ],
  [
    'archived',
    d => (d.circle.lifecycleStatus = 'archived'),
    'circle_not_public_active',
  ],
  ['missing index', d => (d.index = undefined), 'circle_not_public_active'],
  ['missing check-in', d => (d.checkIn = undefined), 'check_in_missing'],
  ['skip', d => (d.checkIn.status = 'skip'), 'not_successful'],
  ['partial', d => (d.checkIn.coverageStatus = 'partial'), 'not_successful'],
  [
    'account removal',
    d => (d.checkIn.deletionReason = 'account'),
    'not_successful',
  ],
  ['edited', d => (d.checkIn.updatedAt = end), 'ambiguous_timestamp'],
  [
    'repeat completion',
    d => (d.checkIn.coverageRevision = 2),
    'ambiguous_timestamp',
  ],
  ['missing timestamp', d => delete d.checkIn.createdAt, 'ambiguous_timestamp'],
  ['missing member', d => (d.member = undefined), 'membership_ineligible'],
  ['pending', d => (d.member.status = 'pending'), 'membership_ineligible'],
  ['departed', d => (d.member.status = 'left'), 'membership_ineligible'],
  ['before rejoin', d => (d.member.joinedAt = end), 'membership_ineligible'],
  ['missing join time', d => delete d.member.joinedAt, 'membership_ineligible'],
  ['missing profile', d => (d.profile = undefined), 'profile_missing'],
  [
    'before privacy boundary',
    d => (d.circle.publicActivityEpoch = end),
    'before_public_boundary',
  ],
  [
    'missing public boundary',
    d => delete d.circle.createdAt,
    'before_public_boundary',
  ],
  [
    'existing marker',
    d => (d.checkIn.publicTapIn = {eventId: 'live'}),
    'existing_marker',
  ],
]) {
  it(`skips ${name}`, () => {
    const data = input();
    edit(data);
    assert.equal(evaluateRecord(data), expected);
  });
}
it('uses a deterministic marker with original time and no private data', () => {
  const data = input();
  data.checkIn.note = 'PRIVATE';
  data.checkIn.photoUrl = 'PRIVATE';
  const marker = markerFor(
    'circles/c/days/2026-09-29/checkIns/ava',
    data.checkIn,
    data.circle,
  );
  assert.deepEqual(
    markerFor(
      'circles/c/days/2026-09-29/checkIns/ava',
      data.checkIn,
      data.circle,
    ),
    marker,
  );
  assert.equal(marker.occurredAt, submitted);
  assert.deepEqual(Object.keys(marker).sort(), [
    'epoch',
    'eventId',
    'occurredAt',
  ]);
});
it('suppresses only marker updates, including rollback, and retains ordinary changes', () => {
  const before = input().checkIn;
  const after = {
    ...before,
    publicTapIn: {eventId: 'backfill', occurredAt: submitted, epoch: 1},
  };
  assert.equal(isPublicationOnlyUpdate(before, after), true);
  assert.equal(isPublicationOnlyUpdate(after, before), true);
  assert.equal(isPublicationOnlyUpdate(before, before), false);
  assert.equal(isPublicationOnlyUpdate(undefined, after), false);
  assert.equal(isPublicationOnlyUpdate(after, undefined), false);
  for (const change of [
    {note: 'edited'},
    {photoUrl: 'photo'},
    {currentValue: 2},
    {status: 'skip'},
    {updatedAt: end},
    {coverageRevision: 2},
  ]) {
    assert.equal(isPublicationOnlyUpdate(before, {...after, ...change}), false);
  }
});
