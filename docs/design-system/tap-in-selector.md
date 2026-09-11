# Tap In selector

Implemented September 11, 2026 from the three approved light-mode mockups, followed by the requested goal-line adjustment.

## Local presentation

The existing `TapInPicker` native slide-up modal keeps its route, subscription, sorting and eligibility. A screen-local `DesignSystemProvider` follows the existing appearance preference. The selector uses the 52-point `HoystTapInMark` unchanged, including its shadow and Reduce Motion behavior. Its animation pauses when the route loses focus.

The neutral canvas has 22-point gutters and 16-point section gaps. The first due commitment uses a soft category surface with Home's 18-point card inset and radius. Other due commitments use neutral divided rows. Titles are 16/21, descriptions 14/20, metadata 11/15. Category precedes the muted commitment type. Actions wrap beneath the content on narrow devices or at enlarged text sizes. Nudge, Share and View stay in the expanded utility list, never inside a disclosure or overflow menu. Long lists scroll with the native modal body.

Quantity commitments group their description and goal with a 4-point gap. The second line is muted 12/16 text, using `Goal: 20 minutes`, `Maximum: 2 hours` or `Allowed range: 2 to 6 servings`. Simple Build and Avoid commitments omit this line. Custom multiword units retain their existing spelling. `getCommitmentGoalLabel` supplies the same text to the selector and Home's focused card. Home's collapsed rows and all other Home styling remain unchanged.

Saved progress and Limit compliance are separate from the configured goal. Unknown saved quantities do not imply zero or claim compliance. Higher Limit values receive no positive progress styling. Existing update, skip, share and navigation behavior is preserved. Nudge requests retain their existing handler and have an immediate per-Circle duplicate-request lock.

## Native evidence

iPhone 17 Pro, iOS 26.5. Screenshots are 1206 × 2622 pixels at 3x, representing a 402 × 874-point device. The native modal owns its upper inset and rounded corners. The 360-point capture constrains the content inside that same device; it is not another physical device.

| State                               | Evidence                                                    |
| ----------------------------------- | ----------------------------------------------------------- |
| Several due, light                  | [Screenshot](reference/tap-in-selector/several-light.png)   |
| Mixed Build and Limit, light        | [Screenshot](reference/tap-in-selector/mixed-light.png)     |
| All covered, light                  | [Screenshot](reference/tap-in-selector/covered-light.png)   |
| Long title, dark, 360-point content | [Screenshot](reference/tap-in-selector/long-dark-360.png)   |
| Home's focused quantity commitment  | [Screenshot](reference/tap-in-selector/home-goal-light.png) |

Open **Tap In selector previews** from the React Native developer menu after dismissing other app modals. These local fixtures render the production presentation with local callbacks. They do not submit Tap Ins, send nudges, or share invitations. Theme and width overrides stay inside the fixtures. As with composer previews, the unchanged floating mark and category artwork still read the app's real appearance preference. The dark fixture above therefore does not validate the dark mark asset, because the app preference remained light.

## Validation

- 39 tests pass across the selector, Home commitment stack and goal-label suites, covering simple/quantity display, maximum/range text, unknown values, pending memberships, skips, loading/error/empty/covered states, composer navigation, Share/View/close handlers, and pending Nudge deduplication, failure retry and sent state.
- The default Jest invocation fails before executing tests on the existing pnpm layout (`@react-native/js-polyfills/error-guard.js` Flow syntax). The successful run uses the command-only transform override below. No dependency or test configuration changes were made.
- TypeScript passes. Changed-file ESLint passes with no errors; existing no-shadow warnings in the picker tests and inline-style warnings in the developer host remain. Prettier and diff checks pass.
- Native light selector, all three fixture layouts, dark/narrow long-title layout and Home's focused goal line were inspected. This is Simulator evidence, not physical-device or Android evidence.
- Still to verify manually: larger Dynamic Type, VoiceOver/TalkBack traversal, Reduce Motion rendering, Android rendering, and touch scrolling through longer lists. Automated Simulator scroll attempts did not move the fixture, so touch-scroll behavior is not recorded as passed.
- The frozen-reference script still reports its six pre-existing differences plus the explicitly approved `HomeCommitmentStack.tsx` change. The six previously dirty files were compared by SHA-256 and remained unchanged. The frozen manifest was not regenerated.

```sh
PATH=/Users/kelvin/.nvm/versions/node/v22.23.2/bin:$PATH npm test -- \
  --runInBand \
  --transformIgnorePatterns='node_modules/(?!\.pnpm/|react-native|@react-native|@react-navigation|@react-native-community|react-native-svg)/' \
  --runTestsByPath \
  __tests__/tap-in-picker-screen.test.tsx \
  __tests__/home-commitment-stack.test.tsx \
  __tests__/commitment-goal-label.test.ts
```
