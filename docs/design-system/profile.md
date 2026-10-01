# Profile revamp

Implemented 2026-10-01. Personal account hub; public profiles and other-user viewing are outside this release.

## Approved visual targets

The four approved mockups are the reference for Profile, Edit Profile, share preview, and Settings. Side-by-side native comparison: [target comparison](reference/profile/target-comparison.png). The generated names and avatar are illustrative. Production renders the signed-in account's identity.

Profile uses the current Home, Explore, and Progress system: 22-point gutters, 16-point section gaps, native system typography, rounded surfaces, muted secondary text, orange XP, and the existing tab bar. It adds a stationary top tint, centered avatar with a light pencil badge, identity and bio, edit/share actions, compact XP, three summary stats, View progress, a commitments management card, and a pale-gold Personal bests section. Large text stacks summary metrics and personal bests. Content scrolls clear of the tab bar. The export card is fixed artwork; controls outside the card retain native text scaling.

## Identity and account data

- `UserProfile.profileTint` is optional. Missing or unknown values map to Green at read time; no migration or backfill runs. Valid account values are `green`, `blue`, `purple`, `orange`, `gold`.
- `checkProfileUsername` authenticates, normalizes the candidate, validates 3–20 lowercase letters/numbers/underscores, and reports whether it is free or owned by the caller.
- `updateProfile` accepts only displayName, handle, bio, avatarUrl, profileTint, and timezone. It requires a completed account, validates values on the server, and atomically claims a renamed handle, updates the same UID, and releases the previous claim if owned by that UID. A collision changes none of these fields. There are no aliases or cooldown.
- `refreshMemberProfile` projects current name, username, and avatar onto existing membership records. It reads the latest identity in a transaction so replayed or out-of-order events cannot restore old labels. Historical actor snapshots and UID-linked history remain unchanged.
- Edited photos upload to a new account-scoped file. A failed identity save cannot overwrite the currently published image. Draft fields and the selected photo remain in the editor after failure. Availability can be retried, saving rechecks ownership, and dirty navigation requires a discard decision.
- Canonical Profile summary supplies streaks, lifetime Tap Ins, and active counts. Momentum uses its canonical subscription, including calibration. XP and earned milestone flags come from the saved private Progress summary. Awards are not inferred from today's statistics. Unresolved values display placeholders, not zeroes.

## Navigation and behavior

The main tab has no Profile heading. Its circular Share control sits at the top left, opposite the matching Settings gear. A centered white Edit profile pill uses black text in both themes, a 48-point minimum height, and 24-point horizontal padding. The avatar pencil has a 32-point visible face, a 16-point icon, and a 48-point touch target. Subpages retain their headings.

The avatar pencil opens Edit Profile with the photo picker targeted. Edit profile opens the full form. My commitments opens existing management; View progress selects Progress; XP, streak, and momentum open their existing details. Earned milestones is a read-only list of saved awards.

Share profile opens a preview before capture. The shared image contains the same account identity, tint, XP, streak, momentum, and Tap In totals as the preview. Capture waits for the avatar or initials fallback and complete summary data. The existing view-shot/share libraries export through the native share sheet with `Join me on Hoyst` and `https://hoyst.app/`. The captured file is released after success, cancellation, or failure. An account switch during capture prevents opening the share sheet.

Settings has native stacked Account, Notifications, Appearance, and Help/About pages. Account retains timezone saving and archived management. Notifications retains six preferences, permission handling, and rollback. Appearance retains Light, Dark, and System. Help opens `support@hoyst.app`; About reads version/build from the installed native app. The website and support address were verified at [hoyst.app](https://hoyst.app/) on 2026-10-01. No verified legal destinations were found, so no placeholder legal links are rendered. Sign out confirms first; deletion confirms with the current normalized username and retains the existing backend cleanup.

## Verification

- Button adjustment follow-up: 40 focused Profile tests, typecheck, formatting, and scoped lint pass (zero lint errors; five existing warnings). iOS screenshots were refreshed for light/dark, 360-point width, accessibility text sizes, bottom clearance, guest, incomplete, and summary-loading states. Native checks confirm Share opens the preview and Edit opens the full form; the pencil route retains `focusPhoto: true`. Android was not rerun for this follow-up because no emulator was running.

- Six focused Jest suites: 73 tests passed, including collision draft retention, stale availability, photo failures, account switching, notifications, timezone failure, current-username deletion, native-share transport cleanup, and canonical Progress subscription guards.
- Firestore emulator: six transaction/rules tests passed, including simultaneous claims, normalization, collisions, previous-name release, same-UID history, all five tints, timezone/avatar persistence, stale membership events, and denied direct username/tint writes.
- App typecheck, scoped lint, and Functions build passed.
- iOS signed Simulator build and Android debug build passed. iOS required the checkout's existing React Native header-search command; no Podfile or shared theme changes were introduced.
- iOS captures cover light/dark, all tints, 360-point width, accessibility extra-large text, keyboard, bottom scrolling, edit/share/settings subpages, milestones, and guest/incomplete/loading/error/empty states. Android captures cover light/dark, tints, editor, settings, about, 360-point width with 1.6 font scaling, and data states.
- Actual signed-in iOS Profile loads current account identity, XP, summary stats, commitments, and saved milestone records. Fixture screenshots are explicitly distinguished from the live account.
- iOS native share sheet and cancellation were exercised. The live avatar pencil opened Edit Profile and the native private-access Photos picker; cancelling retained the unchanged form. The captured PNG was inspected against the preview (`ios-export.png`). Nothing was sent to a recipient.

## Deployment and remaining release gate

`checkProfileUsername`, `updateProfile`, and `refreshMemberProfile` deployed successfully to `hoyst-firebase-app`, us-central1, Node 22 / Gen 2. Functions listing confirms all three ACTIVE. The required members/uid collection-group index is present in production. An unauthenticated availability request returns HTTP 401 / UNAUTHENTICATED. Other Functions and Firestore/Storage rules were not deployed by this task.

Android's native share sheet/cancellation and photo-picker interaction still need an interactive device check: the available computer-use tool cannot select the Android emulator window. Android compilation and preview rendering are verified, but those checks do not prove native sharing. No TestFlight or Play release was uploaded.

## Evidence

[Native overview](reference/profile/profile-overview.png), [live iOS account](reference/profile/ios-live-account.png), [iOS keyboard](reference/profile/ios-edit-keyboard.png), [iOS large text](reference/profile/ios-dark-360-large-bottom.png), [Android large text](reference/profile/android-light-360-large-bottom.png), [iOS share sheet](reference/profile/ios-share-sheet.png), [captured PNG](reference/profile/ios-export.png), [Android preview](reference/profile/android-share-light.png). Additional state/tint/subpage images are in `reference/profile/`.

Read-only development fixtures use `hoyst://profile-preview/<mode>` and `/close`. They do not change the session identity, username ownership, history, or server preferences. They are unavailable in release builds. The temporary appearance selection and simulator text-size changes are restored after capture.
