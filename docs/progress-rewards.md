# Progress, XP, and rewards

Implemented September 30, 2026. This is a gated rollout, not a store-ready release. The Progress screen, server economy, historical restore support, and purchase integration are implemented. Functions and rules are deployed to `hoyst-firebase-app`; XP earning was activated on September 30 at 3:46 p.m. America/New_York after authenticated initialization and focused economy validation. Inventory enforcement, restoring, and buying remain disabled. Complete their external setup and acceptance checks before activation.

## Implementation

- `functions/src/progress` owns the wallet, durable earning records, FIFO funding lots, grants, spends, refunds, restore eligibility, and verified purchases. `userPrivate/{uid}/progress/current` and `progressLedger` are owner-readable and server-written. Hashed global transaction claims prevent granting a purchase to two Hoyst accounts.
- Level 1 begins at zero. Every 70 lifetime XP grants one skip; every third level-up additionally grants a restore. All crossed levels are granted atomically. Purchases, protected coverage, and item spending never change XP.
- Routine earning starts at the account's recorded activation boundary. Distinct actual covered successes earn 10 XP, capped at 30 per earning window. Completed opportunity records survive ordinary deletion and prevent recredit. Saved timezone changes wait for the current window to close. The client refreshes when that window closes.
- Starter inventory is 3 skips and 1 restore, granted once. Provable checklist and milestones are reconciled once without backfilling historical routine XP. Native invitation share completion is required; Android uses a chosen-destination callback instead of React Native's sheet-open result.
- Active inventory enforcement replaces commitment allowances. Skip spend and coverage commit together. Open removal/replacement refunds the original funding lot once; a refunded purchase lot cannot resurrect units. Closed coverage remains final. Legacy skip coverage is retained without retroactive charges.
- A restore repairs the original eligible slot and period. It records protected coverage and the original effective date, reconnects commitment/personal streaks where eligible, and reconciles Circle and momentum summaries. It earns no actual Tap In or XP. Confirmation revalidates eligibility, and duplicate requests consume nothing. Historical membership, cadence, and adjacent gaps govern eligibility.
- Progress adopts opt-in design tokens. Tab geometry is retained. The separately approved September 30 Home tint and stats refinement is documented in the design-system decision log. Checklist, preserved momentum/streak details and achievements, inventory usage, restore preview, reward packs, and full reward history are reachable from Progress.
- Account changes clear client summaries and purchase state. RevenueCat uses the Firebase UID. Foreground/sign-in recovery synchronizes purchases and reconciles verified transactions.

## Store setup required

| Product ID | Consumable inventory | Initial US price |
| --- | --- | --- |
| `hoyst_skips_3` | 3 skips | $0.99 |
| `hoyst_restore_1` | 1 restore | $0.99 |
| `hoyst_protection_pack` | 5 skips + 2 restores | $2.99 |

Create these consumables in App Store Connect and Play Console, connect both stores to RevenueCat, and make products available for sandbox testing and platform review. The app requests native store products and displays their localized prices, never the suggested dollar prices as fake store availability.

Set the platform public SDK keys from `.env.example`. Keep secret API keys out of the mobile bundle. Set Firebase secrets `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SIGNING_SECRET`, then set `PROGRESS_PURCHASES_CONFIGURED=true` in the Functions deployment environment and redeploy the purchase functions. Until configured, the endpoints explicitly report unavailable and bind no nonexistent secrets.

Configure RevenueCat's webhook destination as the deployed `progressPurchaseWebhook` URL. Enable HMAC signature verification in RevenueCat, and store its signing secret in Firebase. The handler verifies raw body bytes and timestamped signatures before processing known native-store transaction events. Follow [RevenueCat webhook setup and verification](https://www.revenuecat.com/docs/integrations/webhooks). Verified subscriber reconciliation uses [RevenueCat's customer info model](https://www.revenuecat.com/docs/api-v1/customer-info-model).

Only verified store transaction identifiers grant inventory. Signed refund events revoke remaining unused units without reversing historical protection. Refund-before-delivery records prevent later regrant. Successful native purchase feedback requires verification of that exact new transaction, not an older purchase in the same account.

## Activation and rollback

Server-only document: `serverConfig/progress`.

| Field | Default | Effect |
| --- | --- | --- |
| `earningEnabled` | false | Starts routine activation boundary and credits checklist/milestone/routine XP |
| `inventoryEnforced` | false | Latches account-wide inventory enforcement when each wallet is reconciled or used |
| `restoringEnabled` | false | Permits authoritative historical repair |
| `buyingEnabled` | false | Permits clients to initiate store purchases after configuration |

1. Keep the deployed additions and owner-only rules in place.
2. Finish store setup, authenticated native checks, and both-store sandbox tests.
3. Release clients that submit `progressVersion: 1`, including the native purchase SDK and Android share-completion module.
4. Activate enforcement only when supported clients are available. Older clients receive an update-required error when spending skips after enforcement.
5. Enable earning, restores, and buying deliberately after validation.

Rollback pauses new earning, restoring, or buying. Never delete wallets or durable records, reset balances, or restore free commitment allowances. `inventoryEnforcedAt` is a durable per-account latch, so disabling the configuration flag does not grant previously enforced accounts free skips. Verified interrupted purchase delivery/refunds continue to reconcile existing purchases.

Account deletion recursively removes the private wallet, ledger, and opportunities through the existing deletion pipeline. Non-personal hashed transaction claims remain to prevent purchase replay across accounts.

## Verification completed

- Functions build and app TypeScript check.
- Focused model, purchase, share, momentum, check-in, profile, and Circle streak regression suite: 127 tests across 10 suites.
- Additional Progress navigation/state, retained history, account isolation, daily refresh, purchase, and share suites: 23 tests passed. Tap In composer/picker/completion and commitment creation/editing regression suites: 70 tests passed.
- Firestore emulator: 21 tests covering concurrent initialization/spend/refunds, paused initialization, old-client gating, account isolation, earning caps/deduplication, multi-level reconciliation, historical daily/weekly/monthly repair, historical membership, protected coverage without XP, signed purchase/refund deduplication, rollback enforcement, and owner-only rules.
- Changed-file lint: zero errors, with existing-style warnings. The broader Home suite has one unrelated personal-label assertion failure; navigation assertions were updated to Progress and pass. Frozen Home presentation was retained.
- RevenueCat native SDK integrated in both builds. Android `assembleDebug` and fresh iOS Simulator build succeeded. Both builds were installed and launched in their simulators.
- Native Progress presentation captures: light/dark, guest, loading, error, and zero-inventory fixtures; Android 360 dp with 1.5 text scaling; iOS accessibility-large scaling. These read-only fixtures use production presentation without impersonating accounts or modifying data.

Commands and evidence:

```sh
npm run typecheck
npm --prefix functions run build
npx jest __tests__/progress-model.test.ts __tests__/progress-sharing.test.ts __tests__/progress-purchases.test.ts __tests__/momentum-schedule.test.ts __tests__/momentum-service.test.ts __tests__/momentum-eligibility.test.ts __tests__/momentum-transaction-order.test.ts __tests__/profile.test.ts __tests__/circle-group-streak.test.ts __tests__/checkins.test.ts --runInBand --transformIgnorePatterns 'node_modules/(?!.*(react-native|@react-native|@react-navigation|lucide-react-native))'
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npx firebase emulators:exec --only firestore --project hoyst-firebase-app 'node --test --test-concurrency=1 tests/progress-emulator.test.mjs'
```

Logs are in `/tmp/hoyst-progress-regression.log`, `/tmp/hoyst-progress-emulator-tests.log`, `/tmp/hoyst-progress-ios-build.log`, `/tmp/hoyst-progress-android-build.log`, and `/tmp/hoyst-progress-release-deploy.log`. Screenshots are under `docs/design-system/reference/progress`.

The iOS build required a command-line `HEADER_SEARCH_PATHS` override for this checkout's pnpm ReactCommon headers. It included ReactCommon, yoga, react/nativemodule/core, react/runtime, runtimeexecutor, callinvoker, and every ReactCommon `platform/ios` and `platform/cxx` root, retaining `$(inherited)`. No frozen shared UI was changed to solve that build issue.

## Release acceptance still pending

RevenueCat public keys, secret bindings, consumable setup, and platform approval are unavailable in this session. Real sandbox purchases on both stores have not been performed. Do not treat mocked/provider-ledger tests as real store evidence.

The iOS Simulator has an authenticated account. Live earning activation credited 110 XP from five provable checklist tasks and three historical milestones, reached Level 2, and granted one skip (inventory 4 skips / 1 restore). Repeated native initialization retained 110 XP and nine ledger entries. The earning window recorded zero routine XP, so historical routine activity was not backfilled. Native routine Tap In/cap feedback, skip spending/refunds, restore preview/confirmation, and the remaining account-reload flow matrix still need acceptance checks. Android presentation uses read-only fixtures and a signed-out Home. The complete supporting flow matrix, Android share destination/cancel interaction, real cancellation/pending payment/interrupted delivery/refunds, and reduced-motion OS configuration need release validation. The real iOS guest Sign in button was also verified to open the native authentication screen. Fixture route testing proves presentation only. These are concrete acceptance gates, not claims of completed end-to-end validation.

## September 30 earning activation evidence

Live read-only inspection found `serverConfig/progress` missing, which defaults all flags to false. The already deployed Progress functions were ACTIVE. After 21 Firestore transaction/rules tests, model/hook validation, and authenticated native initialization, the server configuration was created at `2026-09-30T19:46:27.815923Z` with only `earningEnabled: true`. The other three flags remain false. No backend code or deployment was changed in this refinement.

The native app and server ledger agreed on 110 XP: checklist 50 XP, historical Strong/Peak momentum 20/30 XP, and the 3-day personal streak milestone 10 XP. Level 2 granted one skip automatically. Three starter skips and one restore remained intact. Native refreshes and preview closure reinitialized the wallet without granting duplicates. No Tap In or protection event was submitted to manufacture this evidence.

The production iOS capture is `docs/design-system/reference/progress/earning-enabled-live-ios.png`. The current flags were verified again after the native checks. Store purchases, historical restores, and shared-skip enforcement remain gated.
