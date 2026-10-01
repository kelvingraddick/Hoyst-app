# Public Tap In history backfill

This migration adds public discovery markers to eligible completed Tap Ins in the
30 days immediately before `serverConfig/publicDiscovery.activityActivatedAt`.
The interval includes its start and excludes activation. The boundary remains
unchanged on every rerun. Explore continues to display one latest eligible event
per Circle; notes, photos and private feed content are excluded.

## Eligibility and publication

The script requires an active public group Circle, its existing public index, a
current active member with a valid join timestamp, and an existing profile. A
record must be `done`, have `coverageStatus: covered`, coverage revision 1, and
exactly matching Firestore creation/update timestamps. The original creation
timestamp must lie in the window, at or after the current membership join and
the recorded public activity epoch (falling back to Circle creation). Missing,
edited, unsuccessful or ambiguous records are reported and skipped.

Checks are repeated transactionally with the Circle, membership, profile,
check-in, public index and activation setting. Existing markers are never
overwritten. Event IDs are deterministic from the check-in path and full original
timestamp. Only `publicTapIn` is written; original timestamps and all other
check-in fields are preserved. The existing discovery trigger creates candidates
and reconciles the latest preview.

`processTapInSideEffects` must be deployed with its publication-only update guard
**before any committed migration or rollback**. The guard returns before normal
notification, activity, streak or metric handling when only `publicTapIn` changes.
Ordinary submissions, details edits, removals and mixed updates retain existing
behavior.

## Run

Use Node 22 with the project's existing Firebase Admin credentials. Build the
Functions sources first. Both project and a new report filename are mandatory.
Reports use JSON Lines and file permissions 0600. Keep them outside Git.

```sh
npm run functions:build
node scripts/backfill-public-tap-ins.mjs --project=hoyst-firebase-app --report=/absolute/path/dry-run.jsonl
firebase deploy --only functions:processTapInSideEffects --project hoyst-firebase-app
node scripts/backfill-public-tap-ins.mjs --project=hoyst-firebase-app --report=/absolute/path/committed.jsonl --commit
```

The default run is read-only. Reports include each qualifying/skipped record,
skip reason, original event time, per-Circle totals and the frozen interval.
Committed reports durably journal marker intent before writes and success after
commit, permitting recovery after interruption. Repeated committed runs preserve
existing markers and can resume records not yet processed. If activation changes
during a run, the migration stops.

The scan pages public-index and check-in collections at 200 documents and reads
direct date paths, including adjacent UTC days for timezone boundaries. It does
not require a new production Firestore index.

## Rollback

```sh
node scripts/backfill-public-tap-ins.mjs --project=hoyst-firebase-app --rollback=/absolute/path/committed.jsonl --report=/absolute/path/rollback-preview.jsonl
node scripts/backfill-public-tap-ins.mjs --project=hoyst-firebase-app --rollback=/absolute/path/committed.jsonl --report=/absolute/path/rollback.jsonl --commit
```

Rollback accepts only a committed backfill report for the selected project. It
deduplicates successful and write-intent entries and rereads each current marker.
Only a matching event ID, epoch and full timestamp is removed. Newer/replaced
markers are preserved. Discovery triggers withdraw candidates and reconcile
remaining events; original check-ins stay intact.

## Validation

```sh
node --test tests/public-tap-in-backfill.test.mjs tests/public-discovery-pagination.test.mjs
firebase emulators:exec --project demo-hoyst-explore --only firestore,storage "node --test --test-concurrency=1 tests/public-discovery-emulator.test.mjs tests/public-tap-in-backfill-emulator.test.mjs"
```

The emulator requires Java 21. Coverage includes marker-only suppression in the
real handler, normal detail updates, transaction rereads after edits, original
timestamps, dry-run, reruns, rollback, latest selection/fallback, privacy and
membership withdrawal, and private-content exclusion. After production writes,
verify stored projections, the anonymous search callable and refreshed Explore
cards. Circles without eligible records remain without an activity preview.

## Production result: September 29, 2026

The side-effect guard was deployed to `hoyst-firebase-app`, and 73 historical
markers were committed across six Circles. Eight unsuccessful records and four
records with ambiguous timestamps were skipped. Bookies had no eligible history.
The activation boundary remained September 29 at 9:34:27 PM America/New_York.

Stored latest previews and the anonymous live search response matched the newest
qualifying event in each Circle. Before/after hashes verified 226 check-in,
Circle, activity, side-effect and activation documents were unchanged apart from
publication markers. The refreshed iPhone 17 Pro Simulator displayed previews on
Explore, with all six activity labels present in its accessibility tree. A
read-only rollback preview verified all 73 markers can be matched safely.

Validation passed: 27 unit/pagination tests, 14 Firestore emulator tests, 22
existing Jest tests, Functions compilation, scoped lint, formatting and diff
checks. No app source changes were required.

The dry-run, commit/rollback reports and verification evidence are saved in
`/Users/kelvin/Documents/Codex/hoyst-public-tap-in-backfill-2026-09-29/`.
