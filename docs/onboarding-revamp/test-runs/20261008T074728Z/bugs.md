# Findings to fix later

No fixes were made during this test run.

## BUG-01: Deleted account retains a private momentum projection (P2, confirmed live)

- Environment: live hoyst-firebase-app; QA-only fixtures; 2026-10-08.
- Reproduce: create an account through Firebase Auth; complete onboarding with a shared numeric goal of 1 and capacity 2; submit quantity 0, then quantity 1; call the existing deleteAccount service; check the deleted UID's private subtree.
- Expected: Auth, profile, handle, owned Circles, public index entries and all private user documents are gone.
- Actual: those resources were removed except userPrivate/{uid}/momentum/current, which remained beneath a missing private root. It contained momentum/streak/opportunity projection fields.
- Evidence: `residual-momentum.json`, `private-cleanup-verification.json`, `cleanup-verification.json`, and `onboarding-service-results.json`.
- Cleanup: a second call to the existing deletion service removed the residual document. A read more than two minutes later confirmed no remaining private collections. See `cleanup-retry.json` and `cleanup-verification-after-retry.json`.
- Investigation: asynchronous projection recreation is a hypothesis, not a confirmed root cause. Check deletion versus Tap In/momentum background processing before choosing a fix.

## OBS-01: Raw Firebase authentication errors appear in email and SMS copy (P3 polish)

Malformed email submission displays `[auth/invalid-email] The email address is badly formatted.` Validation functions correctly. Consider presenting the readable explanation without the SDK prefix. Native accessibility output verified the copy; no screenshot with credentials was added.

## OBS-02: Plural preset copy with target 1 (P3 polish)

Amount 1 with the pages preset displays `At least 1 pages`. The existing commitment editor also displayed `At least 1 minutes` after initializing amount tracking. Numeric tracking is correct. Consider singular display wording for known presets while preserving arbitrary manual units.

## Coverage limits

The locked-Mac interruption was resolved. Profile upload, personal completion, first Tap In, restart/cleanup, and regular shared Limit creation were subsequently exercised. Apple/phone, native joining and the expanded device matrix are still incomplete. Google was explicitly excluded.

## BUG-02: Enlarged text clips onboarding headings and badges (P2, confirmed native)

- Environment: dedicated iPhone 16e QA Simulator, iOS 26.5, app Light mode, iOS preferred text size Accessibility Large.
- Reproduce: resume Suggestions and set the simulator content size to accessibility-large.
- Expected: the heading, section headings and card badges wrap or grow to remain fully readable.
- Actual: only the top portion of “What will you show up for?” is visible. “Try one of these” and the selected public card's “Join a Circle” badge are also clipped after the enlarged layout updates. The bottom action remains visible.
- Evidence: evidence/suggestions-accessibility-large-clipped-heading.png and evidence/suggestions-accessibility-large-labels.png.
- No source fix applied. Scroll-tool attempts did not establish touch-scrolling behavior, so this finding does not claim scrolling is broken.

## OBS-03: Cancelling Apple prerequisite exposes raw native error (P3 polish)

On the QA Simulator without an Apple Account, Sign in → Continue with Apple displays iOS's requirement to sign in in Settings. Choose Close. Hoyst remains on Sign in with “The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)”. Provider cancellation remains recoverable, but the raw error is unnecessary user copy. No credentials were submitted and this is not an Apple success-path pass.

## OBS-04: Pending member receives owner-style Hoy wording (P3 polish)

After the disposable invite member requests approval and returns Home, Hoy says “Approve QA 074728 Shared limit, it is pending approval. Let's get this done!” The account is the requesting member, not the owner. Circle detail correctly remains pending and disables Tap In. The message should describe waiting rather than ask the member to approve their request. Native accessibility output confirmed the wording; no Home changes were made.

## BUG-03: Suggestions hides the focused custom field behind the keyboard footer (P2, native)

- Environment: iPhone 16e QA Simulator, Light mode, normal text size, iOS 26.5.
- Reproduce: resume Suggestions with custom text, focus Your commitment and open the software keyboard using Simulator I/O → Keyboard → Toggle Software Keyboard.
- Expected: the focused field and its edited text remain visible above the footer/keyboard.
- Actual: Make it mine correctly sits above the keyboard, but the custom field beneath the section heading is mostly obscured by that footer. The field remains in the accessibility tree with its entered value.
- Evidence: evidence/suggestions-keyboard-field-obscured.png.
- Scope: automatic focus/keyboard layout; scroll-tool attempts were inconclusive. No fix applied.

## BUG-04: Active member is sent to Full Circle recovery on repeated invite (P2, native)

- Reproduce: signed-in complete-profile account accepts the last seat of a two-person QA Circle. Completion says “You’re in” and correctly describes the future Tap In window. Go to Home, then open the same invite again.
- Expected: recognize existing active membership and offer the Circle destination without a full-seat rejection.
- Actual: “This Circle just filled up” with Find another Circle and Create my own.
- Evidence: evidence/active-member-invite-shows-full.png and native-active-membership-evidence.json. The latter confirms primary QA UID is an active member.
- No fix applied.

## BUG-05: Unavailable invitation causes maximum-update-depth render failure (P1, native)

- Reproduce in this run: exercise full and active invites, save the repeated full-state invite for later, return Home, then open hoyst://join/0000000000740728 (a valid-format nonexistent invitation).
- Expected: the unavailable-invite recovery screen with navigable exit actions.
- Actual: React Native reports “Maximum update depth exceeded”, followed by a blank screen. Call stack includes setup-journey-store.ts update, CommitmentWizardScreen patch and its effect around line 279.
- Evidence: evidence/unavailable-invite-render-error.png. The inspected unavailable branch calls patch({step: 'unavailable'}); this is an investigation pointer, not a completed root-cause proof.
- No fix applied. A normal cold restart reproduced the same failure. Captured unavailable-invite-persisted-state.json, then cleared only the dedicated QA simulator pending-invite storage key to recover Home for cleanup. Unfinished journey records were retained. This test-data reset is not a product fix.

### BUG-01 second reproduction through native Delete account

After user-confirmed deletion of @qa074728native, the app reported success and Auth/profile/Circles/avatar were absent, but the momentum/current projection remained. Captured primary-deletion-service-verification.json and native-primary-residual-momentum.json. Explicitly removed the orphan as authorized QA-data cleanup, then verified all private collections absent. The account-deletion code remains unfixed.

## BUG-06: Apple profile-only handoff returns Home before Reminders (P2, native)

- Environment: QA iPhone 17 Pro; a fresh Apple-authenticated Hoyst account; iOS notifications already allowed from the phone test.
- Reproduce in this run: phone profile-only setup → save a separate phone creation draft → sign out → Sign in with Apple using the user-approved Japan tester → complete the new Apple profile with Save and continue.
- Expected: stay in the wizard for the remaining Reminders choice, or finish and remove the matching setup record if this choice is intentionally skipped.
- Actual: the app returns Home without a Reminders choice and displays Finish setup. Its Apple-owned onboarding record is saved at reminders, completed false, result null.
- Evidence: apple-profile-finish-store.json and evidence/apple-profile-premature-home.png. Phone's separate create:{phoneUid} draft remains intact and is not exposed by the Apple account's banner.
- No fix applied. Root-cause investigation should inspect profile/auth modal dismissal versus the remaining wizard step; the exact cause is not established.

BUG-06 recovery: Finish setup reopened Reminders, Not now completed the Apple profile-only journey, and its record disappeared while the phone account’s separate creation draft/requestId remained. The dismissal defect remains unfixed.

OBS-01 additional SMS evidence: an incorrect six-digit code was rejected with `[auth/invalid-verification-code]` and a technical multifactor-credential message. Retry controls were restored. The SDK wording remains unpolished; no fix applied.


## BUG-07: Approved future-window member is presented as needing an immediate Tap In (P2, native/service)

- Reproduce: create a private Daily approval Circle; a new member requests to join; the owner approves through Circle detail → pending member → Review → Approve.
- Expected: approval feedback and member status respect the next_opening eligibility until the first Tap In window opens.
- Actual: success alert says “They can Tap In with the Circle now.” Circle detail labels the member Needs Tap In and offers Nudge and Nudge all. Server membership has opportunityEligibility next_opening; an immediate submitTapIn is correctly rejected with FAILED_PRECONDITION and “No Opportunity is open for this Commitment yet.”
- Evidence: native-review-approve-result.json, native-approved-first-tapin-result.json and evidence/native-approved-ineligible-member.png. Alert copy was observed in the native accessibility tree. No nudge was sent.
- No fix applied. The discrepancy is in client presentation; server eligibility protection passed.
