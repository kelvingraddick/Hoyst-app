# Explore implementation

## Selected design

The original approved light reference is [approved-light.png](reference/explore/approved-light.png). It combines option 1's header, filters and Circles heading, option 2's search, and option 3's circle cards. The September 26 header refinement supersedes its subtitle spacing, search outline and absence of Hoy. Category filter artwork has no backplate. The existing tab bar is unchanged.

The title and subtitle form a group with a 6-point gap, with a circular, icon-only Friends button at the top right. Friends uses the two-person `Users` silhouette at 18 points with a 1.8-point stroke inside the platform minimum target. The title/subtitle group fills the width recovered from the former Create pill. Only `circles` is bold in `Find circles moving at your pace.` The subtitle uses Home's bubble text colors, #070B1A in light and #FFFFFF in dark. Search has no border and uses the bubble's white/#252527 surface, #92723E/black shadow, 0/6 offset, 0.1 opacity, radius 12 and Android elevation 3. Radius, padding and input controls retain their existing values.

An Explore-only transparent Hoy asset holding a magnifying glass appears in a 52-point square to the left of the title and subtitle group, with an 8-point gap. A soft radial oval beneath it retains Home's shadow opacity, with an Explore-only cool blue-gray color in light mode and black in dark mode. It is decorative and always visible. A 1.2-second native animation sways between -3 and +3 degrees only while requests, including pagination, are pending. Debounce time does not animate. Completion, errors, loss of focus and unmount stop/reset motion. Reduce Motion disables animation, including while its native preference is unresolved. Home artwork and shared Hoy components are unchanged.

This screen opts into version 1.2 tokens locally. The title uses the approved guide default 24/29, page gutter 22, section gaps 16, supporting gaps 4, card padding 12, and paired category colors in both appearances. Friends and filters have platform minimum targets. Details actions are compact faces with full targets. The header remains horizontal at larger text sizes, with flexible title/subtitle text and a fixed-size Friends target; text and fact rows wrap. The list remounts when native font scale changes to invalidate cached native text measurements. Search font and line height explicitly follow the native font scale, avoiding stale iOS TextInput metrics and double scaling. A real footer spacer clears the existing tab bar and safe area.

## Interaction and states

### Blue top tint and Hoy artwork selection

September 30, 2026: Explore now has a stationary, non-interactive blue top fade spanning 240 points from the top of the screen. Its gradient runs from `#18B9FF80` in light mode or `#18B9FF38` in dark mode to `#18B9FF00`. It stays blue across category and search changes. The list viewport includes the top safe area, while the content applies `insets.top + 16` so initial header placement is preserved. Automatic content inset adjustments are disabled, and refresh/scroll indicators account for the top inset. Explore's light Hoy shadow now uses cool blue-gray `#284D68` with its existing opacity; the dark shadow stays black.

Three transparent blue curious-searcher artwork variations were generated with the built-in Image Generation tool and temporarily previewed in the actual 52-point Explore header. [Compare the native header previews](reference/explore/blue-hoy-options/index.html). Their numbers match the order the generated images appeared in chat. The user selected option 2, which is now integrated as `src/assets/hoy/explore-searching-blue.png`. Its transparent alpha and image bytes match the selected generation exactly. The original Explore asset is retained, and Home artwork is unchanged. The rounded body, visible eyes, small side-held magnifying glass and gentle smile are the shared art direction. [Exact generation prompts](reference/explore/blue-hoy-options/prompts.md) accompany the options.

Verified on the iPhone 17 Pro Simulator: [light initial](reference/explore/blue-tint-light-initial.png), [dark initial](reference/explore/blue-tint-dark-initial.png), and [dark search with software keyboard](reference/explore/blue-tint-dark-keyboard.png). Search returned the matching Building Hoyst Circle. The app and Simulator appearances were restored to light, and the test query was cleared. Existing Explore/Hoy tests plus the top-inset/theme regressions passed: 2 suites, 13 tests. Typecheck, scoped ESLint and diff checks passed. Jest required a command-line pnpm/nativewind transform override; repository test configuration was not changed.

Final selected-artwork verification: [light](reference/explore/blue-hoy-selected-light.png), [dark](reference/explore/blue-hoy-selected-dark.png), [larger native text](reference/explore/blue-hoy-selected-large.png), and [360-point viewport with larger text](reference/explore/blue-hoy-selected-360-large.png). The larger-text setting was `extra-extra-extra-large`; it was restored to the original `large` setting after capture. The narrow capture temporarily constrained the actual production screen inside the same Simulator, and that constraint was removed. The header and subtitle wrap without clipping, and both eyes and the magnifying glass remain clear at 52 points. The focused 2 suites/13 tests, typecheck, scoped ESLint and diff checks passed after artwork integration. Native scrolling and pull-to-refresh checks remain unverified because automated Simulator gestures did not reliably move the list. Their safe-area and refresh-indicator configuration is covered by the focused screen tests.

Hoy occupies a 52 by 60-point frame beside the complete title/subtitle group, including room for its shadow. The subtitle remains 6 points beneath the title.

- Search is debounced 300 ms, normalized on the server, and matches words or word prefixes across title, category and commitment. All query terms must match. Limits: 120 characters, eight words, 40 characters per word. Substrings inside words do not match.
- Categories remain global while searching. All is the default. Filter pills scroll horizontally. Search and category changes reset the list and discard stale requests.
- Results preserve updated time descending, then document ID descending, with 20 cards per page. Counts are exact across the complete matching query. Pagination failures retain existing results and offer a separate retry. Pull to refresh and screen focus reload results.
- Loading, no public circles, no matching circles, initial error and pagination error have explicit states. Production has no sample fallback.
- The main card target and View details both navigate to CircleDetail with circleId alone. Friends shows a native alert titled `Friends` with `Coming soon` and an OK button. Create now lives in the Tap In selector header and retains CreateCircle. Joining stays in Detail with its existing authentication and membership gates.
- Cards show true member capacity, a positive group streak, or truthful availability when no streak exists. No inferred completion, fixed relative time, fake featured section or synthetic activity is shown.

## Public activity

`submitTapIn` records a server-only eligibility marker in the same transaction as a newly successful done transition. Eligibility requires an active public group and an activation boundary in `serverConfig/publicDiscovery.activityActivatedAt`. Skips, partial/failed outcomes, existing successful records and note/photo edits do not create a new event. A newly completed quantity Tap In can qualify after activation, even when its earlier partial record predates activation.

The projection stores eligible candidates under `circles/{id}/publicTapInCandidates`, denied to every client. The latest valid event is projected to the public index. Client DTOs contain only event ID, actor UID, public profile name/avatar and the actual successful-transition timestamp. UI shows elapsed time from the actual event timestamp, such as `Just now`, `2 hours ago` or `3 days ago`, with an initials fallback. No Tap In notes, photos, past feed, historical backfill or private-circle feed enters Explore.

Triggers use authoritative rereads, transactions and retries. Removal, account deletion, membership departure, privacy changes, archive and deletion withdraw previews and reconcile the next valid candidate. Member join time and a circle privacy/lifecycle epoch prevent departed or previously private history from reappearing after rejoin or restore. Search validates the latest event against current circle, membership, profile and check-in records before returning it, covering trigger lag. Cleanup may briefly omit an event until the next valid candidate is reconciled.

Public setting and public join copy disclose member name, profile avatar and timestamp previews. Posting has no new popup or inline notice. Existing private feed access rules are preserved.

## Search storage and operations

`maintainPublicCircleSearch` maintains normalized prefix tokens for every public-index create/update, covering create, edit, onboarding, conversion and restore. Four composite result indexes support search with or without category. The backfill normalizes legacy active group fields and adds search tokens only; it never creates an activity marker or scans historical check-ins.

Firestore supports one array containment clause, so the server uses the longest query prefix as its indexed candidate query and checks remaining terms before calculating exact counts and slicing a page. It currently reads all matching candidates and the global category projection per request. This meets full-catalog search and exact counts, but read cost grows with catalog size; monitor reads and callable latency before a much larger catalog rollout. Pagination uses an opaque query-bound updated-time/document-ID cursor. It is stable for an unchanged catalog, not a frozen snapshot across concurrent edits; the client deduplicates appended cards.

## Release sequence (not executed)

1. Build functions and deploy the Firestore indexes. Wait until indexes are ready.
2. Deploy discovery callables/triggers, updated submitTapIn, and updated circle management functions. Apply the rules with the candidate deny rule. Existing activation is absent, so no new public event qualifies yet.
3. Build functions, then dry-run the full search backfill: `node scripts/migrate-public-discovery.mjs --project=PROJECT_ID`.
4. Review its result, then apply using `--commit`. Backfill can be rerun safely.
5. Release the app with the updated Public and join disclosures.
6. Activate future event previews only after app rollout: `node scripts/migrate-public-discovery.mjs --project=PROJECT_ID --commit --activate-activity`. Existing activation timestamps are preserved. No historical data is published.
7. Verify guest search, owner details, public join disclosure, a new successful public Tap In, remove/departure cleanup and a private-circle exclusion in the deployed environment.

Rolling back the UI does not remove existing public projections. To pause publication, remove the activation field; to withdraw existing projections, explicitly clear latestPublicTapIn and server candidate data using a reviewed operation. Do not reactivate by moving the original boundary backwards.

## Friends header validation

September 29, 2026: the Friends icon and expanded title/subtitle group were verified in the iPhone 17 Pro Simulator in [light](reference/explore/friends-light.png), [dark](reference/explore/friends-dark.png), and [360-point content width with accessibility-medium text](reference/explore/friends-dark-360-large.png). The narrow capture constrains the production content inside the same Simulator device. Friends opens the native `Friends` / `Coming soon` alert with OK. No Create control remains in Explore.

The subsequent Friends refinement replaces `UsersRound` with a smaller 18-point `Users` silhouette and a lighter 1.8-point stroke. Its [updated light Simulator capture](reference/explore/friends-refined-light.png) supersedes the icon in the earlier captures; the button target and layout are unchanged.
