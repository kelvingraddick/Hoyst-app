#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {closeSync, fsyncSync, openSync, readFileSync, writeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
const {
  activityEpoch,
  isPublicActive,
  isSuccessfulDone,
} = require('../functions/lib/discovery/model.js');
const {Timestamp, FieldPath, FieldValue} = admin.firestore;
const pageSize = 200;
const dayMs = 86_400_000;

function validTimestamp(value) {
  return value instanceof Timestamp && value.toMillis() > 0;
}
function compare(a, b) {
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

export function backfillWindow(activatedAt) {
  if (!validTimestamp(activatedAt)) {
    throw new Error(
      'Public discovery must already have a valid activation timestamp.',
    );
  }
  return {
    start: new Timestamp(
      activatedAt.seconds - 30 * 86400,
      activatedAt.nanoseconds,
    ),
    end: activatedAt,
  };
}

/** Deliberately conservative: creation must also be the unedited successful submission. */
export function evaluateRecord({
  circle,
  index,
  member,
  profile,
  checkIn,
  window,
}) {
  if (
    !isPublicActive(circle) ||
    !index ||
    (index.circleMode ?? 'group') !== 'group' ||
    (index.lifecycleStatus ?? 'active') !== 'active'
  ) {
    return 'circle_not_public_active';
  }
  if (!checkIn) {
    return 'check_in_missing';
  }
  if (checkIn.publicTapIn !== undefined) {
    return 'existing_marker';
  }
  if (!isSuccessfulDone(checkIn) || checkIn.coverageStatus !== 'covered') {
    return 'not_successful';
  }
  if (
    checkIn.coverageRevision !== 1 ||
    !validTimestamp(checkIn.createdAt) ||
    !validTimestamp(checkIn.updatedAt) ||
    !checkIn.createdAt.isEqual(checkIn.updatedAt)
  ) {
    return 'ambiguous_timestamp';
  }
  if (
    compare(checkIn.createdAt, window.start) < 0 ||
    compare(checkIn.createdAt, window.end) >= 0
  ) {
    return 'outside_window';
  }
  if (
    member?.status !== 'active' ||
    !validTimestamp(member.joinedAt) ||
    compare(checkIn.createdAt, member.joinedAt) < 0
  ) {
    return 'membership_ineligible';
  }
  if (!profile) {
    return 'profile_missing';
  }
  const boundary = circle.publicActivityEpoch ?? circle.createdAt;
  if (!validTimestamp(boundary) || compare(checkIn.createdAt, boundary) < 0) {
    return 'before_public_boundary';
  }
  return 'eligible';
}

export function markerFor(path, checkIn, circle) {
  const time = checkIn.createdAt;
  return {
    eventId: `backfill_${createHash('sha256')
      .update(`${path}:${time.seconds}:${time.nanoseconds}`)
      .digest('hex')}`,
    occurredAt: time,
    epoch: activityEpoch(circle),
  };
}
function serializeMarker(marker) {
  return {
    ...marker,
    occurredAt: {
      seconds: marker.occurredAt.seconds,
      nanoseconds: marker.occurredAt.nanoseconds,
    },
  };
}
function sameMarker(a, b) {
  return (
    a?.eventId === b?.eventId &&
    a?.epoch === b?.epoch &&
    a?.occurredAt?.seconds === b?.occurredAt?.seconds &&
    a?.occurredAt?.nanoseconds === b?.occurredAt?.nanoseconds
  );
}

export async function backfillRecord({
  db,
  path,
  window,
  commit = false,
  journal = () => {},
}) {
  const parts = path.split('/');
  if (
    parts.length !== 6 ||
    parts[0] !== 'circles' ||
    parts[2] !== 'days' ||
    parts[4] !== 'checkIns' ||
    !parts.every(Boolean)
  ) {
    throw new Error('Invalid check-in path.');
  }
  const circleRef = db.doc(`circles/${parts[1]}`);
  const ref = db.doc(path);
  return db.runTransaction(async transaction => {
    const [circle, index, member, profile, checkIn, config] = await Promise.all(
      [
        transaction.get(circleRef),
        transaction.get(db.doc(`publicCircleIndex/${parts[1]}`)),
        transaction.get(circleRef.collection('members').doc(parts[5])),
        transaction.get(db.doc(`users/${parts[5]}`)),
        transaction.get(ref),
        transaction.get(db.doc('serverConfig/publicDiscovery')),
      ],
    );
    if (!config.data()?.activityActivatedAt?.isEqual(window.end)) {
      throw new Error('Activation changed during the run; stopping.');
    }
    const reason = evaluateRecord({
      circle: circle.data(),
      index: index.data(),
      member: member.data(),
      profile: profile.data(),
      checkIn: checkIn.data(),
      window,
    });
    const entry = {
      path,
      circleId: parts[1],
      title: circle.data()?.title ?? '',
      dateKey: parts[3],
      reason,
    };
    if (reason !== 'eligible') {
      return {...entry, status: 'skipped'};
    }
    const marker = markerFor(path, checkIn.data(), circle.data());
    const result = {
      ...entry,
      marker: serializeMarker(marker),
      occurredAt: marker.occurredAt.toDate().toISOString(),
      status: commit ? 'written' : 'eligible',
    };
    if (commit) {
      // Durable write-ahead entry also permits recovery if the process stops after commit.
      journal({...result, status: 'write_intent'});
      transaction.update(ref, {publicTapIn: marker});
    }
    return result;
  });
}

export async function rollbackRecord({db, entry, commit = false}) {
  if (
    !/^circles\/[^/]+\/days\/[^/]+\/checkIns\/[^/]+$/.test(entry.path) ||
    !entry.marker?.eventId?.startsWith('backfill_')
  ) {
    throw new Error('Invalid rollback entry.');
  }
  const ref = db.doc(entry.path);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!sameMarker(snapshot.data()?.publicTapIn, entry.marker)) {
      return {...entry, status: 'skipped', reason: 'marker_changed_or_missing'};
    }
    if (commit) {
      transaction.update(ref, {publicTapIn: FieldValue.delete()});
    }
    return {...entry, status: commit ? 'rolled_back' : 'rollback_eligible'};
  });
}

async function* pages(query) {
  let after;
  for (;;) {
    const page = await (after ? query.startAfter(after) : query)
      .limit(pageSize)
      .get();
    for (const doc of page.docs) {
      yield doc;
    }
    if (page.size < pageSize) {
      return;
    }
    after = page.docs.at(-1);
  }
}

// Direct day paths avoid a new production index and include timezone boundary days.
export function dateKeys(window) {
  const first = Math.floor(window.start.toMillis() / dayMs) * dayMs - dayMs;
  const last = Math.floor(window.end.toMillis() / dayMs) * dayMs + dayMs;
  const keys = [];
  for (let time = first; time <= last; time += dayMs) {
    keys.push(new Date(time).toISOString().slice(0, 10));
  }
  return keys;
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some(
      arg =>
        arg !== '--commit' &&
        !['--project=', '--report=', '--rollback='].some(prefix =>
          arg.startsWith(prefix),
        ),
    )
  ) {
    throw new Error(
      'Unknown argument. Use --project=ID --report=FILE [--commit] [--rollback=REPORT].',
    );
  }
  const option = name =>
    args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const projectId = option('project');
  const reportPath = option('report');
  const rollbackPath = option('rollback');
  const commit = args.includes('--commit');
  if (!projectId || !reportPath) {
    throw new Error('--project and --report are required.');
  }
  if (process.env.FIRESTORE_EMULATOR_HOST && !projectId.startsWith('demo-')) {
    throw new Error('Emulator runs require a demo project.');
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
  const db = admin.firestore();
  let rollbackEntries;
  if (rollbackPath) {
    const rows = readFileSync(rollbackPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const header = rows[0];
    if (
      header?.type !== 'header' ||
      header.projectId !== projectId ||
      header.operation !== 'backfill' ||
      header.mode !== 'commit'
    ) {
      throw new Error(
        'Rollback requires a committed backfill report for this project.',
      );
    }
    rollbackEntries = [
      ...new Map(
        rows
          .filter(
            row => row.status === 'written' || row.status === 'write_intent',
          )
          .map(row => [row.path, row]),
      ).values(),
    ];
  }
  const window = rollbackPath
    ? undefined
    : backfillWindow(
        (await db.doc('serverConfig/publicDiscovery').get()).data()
          ?.activityActivatedAt,
      );
  const fd = openSync(reportPath, 'wx', 0o600);
  const journal = entry => {
    writeSync(fd, `${JSON.stringify(entry)}\n`);
    if (commit) {
      fsyncSync(fd);
    }
  };
  const counts = {};
  const circles = new Map();
  const record = entry => {
    journal(entry);
    const key = entry.status === 'skipped' ? entry.reason : entry.status;
    counts[key] = (counts[key] ?? 0) + 1;
    if (entry.circleId) {
      const circle = circles.get(entry.circleId) ?? {
        circleId: entry.circleId,
        title: entry.title,
        eligible: 0,
      };
      if (entry.status === 'eligible' || entry.status === 'written') {
        circle.eligible++;
      }
      circles.set(entry.circleId, circle);
    }
  };
  try {
    journal({
      type: 'header',
      projectId,
      operation: rollbackPath ? 'rollback' : 'backfill',
      mode: commit ? 'commit' : 'dry-run',
      createdAt: new Date().toISOString(),
      ...(window
        ? {
            window: {
              start: window.start.toDate().toISOString(),
              end: window.end.toDate().toISOString(),
            },
            days: 30,
          }
        : {sourceReport: resolve(rollbackPath)}),
    });
    if (rollbackEntries) {
      for (const entry of rollbackEntries) {
        record(await rollbackRecord({db, entry, commit}));
      }
    } else {
      for await (const doc of pages(
        db.collection('publicCircleIndex').orderBy(FieldPath.documentId()),
      )) {
        circles.set(doc.id, {
          circleId: doc.id,
          title: doc.data().title,
          eligible: 0,
        });
        const circleRef = db.doc(`circles/${doc.id}`);
        if (!isPublicActive((await circleRef.get()).data())) {
          record({
            circleId: doc.id,
            title: doc.data().title,
            status: 'skipped',
            reason: 'circle_not_public_active',
          });
          continue;
        }
        for (const dateKey of dateKeys(window)) {
          const query = circleRef
            .collection('days')
            .doc(dateKey)
            .collection('checkIns')
            .orderBy(FieldPath.documentId());
          for await (const checkIn of pages(query)) {
            record(
              await backfillRecord({
                db,
                path: checkIn.ref.path,
                window,
                commit,
                journal,
              }),
            );
          }
        }
      }
    }
    const summary = {
      type: 'summary',
      counts,
      circles: [...circles.values()],
      report: resolve(reportPath),
    };
    journal(summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    journal({type: 'error', message: error.message});
    throw error;
  } finally {
    closeSync(fd);
    await db.terminate();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
