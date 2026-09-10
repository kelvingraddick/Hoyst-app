# Contribution and validation

The September 9 Tap In composer implementation, screenshots, exact focused test command and remaining native checks are recorded in [Tap In composer](tap-in-composer.md). The historical evidence below remains unchanged.

## Before adopting or changing a component

- Confirm the named production screen is in the current migration wave. Home and the tab bar are excluded.
- Import opt-in components explicitly. Never change legacy token/component defaults to make the migrating screen look right.
- Reuse existing domain logic, category/icon mapping and navigation destinations. Keep direct submission separate from row/detail navigation.
- Prefer an existing semantic role. Document the rationale, dimensions, supported states and screenshots for a new shared variant or expressive exception.
- Update typed tokens, gallery examples and documentation together. Increment the system version according to the decision rules in the README.
- Render both themes, long content, enlarged text and a narrow viewport. Review below the initial viewport, keyboard states and bottom clearance.
- Check 44-point iOS / 48-dp Android targets, labels/order with VoiceOver and TalkBack, non-color status feedback, input errors, pending requests and Reduce Motion.
- Verify disabled controls, independent row/action presses, detail access, zero/partial/complete progress, missing images, retry, back/dismiss and existing account gates.
- Run the checks below, inspect the diff, and attach evidence. Do not regenerate frozen hashes to hide a Home change.

## Reproducible checks

Use Node 22. This workspace currently has a pnpm node_modules layout, so Jest needs the transform exception shown here. No global Jest, Babel or Metro configuration was changed for this delivery.

```sh
export PATH=/Users/kelvin/.nvm/versions/node/v22.23.2/bin:$PATH
npm run typecheck
npx eslint App.tsx src/design/system __tests__/design-system.test.tsx scripts/check-design-system-reference.mjs
npx eslint src/features/circles/screens/CirclesScreen.tsx __tests__/circles-screen.test.tsx
node scripts/check-design-system-reference.mjs
git diff --check

npm test -- --runInBand \
  __tests__/circles-screen.test.tsx \
  __tests__/design-system.test.tsx \
  __tests__/home-hero-copy.test.ts \
  __tests__/tab-bar-background.test.tsx \
  --transformIgnorePatterns 'node_modules/(?!\.pnpm/|react-native/|@react-native/|react-native-svg/|lucide-react-native/|react-native-css-interop/)'

npm test -- --runInBand \
  __tests__/hoy-orb.test.tsx \
  __tests__/home-daily-actions.test.ts \
  __tests__/home-commitment-stack.test.tsx \
  --transformIgnorePatterns 'node_modules/(?!\.pnpm/|react-native/|@react-native/|react-native-svg/|lucide-react-native/|react-native-css-interop/)'

npm test -- --runInBand __tests__/home-screen.test.tsx --forceExit \
  --transformIgnorePatterns 'node_modules/(?!\.pnpm/|react-native/|@react-native/|react-native-svg/|lucide-react-native/|react-native-css-interop/)'
```

HomeScreen's existing tests emit asynchronous `act` warnings and leave work pending. The combined run stalled after reporting that suite passed; the remaining suites passed separately. HomeScreen passed independently with `--forceExit`. This is recorded rather than changing frozen Home behavior or its tests.

Android release JavaScript check, independent of native signing/build:

```sh
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output /tmp/hoyst-design-system-android-release.bundle \
  --assets-dest /tmp/hoyst-design-system-android-assets
```

Verify the release bundle contains no gallery menu/fixture identifiers. This verifies JavaScript packaging only, not an Android release APK or distribution.

## Delivery evidence, September 8, 2026

| Check | Outcome |
| --- | --- |
| Frozen source reference | 81 existing Home/design/tab presentation and related reference files unchanged by SHA-256 comparison |
| Production diff | Only `App.tsx` adds a hidden development host; no production screen, legacy default, route, backend or schema migration |
| New component tests | 17 pass: interaction isolation, pending/disabled controls, completed/pending expansion, bounded progress, form error callbacks, avatar fallback/retry, gallery theme/retry and developer-only entry |
| Existing regressions | 99 pass across HomeScreen, hero copy, Home daily actions, commitment stack, Hoy and tab-bar backgrounds, with the HomeScreen harness caveat above |
| Color contrast | Both-theme semantic small-text pairs >= 4.5:1, category foreground/surface and filled-action pairs >= 4.5:1, input boundaries >= 3:1 |
| Static checks | TypeScript, changed-file ESLint and diff whitespace checks |
| Release JavaScript | Android production bundle generated successfully; gallery menu/fixture identifiers absent |
| iOS Home reference | Current light/dark upper and lower screen captured at 402 points. No daily action or notification was submitted during reference capture |
| iOS native gallery | Light/dark patterns, full lower content, long titles/descriptions, 1.35 text scale, a 360-point constrained native preview, field editing, software keyboard and scroll dismissal inspected |
| iOS local interactions | Tap In becomes Nudge; Nudge completes and collapses focus; pending membership expands without an action; gallery close returns to the underlying app |
| Android native gallery | Light foundations render at 411 dp on Pixel 10 emulator using the existing Debug APK and current Metro JavaScript. Full Android dark, narrow, keyboard and shadow-parity verification remains open |

Native review found and corrected two issues in the new system: functional Pressable styles were lost through the application's styling interop, so controls now use explicit styles with press feedback; avatar images now have explicit dimensions and fill their circular crop. The gallery has its own status-bar style and initial safe-area metrics for its native modal. These fixes did not modify Home.

The initial Android bundle request hit stale Metro resolution for a Lucide file that existed on disk. Restarting this project's Metro with `--reset-cache` resolved it. The standard Jest command initially failed parsing React Native Flow syntax through pnpm paths; the documented command-line transform exception resolved it.

## Screenshots

- [Approved Home reference](reference/README.md)
- [iOS light patterns](reference/gallery/ios-patterns-light.png)
- [iOS dark patterns, enlarged text and long description](reference/gallery/ios-patterns-dark-large.png)
- [iOS 360-point preview with enlarged text](reference/gallery/ios-patterns-360-large.png)
- [iOS dark form, wrapping rows and filled image crop](reference/gallery/ios-controls-dark.png)
- [iOS software keyboard and focused input](reference/gallery/ios-controls-keyboard.png)
- [Android light foundations, 411 dp](reference/gallery/android-foundations-light.png)
- [Approved Circles mock](reference/circles/approved-circles-mock.png)
- [iOS Circles light, 402 points](reference/circles/ios-circles-light.png)
- [iOS Circles dark, 402 points](reference/circles/ios-circles-dark.png)

Screenshots are direct native captures. App warning banners from the existing Debug runtime may appear in evidence; no global warning suppression was introduced.

## Limits and next verification

No physical-device release, native Android rebuild, TestFlight upload, backend deployment, or production action submission was performed. Automated accessibility props and native accessibility-tree inspection do not establish a completed VoiceOver/TalkBack session. Manual assistive-technology traversal, maximum accessibility sizes, localization, Android keyboard/device-specific behavior and all eight Hoy animations require follow-up in the relevant migration wave. This delivery freshly captured the current attention-state Home, not every alternate Home state.

Changing Android emulator density and font scale relaunched the app, and UI automation failed to produce a usable narrow-gallery capture. Density and font scale were restored. This does not establish Android narrow/dark acceptance. The gallery's 360-width option provides a repeatable native layout preview; it is not a substitute for validating another physical phone and its safe areas.

The gallery's fixtures exercise new presentation components; they do not replace route-level auth, notification, timezone, Nudge persistence or scoring regression tests. Each future production migration must follow the full state and flow gates in the migration inventory.

## Circles migration evidence, September 8, 2026

| Check | Outcome |
| --- | --- |
| Focused Circles tests | 22 pass, covering personal/group rendering, status counts and filters, filter clearing, urgency/name/progress controls, loading, initial error/retry, Circle Detail, Tap In/Update Tap In, pending Nudge, native Share, pending/completed cards, past circles, Create, Explore and empty states |
| Shared design-system tests | 17 pass, including independent row/action targets, preview states, avatar fallback, control states and gallery fixtures |
| Static checks | TypeScript, changed-file ESLint and diff whitespace checks pass |
| Frozen Home guard | 81 frozen Home/design/tab files still match their approved SHA-256 manifest |
| iOS Simulator | 402-point light and dark Circles renders inspected, including filter selection, filter clearing, sort sheet dismissal/selection, focused card detail access and direct Tap In separation |

The Simulator account available for this pass contained active group and personal commitments. Pending, completed, Share, failed refresh, no-match, no-commitment, missing-avatar, long-copy and Nudge-request states were covered through focused render and interaction tests rather than production submissions. A native Android build, physical-device pass, enlarged-text pass and live VoiceOver/TalkBack traversal remain open for this migration.
