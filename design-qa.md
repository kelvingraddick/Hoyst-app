# Progress design QA

Source visual truth: `/Users/kelvin/.codex/generated_images/01a0efec-cf56-7272-b461-cd1fe6ea30e6/exec-557328cc-4298-4fb5-aee4-e913db1e291b.png`.

Implementation: `src/features/progress/screens/ProgressScreen.tsx`, native iOS and Android Debug builds. Read-only fixture state matches the source: Level 2, 50 / 70 XP, 120 lifetime XP, next Level 3 and Level 4, 4 of 7 checklist tasks, 2-day streak, 30% momentum, 3 skips and 1 restore.

## Comparison evidence

Source: 853 x 1844 pixels. Normalize width to 402 logical points, approximately 2.12 source pixels per point. Native iOS: 1206 x 2622 pixels at 3x, 402 x 874 points. The mock's equivalent height is approximately 869 points, and it omits the native OS safe area. Android: 1080 x 2424 pixels at 420 density, approximately 411 x 923 dp. Narrow validation uses 480 density for 360 x 808 dp, with 1.5 system font scaling.

Full source and native top captures were opened together in one comparison input. Full source and the native bottom capture were then opened together in another input. No separate-view comparison was represented as a stitched image. Native top and bottom captures collectively cover all source sections. Focused comparisons examined the header/XP/ladder and rewards/details regions in these same paired inputs.

- `docs/design-system/reference/progress/fixture-light-top.png`
- `docs/design-system/reference/progress/fixture-light-bottom.png`
- `docs/design-system/reference/progress/fixture-dark-top.png`
- `docs/design-system/reference/progress/ios-dark-bottom.png`
- `docs/design-system/reference/progress/android-light-top.png`
- `docs/design-system/reference/progress/android-dark-bottom.png`
- `docs/design-system/reference/progress/android-dark-360-large.png`
- Native guest/loading/error/zero captures named `ios-{state}.png` and `android-{state}.png` in the same directory.

The source fits more content on one page. Native minimum hit targets, scalable native fonts, OS safe areas, and the frozen tab geometry increase height. This is an explicit native adaptation required by the implementation plan. It is not a claim of pixel-identical reproduction. The visible section order, copy, semantic colors, and separate reward targets follow the approved screen.

## Findings and comparison history

- Earlier [P2] reward buttons did not align because the restore title/description wrapped differently. Fixed the row layout and body growth, retained readable 14-point titles, and recaptured `fixture-light-bottom.png` and `ios-dark-bottom.png`. Counts, titles, descriptions, and equal-height buttons now fit both cards.
- Earlier [P2] checklist XP floated beneath the task action and increased layout drift. XP now sits within the explanatory copy. Post-fix light/dark top captures show the task and XP together.
- Earlier [P1] Android's native preview stack failed inside a separate modal React root. The developer fixture now mounts under the existing root, matching the existing preview host pattern. `android-light-top.png` and subsequent guest/error/large-text captures show the production screen rendering successfully.
- Earlier [P1] native dark fixture appearance reset used an incorrect settings method. Corrected to the real preference API and restored the previous appearance on unmount. Dark top and bottom captures confirm both the screen and unchanged tab bar use dark colors.
- Resolved in the September 30 refinement: restored the medal Hoy, layered ladder rings, Earned badge, connector progress dot, sparkles, overlapping lock badge, and filled streak/momentum artwork. Confirmed revised colors are orange XP fill, green completed level, blue next level, and gray locked level.
- [P2 validation gate] Authenticated supporting screens and transitions have not been captured on the fresh native builds. The simulators are signed out. Read-only destinations deliberately do not substitute for actual checklist/reminder saves, skip selection/completion, restore preview/confirmation, history, purchase states, and account reload.

## Fidelity surfaces

- Typography: native System/Android fonts and local compact Progress sizes replace the generated image's font approximation. Only "Unlock rewards." is bold in the subtitle. Ladder titles are 16 points; Earn more XP uses a 13-point heading, 15-point task title, and 12-point description; stat values/captions are 16/11 points. Native scaling wraps instead of truncating screen content. The fixed existing tab bar can shorten the Progress label at 360 dp with 1.5 scaling; its accessibility label remains complete and its geometry stays frozen by request.
- Spacing/layout: established gutters, card padding, neutral rounded surfaces, independent reward cards, and tab clearance are present. Minimum native controls increase scroll height relative to the mock. Lower rows remain above the tab when scrolled to the end.
- Color/tokens: golden top fade, neutral canvas/surfaces, orange XP fill, green completed marker, blue next marker/actions, gray locked marker, green skips, and orange restores match the latest requested roles. Accessible semantic foregrounds are darker in light mode and lighter in dark mode than the generated palette.
- Assets: Hoy is a local raster, not CSS/shape art. Standard icons use the app's existing library. Asset transparency and scale are clean in inspected native captures.
- Copy: title and exact subtitle match the request. Dynamic XP/checklist/reward values match the source fixture. The locked state is explicit, and supporting reward-history copy additionally includes usage events.
- Motion/accessibility: no new animation was added. Enlarged text and the narrow Android screen render without app-owned horizontal overflow. Native OS reduced-motion settings and the full supporting flow matrix remain unverified.

## Implementation checklist

- Completed September 30 refinement: header gap 16 points, compact ladder/earning/stats composition, native iOS/Android light/dark comparison, native 360-point viewport comparison, iOS accessibility-large and Android 1.5 text scaling, expanded checklist, 12 focused screen tests, typecheck, and scoped lint/diff checks. Captures are `docs/design-system/reference/progress/refined-*`. The large-text checklist footer was split into two rows after native inspection caught cramped wording. Read-only narrow/middle fixture modes support repeatable captures. Home, tab geometry, reward cards, shared theme defaults, and server economy were not modified in this refinement.

- Completed: real iOS Progress guest tab and Sign in navigation to authentication.
- Completed: native main-screen light/dark/state captures, source comparisons, reward target separation tests, direct checklist action tests, guest/retry tests, and client account-isolation tests.
- Pending: sign into an eligible test account and capture every supporting flow on both platforms, including normal scrolling gestures and native share completion/cancellation.
- Pending: complete RevenueCat/store setup and real sandbox purchase state validation on both stores.

The main presentation has no remaining observed P0/P1 visual failures after the documented fixes. Full native flow validation remains open, so this report does not authorize a completed UI/release handoff. The design QA skill states: “If source capture, prototype capture, or visual comparison is blocked, stop.” Its instructions are at `/Users/kelvin/.codex/plugins/cache/openai-curated-remote/product-design/0.1.56/skills/design-qa/SKILL.md`.

final result: blocked

## September 30 stationary tint, shared stats, and earning activation

Scoped presentation acceptance: passed iOS/Android native light/dark captures, 360-point content, and enlarged text on fresh launches. Current markers are green at Levels 1, 2, and 4; Level 1 has no Earned badge. Connector contrast is darker, bottom links match Home, and native safe-area clipping prevents status-icon/content collisions. Home's fixed tint retains the exact Hoy palette and measured original fade extent. Both screens use the same stats artwork and compact geometry; intrinsic vertical sizing prevents earning copy, stats, or reward counts collapsing. Native iOS Home streak navigation opens Current Streak directly.

Evidence lives in `docs/design-system/reference/progress`: `fixed-statusbar-options-*`, `shared-stats-*-360.png`, `shared-stats-*-large.png`, `home-fixed-tint-*`, `home-stats-*`, `home-streak-details-ios.png`, `current-level-one-ios.png`, and `current-level-four-ios.png`. Android Home is signed out; iOS Home uses the already authenticated account. Shared Android stats are verified in Progress's production presentation fixture. Debug warning banners may appear in Android enlarged-text captures; they do not represent production UI.

Authenticated production earning acceptance: the missing configuration defaulted earning off. At 3:46 p.m. America/New_York only earning was enabled. The native iOS app and durable server records agreed on 110 XP, Level 2, 4 skips, 1 restore, and zero historical routine XP. Refresh retained 110 XP and nine ledger entries. Screenshot: `earning-enabled-live-ios.png`. Checklist 50 XP, historical Strong/Peak momentum 20/30 XP, and 3-day personal streak 10 XP each credited once; Level 2 granted one skip. No artificial live Tap In, spending, or store transaction was submitted. Other activation flags remain false.

Checks: app typecheck and diff checks passed; focused Progress screen 14/14, relevant Home 13/13, model/hook 24/24, and Firestore economy/rules 21/21 passed. Scoped lint had zero errors and 16 existing-style warnings. The broad Home suite retains its previously documented `PERSONAL` category-label assertion failure. Logs: `/tmp/hoyst-progress-home-final-screen.log`, `/tmp/hoyst-progress-home-focused-home-final.log`, `/tmp/hoyst-progress-home-model-hook.log`, `/tmp/hoyst-progress-home-economy-validation.log`, and `/tmp/hoyst-progress-home-final-lint.log`.

Concrete platform limitation: toggling Android OS font size while the app is running recreates MainActivity and triggers the existing `Screen fragments should never be restored` failure. The unchanged MainActivity has no saved-fragment-restoration override. Enlarged-text presentation was verified by stopping the app before changing font size, then cold launching the installed Debug build. Android font_scale was restored to 1.0 and iOS content_size to large. Fixing runtime Activity restoration remains separate native work.

Overall release acceptance remains gated by the remaining authenticated routine/protection flow matrix and real store setup/sandbox checks. Earning activation and main-screen presentation do not imply purchases or restores are ready.

## Progress color and earning-control follow-up

Scoped changes: current-level core and ladder skip icons use Home completed-day green `#10B967`; owned skip/restore icons and purchase fills use `#10B967` / streak flame orange `#FF6D00`. Purchase labels and current-level numbers use readable charcoal. Neutral surfaces, pale rings, upcoming/locked colors, destinations, and reward rules remain unchanged. The earning CTA is an arrow-only blue circle with its descriptive accessibility label retained. The checklist footer shrinks to a 32-point visual minimum, with vertical hit slop maintaining iOS 44-point and Android 48-point targets; enlarged text remains intrinsic.

Evidence: `docs/design-system/reference/progress/bright-controls-*` includes iOS/Android normal light/dark, 360-point content, iOS accessibility-large, Android 1.5 font scaling, and dark enlarged-text reward controls. Native inspection confirmed the changed colors, arrow placement, footer hierarchy, wrapping, and readable purchase labels. Some Android captures retain debug LogBox banners and preview status-bar/tab theme mismatches, outside the changed content. Cold launches avoid the already documented Activity font-change restoration issue. Both OS text sizes and preview appearance were restored.

Checks: 18/18 focused Progress tests passed, including arrow/task/routine/milestone navigation, checklist expansion and touch area, light/dark purchase colors, pressed feedback, zero balances, and separate usage/purchase targets. App typecheck, scoped lint, and whitespace checks passed; scoped lint retains five existing inline-style warnings and zero errors. No backend, Home, tab-bar, shared defaults, live reward events, or platform purchase setup changed in this refinement.

## Authenticated reward-card overflow correction

The user's signed-in screenshot showed the skip card expanding to fit its description and pushing the restore card offscreen, despite the prior read-only fixture checks. Progress now measures the reward row and assigns two explicit equal widths after the 12-point gap. Local card/body/copy/button constraints allow wrapping without horizontal growth; equal heights, aligned buy buttons, intrinsic stacked sizing, minimum touch targets, and independent usage/purchase destinations remain intact. Current-level numbers and buy labels are white in both themes as requested, superseding the earlier dark-label preference.

Authenticated iOS evidence: `docs/design-system/reference/progress/reward-overflow-fixed-live-ios-{top,bottom}.png` shows the actual 110 XP, Level 2, 4 skips, and 1 restore. Native bottom inspection confirms both complete cards fit, descriptions wrap, and white-label buy buttons align. Temporary Debug auto-scroll framed the real account capture, then was removed before final tests; no fixture substitution or artificial account event was used. Additional `reward-overflow-fixed-{ios,android}-*` captures cover light/dark, 360-point content, and enlarged text. Android captures retain previously documented debug-host banner/theme quirks. Both text-size settings and preview appearance were restored.

Checks: 25/25 focused Progress tests, typecheck, scoped lint, formatting, and whitespace checks passed. New cases cover measured row bounds at 316/358/760 points with large inventory counts, narrow and enlarged-text stacking, and white number/button labels in both themes. Scoped lint reports zero errors and five inline-style warnings. This correction changes no Home, tab-bar, shared design defaults, economy, backend, or public interface.

## Progress transparent top-area correction

The earlier safe-area clipping approach produced the stationary strip the user identified. This follow-up supersedes it locally for Progress: a native ScrollView extends through the top safe area, and the top inset moves into scrolling content padding. Initial header spacing and golden tint remain, without a fade overlay or fixed header. Explicit inset handling prevents duplicate automatic padding. Bottom safe-area spacing/tab clearance remain unchanged; Home and shared `DSScreen` defaults retain their existing behavior.

Authenticated iOS evidence is `docs/design-system/reference/progress/transparent-top-live-ios-{initial,partial}.png`. At a 40-point offset, the header is visibly present across the former top-safe-area boundary rather than cut off there. Dark-mode evidence is `transparent-top-ios-dark-partial.png`; initial/bottom iOS and Android captures use the same `transparent-top-*` prefix. System status icons and Dynamic Island naturally remain above app content. Temporary Debug capture positioning was removed before final checks, and preview appearance was restored.

Checks: 26/26 focused tests and app typecheck passed. Regressions cover content-only top insets, horizontal/landscape insets, bottom safe-area spacing, scroll indicators, disabled automatic adjustments, and retained reward/navigation behavior. Scoped lint has zero errors and five inline-style warnings; formatting and whitespace checks passed. No backend, purchase, shared theme, Home, or tab-bar changes are included.

## Home transparent top-area correction

The user explicitly requested the same fix on Home. Its top safe-area margin has moved into ScrollView content padding, and the local clipping style is removed. Automatic native inset adjustments are disabled. Home's original header padding, measured stationary Hoy tint extent and dynamic palette, bottom content clearance, actions, and tab bar are preserved. Shared components and Progress are unchanged.

Authenticated iOS evidence: `docs/design-system/reference/home-transparent-top-live-ios-{initial,partial}.png`. At a 40-point offset, the logo passes through the former safe-area cutoff without a separate covering strip. `home-transparent-top-ios-dark-partial.png` and `home-transparent-top-ios-light-bottom.png` verify dark appearance and bottom clearance. Temporary Debug-only scroll positioning was removed before final checks. System status icons and Dynamic Island remain above app content. Android guest initial captures verify both appearances; existing debug LogBox banners remain outside this change. Preview appearance preferences were restored on close.

New light/dark regressions verify a full-height transparent viewport, content-only top inset, no duplicate automatic adjustment, original header padding, and unchanged tint measurement. Four focused scrolling/tint/stats tests pass. The full Home suite reports 53 passed and one previously documented failure asserting the removed `PERSONAL` label. App typecheck and scoped lint pass, with no lint warnings or errors.

## Your stats implementation and native QA

Approved composition: `/Users/kelvin/.codex/generated_images/01a0efec-cf56-7272-b461-cd1fe6ea30e6/exec-29009a9e-bb04-4fb8-9869-423cb58f61ea.png`. The source was opened in the same comparison input as the current native iOS calendar and selected-day/totals/bests captures. The selected-day block follows the calendar immediately, with monthly totals in their own following surface. The section preserves the existing stats row and reward cards, while reusing native category artwork. Native scalable text and platform touch targets make the calendar taller than the generated source; composition and states, rather than identical image density, govern the adaptation.

Fixed findings:

- [P1] NativeWind interop discarded function-valued Pressable layout styles in the first selected-day render, stacking its contents. Local explicit style arrays and separate press state now preserve horizontal rows, trailing status/chevrons and feedback on both platforms.
- [P2] The first weekday heading row inherited minimum touch height and left excess space before the calendar. Weekday headings now have intrinsic height; day targets remain large enough to tap. Legend markers are compact and weeks use intrinsic sizing around a 56-point minimum.
- [P2] Android's View all activity label could truncate from intrinsic shrink sizing. Its bounded flexible text container now displays the complete label and permits wrapping at enlarged sizes.
- [P2] Dark action labels initially reused the light-only blue. Local theme action colors now retain readable dark-mode labels without changing shared defaults.

Evidence: `docs/design-system/reference/progress/stats-{ios,android}-{light,dark}.png` and their `-details` captures; `stats-ios-360.png`, `stats-android-360{,-details}.png`; `stats-{ios,android}-large{,-details}.png`. Current native inspection confirms weekday alignment, continuity at screen edges, green fill plus blue Today/selection rings, the partial badge, protection shield, selected-day hierarchy and separate monthly totals. At accessibility sizing the connectors are absent, the existing stats cards stack, legend labels wrap and activity copy grows without horizontal overflow. OS font size and Android density were restored after verification. Existing Android debug banner/tab/status-theme quirks remain outside the changed stats content.

Authenticated iOS exercised live month/day reads, September 29 selection, the full day list, successful Tap In details and direct achievements access. Real counts are five September Tap Ins/five active days and five best-streak days/43 lifetime Tap Ins. Screenshots have the `stats-live-ios-*` prefix. Day details preserve the original daily period; notes/photos and pagination/retry are additionally covered by focused UI and backend tests. Native Android visual evidence uses read-only fixtures because that emulator is signed out. No live account data or rewards were changed to manufacture screenshot states.

Data checks cover leap/month lengths, weekday alignment, midnight and timezone/DST boundaries, mixed coverage, edit/removal counts, original restores, provable daily/weekly/monthly misses, historical membership, private-label retention, owner isolation, legacy timestamps/coverage, nanosecond and identifier ties, cursor isolation, pagination, cache cleanup, failures/retries and independent targets. Forty focused UI/cache/navigation tests, nine model tests and five emulator tests pass. Both read callables deployed successfully and are ACTIVE; anonymous live requests returned UNAUTHENTICATED. Existing indexes/rules suffice. Compatibility reads use 500-record pages but scan retained owner history, so large-account read cost remains proportional to history size.

Release checks: the final full-app typecheck passes after the concurrent Profile changes were corrected. Functions build, scoped formatting and whitespace checks pass. Scoped lint reports zero errors and 16 existing-style warnings. This delivery adds only read-only history interfaces and Progress presentation/navigation; it does not activate buying, spending or restoration, and does not claim completion of the previously documented store-release gates.

## Profile revamp, 2026-10-01

Scope: approved Profile, Edit Profile, share preview, Settings/subpages, username transactions, tint persistence, and earned milestone navigation. The visual target is the four user-approved images. See [Profile contract and evidence](docs/design-system/profile.md) and [target/native comparison](docs/design-system/reference/profile/target-comparison.png).

### Iteration and resolutions

| Priority | Finding                                                                                                | Resolution and evidence                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Username availability alone cannot prevent simultaneous claims or partial identity updates.            | Server transaction rechecks ownership, atomically updates the same UID and releases the old claim. Six emulator tests passed, including exactly one simultaneous winner. |
| P1       | Uploading over the existing avatar would change the published photo even when the identity save fails. | Edited avatars use a versioned path; the current file stays unchanged. Upload/draft retention tested.                                                                    |
| P1       | Personal bests wrapped words and clipped when iOS accessibility text increased at 360-point width.     | Metrics stack without flex-height collapse at large font scales. Recaptured and inspected `ios-dark-360-large-bottom.png` and Android 1.6-scale evidence.                |
| P1       | Stacked summary statistics need full-width copy to avoid clipping at large text.                       | Horizontal stacked stat rows use flexible copy and natural height. Verified Android narrow/large capture.                                                                |
| P1       | Account changes during saving or capture could apply old data or open a mismatched export.             | UID guards in editor, timezone, notifications, account actions, and pre-share capture. Focused tests passed, including cancellation/temporary file release.              |
| P2       | Pencil badge must remain light in dark mode.                                                           | White badge and dark pencil are Profile-local; dark iOS and Android were recaptured.                                                                                     |
| P2       | Availability failures need a retry path.                                                               | Editor adds Check username again without clearing drafts.                                                                                                                |

### Captured results

The approved hierarchy, top tints, identity hero, pencil, XP, stat icons, management card, and pale-gold Personal bests are present in native renders. Names/photos in fixtures are illustrative; a separate live account capture verifies production data. Settings displays actual native version/build (iOS 1.0 / 45; Android 1.0 / 1). The share PNG matches the preview and iOS cancellation restores the Share control. Native text scaling and bottom clearance were inspected, including the narrow/large-text repair.

Home source, Home progress/surfaces, Explore, shared design primitives/tokens, and AppTabsNavigator remain byte-identical to this task's baseline. A concurrent Progress source edit removed a pre-existing development auto-scroll condition while this task was running; this task did not overwrite that edit. The checkout contained extensive unrelated changes before work began, all retained.

### Final verification status

Visual QA passed for the captured iOS/Android matrix after the large-text fixes. App typecheck, scoped lint, Functions build, six emulator tests, and 73 focused Jest tests passed. Native builds passed. The three backend additions are ACTIVE in production.

Release verification remains BLOCKED on Android native share-sheet/cancellation and Android photo-picker interaction: the computer-use tool cannot select the Android emulator window. Preview rendering and transport unit tests do not establish that result. No client-store release was uploaded. Remaining device checks are recorded in `docs/design-system/profile.md`.

## October 1 calendar connector correction

Calendar connectors now use separate paths only in the gaps between day markers. Their endpoint height follows the 34-point marker wrapper's actual center (17 points plus the existing column offset), with 19-point horizontal clearance around each marker and its Today/selection ring. Edge continuation follows the first/last marker center; partial weeks have no lines across blank dates. Very narrow gaps are omitted. Future opacity and all marker/status behavior are unchanged, and connectors remain hidden at accessibility text scaling.

Evidence is saved as `docs/design-system/reference/progress/calendar-connectors-*`: authenticated iOS October light, iOS/Android dark and narrow fixtures, and enlarged-text captures. Native inspection confirms no dashes inside future or selected circles, centered connections, retained status artwork and edge continuity. Debug preview banners remain outside this correction. OS text sizes were restored after inspection.

Checks: 37 focused Progress screen tests pass, including geometry at 316/358/760-point calendar widths, full/partial weeks, and insufficient-space omission. App typecheck passes. Scoped lint reports zero errors and four pre-existing inline-style warnings. Formatting and whitespace checks pass. No backend, history, metrics, rewards, Home, navigation or shared-theme behavior changes.

## October 1 white level labels and calendar legend spacing

The XP level pills on Progress and Profile now use white backgrounds in both themes, with the existing light-theme text color `#070B1A` for contrast. The calendar legend's top/bottom margins are both 16 points, increased from 8/4 points. All other geometry, typography, interactions and shared defaults are preserved. Native captures use the `white-level-*` and `calendar-legend-spacing-*` prefixes in the Progress reference folder. Fifty existing Progress/Profile tests, app typecheck, formatting and whitespace checks pass. Scoped lint has zero errors and 17 inline-style/curly warnings.

## Profile button adjustments, 2026-10-01

Removed the main Profile heading, moved Share to a circular top-left control matching Settings, reduced the avatar pencil face to 32 points with a 16-point icon and 48-point touch target, and centered a white Edit profile pill with black text in both themes. Subpage headings, the avatar, tint, summary sections, and tab bar retain their existing behavior. The Profile scaffold supports an optional leading control and heading without changing other screens.

Forty focused Profile tests, typecheck, formatting, and whitespace checks pass. Scoped lint has zero errors and five existing warnings. Native iOS checks confirm the new Share destination, full Edit form, photo-edit route, and accessibility labels. Updated Profile reference captures include `ios-light.png`, `ios-dark.png`, `ios-light-360.png`, `ios-dark-360-accessibility-large.png`, bottom scrolling, guest/incomplete/loading states, and the live account. Simulator text size and preview appearance were restored. Android was not rerun for this follow-up; its previous share/photo interaction gate remains unchanged.
