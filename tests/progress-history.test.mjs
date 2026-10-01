import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {it} from 'node:test';
const require = createRequire(import.meta.url);
const {Timestamp} = createRequire(
  new URL('../functions/package.json', import.meta.url),
)('firebase-admin/firestore');
const {
  activityFromRecord,
  monthSummary,
  pageActivities,
  validDateKey,
  resolveTimezone,
} = require('../functions/lib/progress/history-model');
const record = (data = {}, id = 'a') => ({
  id,
  circleId: 'circle',
  storedDateKey: '2026-09-29',
  data: {
    status: 'done',
    coverageStatus: 'covered',
    createdAt: Timestamp.fromDate(new Date('2026-09-29T23:00:00Z')),
    ...data,
  },
});
it('counts mixed successful days once as active days without crediting protection or partial entries', () => {
  const records = [
    record({}, 'a'),
    record({}, 'b'),
    record({status: 'partial'}, 'c'),
    record({status: 'skip', coverageStatus: 'skipped'}, 'd'),
    record({status: 'failed'}, 'e'),
  ];
  const activities = records.map(item => activityFromRecord(item, 'UTC'));
  const result = monthSummary('2026-09', 'UTC', activities);
  assert.equal(result.tapIns, 2);
  assert.equal(result.activeDays, 1);
  assert.equal(result.days[28].status, 'success');
  assert.equal(result.days[28].activityCount, 5);
});
it('preserves original restoration dates and excludes them from actual Tap Ins', () => {
  const activity = activityFromRecord(
    record({
      status: 'skip',
      protectionKind: 'restore',
      effectiveDateKey: '2026-08-31',
      restoration: {personalEffectiveDateKey: '2026-09-01'},
    }),
    'America/New_York',
  );
  assert.equal(activity.dateKey, '2026-09-01');
  assert.equal(activity.status, 'restored');
  assert.equal(
    monthSummary('2026-09', 'UTC', [activity]).days[0].status,
    'protected',
  );
  assert.equal(monthSummary('2026-09', 'UTC', [activity]).tapIns, 0);
});
it('uses saved timezone across midnight and DST with legacy stored-date fallback', () => {
  assert.equal(
    activityFromRecord(
      record({createdAt: Timestamp.fromDate(new Date('2026-03-08T04:59:00Z'))}),
      'America/New_York',
    ).dateKey,
    '2026-03-07',
  );
  assert.equal(
    activityFromRecord(
      record({createdAt: Timestamp.fromDate(new Date('2026-03-08T07:01:00Z'))}),
      'America/New_York',
    ).dateKey,
    '2026-03-08',
  );
  assert.equal(
    activityFromRecord(record({createdAt: null}), 'UTC').dateKey,
    '2026-09-29',
  );
  assert.equal(resolveTimezone('bogus/timezone'), 'UTC');
});
it('honors leap years and month lengths and rejects invalid dates', () => {
  assert.equal(monthSummary('2024-02', 'UTC', []).days.length, 29);
  assert.equal(monthSummary('2026-02', 'UTC', []).days.length, 28);
  assert.equal(monthSummary('2026-09', 'UTC', []).days.length, 30);
  assert.equal(monthSummary('2026-10', 'UTC', []).days.length, 31);
  assert.equal(validDateKey('2026-02-29'), false);
  assert.equal(validDateKey('2024-02-29'), true);
  assert.equal(validDateKey('2026-13-01'), false);
  assert.equal(validDateKey(null), false);
});
it('pages same-millisecond timestamps with nanosecond precision without omissions', () => {
  const activities = Array.from({length: 43}, (_, i) =>
    activityFromRecord(
      record(
        {createdAt: new Timestamp(1700000000, i)},
        String(i).padStart(3, '0'),
      ),
      'UTC',
    ),
  );
  const first = pageActivities(activities);
  const second = pageActivities(activities, first.nextSortKey);
  const third = pageActivities(activities, second.nextSortKey);
  assert.equal(first.entries.length, 20);
  assert.equal(second.entries.length, 20);
  assert.equal(third.entries.length, 3);
  assert.equal(third.nextSortKey, undefined);
  assert.equal(
    new Set(
      [...first.entries, ...second.entries, ...third.entries].map(a => a.id),
    ).size,
    43,
  );
  assert.equal(first.entries[0].id, '042');
});
it('does not award completion to uncovered done records or count detail edits twice', () => {
  assert.equal(
    activityFromRecord(record({coverageStatus: 'partial'}), 'UTC').status,
    'partial',
  );
  const edited = activityFromRecord(
    record({note: 'Changed note', updatedAt: Timestamp.now()}),
    'UTC',
  );
  assert.equal(monthSummary('2026-09', 'UTC', [edited]).tapIns, 1);
});
it('preserves status precedence and actual quantity, notes and historical metadata', () => {
  const a = activityFromRecord(
    record({
      status: 'partial',
      currentValue: 6,
      unitLabel: 'hours',
      note: 'Rested',
      photoUrl: 'https://example.test/photo',
    }),
    'UTC',
    {
      title: 'Sleep',
      category: 'Wellness',
      cadence: 'weekly',
      periodKey: '2026-09-28',
    },
  );
  assert.equal(a.description, 'Partial · 6 hours');
  assert.equal(a.note, 'Rested');
  assert.equal(a.cadence, 'weekly');
  assert.equal(a.periodKey, '2026-09-28');
  const b = activityFromRecord(
    record({status: 'skip', coverageStatus: 'skipped'}, 'b'),
    'UTC',
  );
  assert.equal(
    monthSummary('2026-09', 'UTC', [a, b]).days[28].status,
    'partial',
  );
});

it('uses the same identifier ordering for cursor filtering at timestamp ties', () => {
  const ids = ['a', 'Z', 'A', 'z', 'B', 'b', '9', '_', '0'];
  const activities = ids.map(id => activityFromRecord(record({}, id), 'UTC'));
  const gathered = [];
  let after;
  do {
    const page = pageActivities(activities, after, 2);
    gathered.push(...page.entries.map(e => e.id));
    after = page.nextSortKey;
  } while (after);
  assert.deepEqual(gathered, [...ids].sort().reverse());
});

it('retains legacy coverage and original restore period metadata without using current schedules', () => {
  const partial = activityFromRecord(
    record({
      coverageStatus: 'partial',
      periodKey: '2026-09',
      cadence: 'monthly',
    }),
    'UTC',
  );
  assert.equal(partial.status, 'partial');
  assert.equal(partial.cadence, 'monthly');
  assert.equal(partial.periodKey, '2026-09');
  const restore = activityFromRecord(
    record({
      status: 'skip',
      protectionKind: 'restore',
      restoration: {originalPeriodKey: '2026-W35'},
    }),
    'UTC',
  );
  assert.equal(restore.periodKey, '2026-W35');
  assert.equal(monthSummary('2026-09', 'UTC', [partial, restore]).tapIns, 0);
});
