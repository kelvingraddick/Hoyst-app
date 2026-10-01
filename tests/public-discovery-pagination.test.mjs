import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {after, it} from 'node:test';

const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const {Timestamp} = require('firebase-admin/firestore');
const {db} = require('./lib/firebase.js');
const {searchPublicCircles} = require('./lib/discovery/index.js');
const call = data => searchPublicCircles.run({data});

// Supply snapshots in Firestore's full timestamp / document ID descending order.
// Exercise the real callable without network access or an emulator.
const rows = [
  ...Array.from({length: 20}, (_, i) => ({
    id: `a-${String(20 - i).padStart(2, '0')}`,
    updatedAt: new Timestamp(1790460000, 123900000),
  })),
  {id: 'z-older', updatedAt: new Timestamp(1790460000, 123100000)},
  {id: 'y-same-time', updatedAt: new Timestamp(1790460000, 123100000)},
];
const originalCollection = db.collection;
db.collection = () => {
  const query = {
    where: () => query,
    orderBy: () => query,
    select: () => query,
    get: async () => ({
      docs: rows.map(({id, updatedAt}) => ({
        id,
        data: () => ({title: 'Circle', commitment: 'Read', updatedAt}),
      })),
    }),
  };
  return query;
};
after(() => {
  db.collection = originalCollection;
});

it('returns every result once across a sub-millisecond page boundary', async () => {
  const first = await call({});
  const second = await call({cursor: first.nextCursor});
  assert.equal(first.total, rows.length);
  assert.equal(first.circles.length, 20);
  assert.deepEqual(
    [...first.circles, ...second.circles].map(circle => circle.id),
    rows.map(row => row.id),
  );
  assert.equal(second.nextCursor, undefined);
});

it('uses document ID only when full timestamps match', async () => {
  const first = await call({});
  const cursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url'));
  const page = await call({
    cursor: Buffer.from(JSON.stringify({...cursor, id: 'a-10'})).toString(
      'base64url',
    ),
  });
  assert.deepEqual(
    page.circles.map(circle => circle.id),
    rows.slice(11).map(row => row.id),
  );
});

it('rejects legacy, malformed and mismatched cursors', async () => {
  const first = await call({});
  const cursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url'));
  for (const invalid of [
    {id: cursor.id, time: 1790460000123, fingerprint: cursor.fingerprint},
    {...cursor, seconds: 1.5},
    {...cursor, nanoseconds: -1},
    {...cursor, nanoseconds: 1000000000},
    {...cursor, fingerprint: 'different-search'},
  ]) {
    await assert.rejects(
      call({
        cursor: Buffer.from(JSON.stringify(invalid)).toString('base64url'),
      }),
      {code: 'invalid-argument'},
    );
  }
});
