# Explore QA, September 26, 2026

## Scope and evidence

Approved target: [combined light mock](reference/explore/approved-light.png). Implementation and release sequence: [Explore specification](explore.md).

Production source has no fixture fallback. Populated native captures below used temporary, visibly labeled local fixture data and local appearance overrides. Those source overrides, navigation hooks and warning suppression were removed after inspection. The dark tab bar in light fixture captures is the existing bar under the Simulator's unchanged dark account preference, not a proposed tab redesign.

### Native rendering

| Check | Evidence | Result |
| --- | --- | --- |
| iPhone 17 Pro, iOS 26.5, 402 × 874 light | [light](reference/explore/ios-light-fixtures.png) | Warm canvas, guide title, outlined search, transparent filter artwork, full cards and distinct details action |
| Same device, dark | [dark](reference/explore/ios-dark-fixtures.png) | Paired category surfaces and readable foregrounds |
| Search with software keyboard | [keyboard](reference/explore/ios-light-keyboard-fixtures.png) | One filtered result, no tab obstruction; search and clear action exercised |
| 360-point constrained native width | [360](reference/explore/ios-dark-360-unavailable.png) | Normal search metrics restored after a live accessibility-size change; error text wraps |
| 360-point width, native accessibility-large text | [top](reference/explore/ios-dark-360-large-top-fixtures.png), [bottom](reference/explore/ios-dark-360-large-bottom-fixtures.png) | Header stacks, title/facts wrap, last details action clears tab bar |
| Android Pixel 10 emulator, API 37 | [dark](reference/explore/android-dark-fixtures.png), [light](reference/explore/android-light-fixtures.png) | Native Android fonts, platform targets, category colors and existing tab bar |
| Actual production service binding, undeployed callable | [error](reference/explore/ios-service-unavailable.png) | Explicit unavailable state, no invented results |
| Create navigation | Native accessibility tree | Opens the existing Step 1 of 10 commitment setup; closed without creating data |

A final live text-size change exposed stale TextInput metrics on iOS. Explore now explicitly scales its search font and line height from the native font scale, with automatic input scaling disabled to avoid double scaling. Native controls were checked at accessibility-large and again at the original normal size.

The final-card inspection used native programmatic scrolling after content measurement. CUA scrolling did not reliably drive Simulator gestures; this is layout-clearance evidence, not a completed gesture test. Native accessibility trees were inspected for search, selected filters, result names, event name/time, retry and Create labels. Full VoiceOver/TalkBack traversal and physical-device acceptance remain outstanding. Android interaction checks beyond rendering remain outstanding because its emulator window was not available through the native UI control tool.

Simulator text size was restored to its original `large` setting. The successful Android assembly used Java 17 and `:app:assembleDebug`; APK install was explicitly targeted to emulator-5554. Metro remains available for local development. Production deployment and backfill evidence follows below. No activity activation, distribution build or release upload was performed.

### Automated validation

- `npm run typecheck`: passed.
- `npm run functions:build`: passed; tracked compiled function output refreshed.
- Scoped ESLint over changed source and new tests/scripts: passed with no warnings.
- `git diff --check`: passed.
- Focused Jest: **64 tests, four suites passed**: Explore, discovery rules, Circle Detail and circle mapping/selectors. Covers query debounce, stale responses, pagination failure/retry, result actions without join resume, empty/error states, event time, eligibility, prefix normalization, and projection field allowlist.
- Firestore emulator: **eight tests passed** in a demo project, Java 21. Covers the real submit transaction and details edits, catalog over 50 records and four result pages, search maintenance, historical exclusion, latest fallback, departure/account/privacy/archive cleanup, delayed cleanup after rejoin, candidate read/write denial, guest private-feed denial, member feed access and public-index read access.
- Android Debug assembly: **BUILD SUCCESSFUL**, 520 tasks, nine executed and 511 up to date. Rendered the installed emulator app against the local Metro bundle.

### Frozen reference and existing work

The frozen manifest guard reports the same ten paths before and after this task. Some differences predate this task in committed source, and BrandMark/HoystTapInMark were already dirty. The manifest was not regenerated. Home, AppTabsNavigator, shared artwork/default tokens and Home subscriptions were not edited by this task.

The pre-existing diffs for both Circle Detail/Thread tests, root design-qa.md, Hoy asset metadata, BrandMark, HoystTapInMark and CircleThreadSection are identical to the captured baseline after normalizing Git's hash abbreviation. CircleDetailScreen retains its existing edits and adds only the scoped public join disclosure. The root design-qa.md was preserved; this is the separate Explore ledger.

## Production rollout, September 26, 2026

Project: `hoyst-firebase-app`, region `us-central1`.

- Firestore rules and five composite indexes deployed successfully. All five composite indexes and both candidate `uid` single-field indexes are `READY`.
- Six discovery functions created successfully: searchPublicCircles, maintainPublicCircleSearch, projectPublicTapIn, refreshPublicActivityMembership, refreshPublicActivityCircle and refreshPublicActivityProfile. submitTapIn, updateCircle and archiveCircle updated successfully. Deployment was restricted to those nine functions; cleanup triggers use retries.
- Search backfill reviewed and updated seven public index records. A subsequent dry run reviewed seven and changed zero. Comparison with the pre-backfill snapshot confirmed no changes outside searchVersion, searchTokens, circleMode and lifecycleStatus. All seven records correspond to current active public group circles.
- Anonymous production callable checks passed: seven catalog results; global categories Custom, Deep Work, Fitness and Wellness; category filtering; word prefixes; multiple-word AND matching; and zero matches for an unmatched query.
- Anonymous production Firestore REST checks: public index read returned HTTP 200; candidate and private check-in reads returned HTTP 403.
- The iPhone 17 Pro development build loaded the real seven-circle catalog, with no fixture overrides. [Production dark capture](reference/explore/ios-production-dark.png). Native Wellness filtering returned two results; searching `sleep` returned one; clearing search restored seven. View details opened the live public preview without joining, and its public join disclosure appeared in the native accessibility tree.
- Readback confirmed zero activity projections and an absent activityActivatedAt field. Historical events were not published.

Function deployment log: `/tmp/hoyst-explore-functions-deploy.log`. Rules/index log: `/tmp/hoyst-explore-firestore-deploy.log`. Pre-backfill snapshot: `/tmp/hoyst-explore-public-index-before.json`. Live search response: `/tmp/hoyst-explore-live-search.json`. These local temporary files are evidence, not repository artifacts.

## Remaining release checks

Select the app rollout carrying the updated Public and join disclosures, then activate the future-event boundary. No distribution build was uploaded. The current keychain has a valid Apple Development identity but no valid Apple Distribution identity, so TestFlight signing needs to be resolved if that rollout is selected. Guest search and guest details navigation are verified live. Authenticated owner/membership navigation, a real new public Tap In preview, and real cleanup observation remain outstanding. Measure candidate query reads and latency as the catalog grows. Emulator coverage does not substitute for those real activity observations.

## Header refinement, September 26, 2026

- Implemented the revised title/subtitle grouping, bold `circles`, primary bubble text color, borderless bubble-shadow search and new magnifying-glass Hoy. The new PNG has an alpha channel and is saved in the app assets.
- iPhone 17 Pro, real production catalog: [light](reference/explore/ios-header-refinement-light.png) and [dark](reference/explore/ios-header-refinement-dark.png), 402 × 874. [360-point constrained content](reference/explore/ios-header-refinement-360.png) and [360-point accessibility-large text](reference/explore/ios-header-refinement-360-large.png) show wrapping without header collisions. The constraint was a temporary local content-width override, not a separate device. It was removed after inspection.
- Live native checks: `sleep` returned one result; clear and Wellness filter returned two results; View details opened the selected circle; Create opened Step 1 of 10 and was closed without submitting. Appearance restored to its original Light setting; native text size restored to `large`.
- Nine focused tests in two suites passed. Request tests cover debounce versus active request, failure, navigation away, pagination completion, and existing search/navigation behavior. Animation lifecycle test covers Reduce Motion changes, loop start/stop and unmount cleanup. Native delayed-request animation and physical-device motion were not separately observed.
- Type checking, scoped ESLint with no warnings, and diff whitespace checks passed. Jest used the existing pnpm transform override at the command line. No shared/Home/backend changes or activity activation were made for this refinement.
