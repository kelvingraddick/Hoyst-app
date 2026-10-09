# Onboarding revamp

The latest approved onboarding mockups are the visual target. Native configuration and completion screens are shared by onboarding, normal creation, and invite journeys.

## Behavior

- Interests follow Get started; up to three current categories can be selected.
- Suggestions combine curated commitments with currently eligible public Circles. Custom text is retained when selecting a starter, and recommendations are debounced by 300 ms.
- Name and commitment text are separate. Pace precedes type and goal. New weekly/monthly counts are 4/16; existing configurations keep their values.
- Build supports confirmation or numeric tracking. Explicit quantity goals of one remain numeric on client and server. Inactive goal and pace choices remain in the local draft.
- Shared defaults are Public, Open seats, capacity 10. Personal commitments omit shared controls and have independent names. `independentTitle` protects a named personal commitment from older clients automatically coupling its title to its commitment.
- Account and combined profile setup follow review. Signup/profile submission is owned by the shared wizard; authentication alone cannot create a Circle or finish setup.
- Only Enable reminders requests OS permission. First Tap In uses fresh membership and opportunity eligibility. Pending approval and upcoming windows have separate completion states.

## Compatibility and data

`buildTrackingMode` is optional. Legacy commitments without it retain the original target-one behavior. Existing persisted onboarding drafts seed the new journey without resetting numerical settings. No bulk Firestore rewrite is required.

Normal creation accepts an optional request ID, stores its result in user-private data, and rejects changed payloads under a submitted ID. Onboarding reuses its existing setup ID transaction. Failed/uncertain submissions retain their submitted draft for retry.

Username availability now permits authenticated users before profile completion. Explicit null avatar values respect a no-photo choice. Public suggestions use live Circle authority checks and omit notes, photos, and member rosters.

## Verification

Targeted Jest suites, type checks, Functions build, disposable Firestore emulator tests, iOS Simulator, and Android emulator checks accompany this change. Native visual captures are under `qa/`. The iOS fresh build needs explicit iOS-first React Native namespace header roots for the existing static-framework CocoaPods configuration; those roots were supplied to the validation build. Android Debug builds with the existing configuration.

Two Home test expectations fail in both the exact pre-task source and the current source: the actorless activity meaning icon expectation and the old PERSONAL label expectation. Their behavior belongs to pre-existing design changes, not this revamp.

## Delivery results

- App typecheck and Functions TypeScript build passed.
- Focused Jest checks passed: 201 tests across 13 suites, including process interruption, legacy migration and authentication cancellation.
- Firestore emulator checks passed: 21 tests covering appearance compatibility, onboarding services and the existing public-discovery suite, with no production writes. The discovery suite runs separately under its required `demo-hoyst-explore` namespace; the onboarding/appearance suites use `demo-hoyst-onboarding`.
- Targeted lint has zero errors. Existing-style inline/curly warnings remain.
- iOS signed Simulator Debug and Android Debug builds succeeded. The Simulator was restored to the real app and the temporary QA entrypoints were removed.
- Nine affected Functions deployed to `hoyst-firebase-app`: `createCircle`, `updateCircle`, `completeProfile`, `checkProfileUsername`, `suggestPublicCircles`, `submitTapIn`, `maintainPublicCircleSearch`, `resolveCircleInvite`, and `convertPersonalCircle`. Existing indexes suffice; no index/rule/hosting deployment was needed.
- An unauthenticated production suggestion request succeeded, returned two eligible results within the three-result bound, and exposed no notes, photos, owner IDs or member rosters. Sampled suggestion logs contain successful callable verification and no error-severity entries.
- No app-store/TestFlight distribution, commit or push was made.

Visual evidence and exact limitations are in [QA report](qa-report.md). Before wider release, finish physical provider/SMS/photo/push verification, Android gesture/keyboard/back verification, and small-screen/enlarged-text checks. Monitor save/join failures from the internal build; the production smoke check covers guest discovery only.

All initially present files remain. Sixty-eight initially modified/untracked files are byte-identical to the pre-task snapshot. Existing edits in the shared files changed by this revamp are retained.
