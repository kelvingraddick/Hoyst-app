# Explore implementation

## Selected design

The original approved light reference is [approved-light.png](reference/explore/approved-light.png). It combines option 1's header, filters and Circles heading, option 2's search, and option 3's circle cards. The September 26 header refinement supersedes its subtitle spacing, search outline and absence of Hoy. Category filter artwork has no backplate. The existing tab bar is unchanged.

The title and subtitle form a group with a 6-point gap, with Create aligned at the top right at standard text sizes. Only `circles` is bold in `Find circles moving at your pace.` The subtitle uses Home's bubble text colors, #070B1A in light and #FFFFFF in dark. Search has no border and uses the bubble's white/#252527 surface, #92723E/black shadow, 0/6 offset, 0.1 opacity, radius 12 and Android elevation 3. Radius, padding and input controls retain their existing values.

An Explore-only transparent Hoy asset holding a magnifying glass appears in a 52-point square to the left of the title and subtitle group, with an 8-point gap. A soft radial oval beneath it matches Home's Hoy shadow colors and opacity in each appearance. It is decorative and always visible. A 1.2-second native animation sways between -3 and +3 degrees only while requests, including pagination, are pending. Debounce time does not animate. Completion, errors, loss of focus and unmount stop/reset motion. Reduce Motion disables animation, including while its native preference is unresolved. Home artwork and shared Hoy components are unchanged.

This screen opts into version 1.2 tokens locally. The title uses the approved guide default 24/29, page gutter 22, section gaps 16, supporting gaps 4, card padding 12, and paired category colors in both appearances. Create and filters have platform minimum targets. Details actions are compact faces with full targets. Header actions stack at larger text sizes; text and fact rows wrap. The list remounts when native font scale changes to invalidate cached native text measurements. Search font and line height explicitly follow the native font scale, avoiding stale iOS TextInput metrics and double scaling. A real footer spacer clears the existing tab bar and safe area.

## Interaction and states

Hoy occupies a 52 by 60-point frame beside the complete title/subtitle group, including room for its shadow. The subtitle remains 6 points beneath the title.

- Search is debounced 300 ms, normalized on the server, and matches words or word prefixes across title, category and commitment. All query terms must match. Limits: 120 characters, eight words, 40 characters per word. Substrings inside words do not match.
- Categories remain global while searching. All is the default. Filter pills scroll horizontally. Search and category changes reset the list and discard stale requests.
- Results preserve updated time descending, then document ID descending, with 20 cards per page. Counts are exact across the complete matching query. Pagination failures retain existing results and offer a separate retry. Pull to refresh and screen focus reload results.
- Loading, no public circles, no matching circles, initial error and pagination error have explicit states. Production has no sample fallback.
- The main card target and View details both navigate to CircleDetail with circleId alone. Create retains CreateCircle. Joining stays in Detail with its existing authentication and membership gates.
- Cards show true member capacity, a positive group streak, or truthful availability when no streak exists. No inferred completion, fixed relative time, fake featured section or synthetic activity is shown.

## Public activity

`submitTapIn` records a server-only eligibility marker in the same transaction as a newly successful done transition. Eligibility requires an active public group and an activation boundary in `serverConfig/publicDiscovery.activityActivatedAt`. Skips, partial/failed outcomes, existing successful records and note/photo edits do not create a new event. A newly completed quantity Tap In can qualify after activation, even when its earlier partial record predates activation.

The projection stores eligible candidates under `circles/{id}/publicTapInCandidates`, denied to every client. The latest valid event is projected to the public index. Client DTOs contain only event ID, actor UID, public profile name/avatar and the actual successful-transition timestamp. UI uses an absolute local date/time, with an initials fallback. No Tap In notes, photos, past feed, historical backfill or private-circle feed enters Explore.

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
