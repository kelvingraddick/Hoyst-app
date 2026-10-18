# Circle progress and streaks v2

Production backend deployed and backfilled on October 17, 2026 in `hoyst-firebase-app`. All 32 targeted Functions are active and all three migration phases completed for 13 Circles. [Production verification record](production-rollout.json) captures the release scope and stored-data checks. The mobile client has not been released.

## Rules and contracts

`functions/src/shared/circle-progress.ts` is the pure calendar and period-goal implementation. The client reexports it through `src/shared/circle-progress.ts`. Dates use the Circle timezone, Monday to Sunday weeks, and calendar months. A member can cover at most one contribution per date. Recorded covered outcomes and valid protection are retained without applying current quantity thresholds to old entries.

Weekly and monthly opportunities use `policyVersion: 2` and `period_quota`. Every unit is available throughout the eligible part of the period. Existing daily deadlines and legacy day-count fields retain their meanings. Quota opportunity IDs contain `_v2_`; current legacy windows are neutralized without deleting their earning history. Hydration does not grant XP. Extra completed dates do not consume another quota unit after the target is met; protection cannot spend against a satisfied target.

The partial first target is fixed at entry, capped by available eligible dates. Creators start on their creation date; later members start the next Circle date. A secured period earns credit immediately. An open period holds the previous streak until the remaining eligible dates cannot meet the target. Departures and archives cancel unfinished obligations. Already earned coverage on a transition date remains covered. Rejoining creates a separate personal run, including within the same calendar period. Group outcomes retain obligations from each eligible run and count each member once in current group progress.

New data is additive:

| Path                                                          | Contents and access                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `circles/{id}.groupStreak`                                    | Public group summary with cadence, revision, date, period, progress, and explicit streak count/unit/availability |
| `publicCircleIndex/{id}.groupStreak`                          | Group summary only, for discovery                                                                                |
| `userPrivate/{uid}/circleProgress/{circleId}`                 | Owner-readable personal summary                                                                                  |
| `userPrivate/{uid}/circlePeriods/{circleId}_{runId}_{period}` | Owner-readable run outcomes, target, covered count, revision, and evidence availability                          |
| `circles/{id}/progressPeriods/{period}`                       | Authorized active-member group outcomes and member aggregates                                                    |
| `circles/{id}/days/{date}.activityCoverage`                   | Explicit known state, historical expected members, completions, skips, restores                                  |
| `circles/{id}/lifecycleHistory/{revision}`                    | Server-written lifecycle transition evidence, private to the backend                                             |
| `circleProgressSources/{id}`                                  | Server-only reconciliation ownership token                                                                       |

Unavailable or inconsistent membership/lifecycle evidence produces unavailable results, never invented participants or successful periods. An absent client day aggregate remains unloaded/unavailable. Summary readers reject stale dates, mismatched configuration revisions, invalid counts, or incorrect cadence units. Archived summaries may retain their frozen date.

`submitTapIn` returns a separate `circleProgress` alongside its original overall daily-streak response. It includes personal/group summaries and streak deltas when the before/after revisions are comparable. The overall metric is labeled **Daily Tap In streak** and keeps its calculation.

Check-in, membership, configuration, and lifecycle triggers reconcile the derived data. Hourly reconciliation advances inactive active Circles; Circle Detail refreshes on focus, foregrounding, and Circle-local date rollover. Reconciliation tokens and configuration checks reject superseded work. Quota hydration additionally revalidates raw coverage queries and membership snapshots transactionally. Historical writes are skipped when their fingerprints match. Private writes recheck account existence/deletion state.

## Migration and rollout procedure

The migration selects its Admin project explicitly before importing application code. It defaults to dry run. Run the phases in order: `daily-coverage`, `period-outcomes`, `summaries`. Each phase derives from source facts and can be rerun. Committed whole-project runs checkpoint each completed Circle; canaries do not advance that checkpoint. Superseded work stops before advancing the cursor.

```sh
npm --prefix functions run build
node scripts/migrate-circle-progress.mjs --project=YOUR_PROJECT_ID --phase=daily-coverage --limit=25
node scripts/migrate-circle-progress.mjs --project=YOUR_PROJECT_ID --phase=period-outcomes --limit=25
node scripts/migrate-circle-progress.mjs --project=YOUR_PROJECT_ID --phase=summaries --limit=25
```

After local review, preview an explicit Circle without `--limit`. Add `--commit` only for an authorized write. Use `--resume` for a previously committed whole-project phase or `--after-id=CIRCLE_ID` for an explicit cursor. ADC must authorize the selected project. No migration phase spends inventory, replays XP, or emits historical notifications.

Deployment order, completed for the backend on October 17:

1. Deploy additive Functions and owner/active-member authorization rules.
2. Review dry-run differences and unavailable evidence, then authorize and run committed phases on a canary.
3. Complete the Android visual acceptance check and inspect the refreshed client against canary data.
4. Authorize the wider backfill, then release the updated client.

Legacy data is retained. Older clients continue receiving original daily fields; they do not receive weekly/monthly numbers in fields named `streakDays`.

The reconciler reads supported Circle history to rebuild outcomes. Production read volume and duration should be reviewed on the canary before a wide backfill. Rollout is deliberately separate from this code delivery.

## Local validation

- Expanded affected regression suite: 390 tests across 22 suites passed.
- Circle Firestore emulator suite: 16 tests passed, including phase reruns, historical cohorts, private authorization, quantity corrections, same-period rejoining, skips/refunds, restore charging/deduplication, concurrency, and no historical economy replay.
- Existing protection/compatibility Firestore emulator suite: 21 tests passed.
- App and Functions TypeScript checks passed; affected source lint has no errors.
- Android ARM64 Debug build passed and installed on the Pixel 10 emulator.

Emulator commands:

```sh
firebase emulators:exec --only firestore --project demo-hoyst-circle-progress 'node --test --test-concurrency=1 tests/circle-progress-emulator.test.mjs'
firebase emulators:exec --only firestore --project hoyst-firebase-app 'node --test --test-concurrency=1 tests/progress-emulator.test.mjs'
```

Use Java 21 for the Firebase CLI. In this workspace, Node 22 is at `/Users/kelvin/.nvm/versions/node/v22.23.2/bin` and Java 21 is at `/opt/homebrew/opt/openjdk@21/bin`.

## Native visual evidence

The debug menu exposes `Circle progress: light`, `dark`, `light-narrow`, `dark-narrow`, `daily`, `monthly`, `personal`, and `unknown`. These fixtures reuse the real hero, progress panel, daily timeline, and member strip. They submit no Tap Ins or account changes. Narrow mode constrains content to 360 points. The selected weekly fixture shows Your streak 4 weeks and Group streak 2 weeks, with all contribution states and a protected complete day.

Reviewed on iPhone 17 Pro, iOS 26.5:

- [Light](evidence/ios-light.png), [dark](evidence/ios-dark.png), and [day details](evidence/ios-day-details.png).
- [360-point content with increased OS text size](evidence/ios-narrow-larger-text.png): streak text wraps within equal columns, with the daily path scrollable when needed. Font-size changes remount the local text layout to avoid stale native measurements.
- Protected-day details distinguish a completion from a valid skip. Accessibility labels say covered and identify protection independently of color.

Android screenshots remain unverified. The emulator is reachable through ADB, but its window is unavailable to the enabled UI tool. Android Studio's device view cannot finish project sync because its launch environment cannot find Node. The successful Gradle build used an explicit Node PATH. No Android visual or TalkBack acceptance is claimed. Full VoiceOver/TalkBack navigation remains a mobile release check. Production canary and full backfill verification passed. The 13-Circle backfill verified 1,005 daily aggregates, 803 group periods, 1,209 private member periods, 19 personal summaries, and 8 public group summaries. Check-ins, legacy streak fields, wallets, and reward ledgers were unchanged. The five new Functions had no errors across 41 reviewed runtime log entries.
