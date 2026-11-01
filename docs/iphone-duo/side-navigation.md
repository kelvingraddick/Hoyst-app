# Duo Home spacing and side navigation

Verified October 31, 2026 with Xcode 27.1, the iOS 27.1 SDK, Hoyst Duo QA, and Hoyst iPhone QA.

## Result

- Home starts at `max(top safe inset + 4, 16)` points. Its stationary tint follows both header measurement and live inset changes.
- A scene-local native view reports `verticalBarEdge`, layout direction, bounds, safe areas, and status-area geometry. Trait, layout, safe-area and foreground updates refresh the measurement. No device-name or orientation branches select navigation.
- The Hoyst rail follows the physical edge resolved from the system's leading/trailing preference. It is bottom-aligned in the camera-side strip. Existing content width is preserved, including the outer display. It does not reserve another content column.
- Home, Explore, Progress and Profile retain visible labels. Tap In uses the existing 56-point mark and accessible name without visible text. Tab press, long press, selection and the existing Tap In authentication/modal handler are retained.
- The rail has a bounded, measured viewport. Large text can wrap and scroll; an accessible arrow reveals the remaining destinations and returns to the first destinations. The rail stays bottom-aligned as its content height changes.
- One tab navigator stays mounted while presentation changes. Main-tab bottom clearance is removed in rail mode. The existing bottom capsule returns when the vertical edge is unspecified, including the tested inner portrait configuration and ordinary iPhone.
- Both navigation presentations use the existing native `keyboardLayoutGuide` helper on iOS. This avoids stale screen-coordinate keyboard visibility after folding. Android retains its existing keyboard behavior.

The simulator returns an empty vertical status-area frame. In that case the rail leaves the upper third of the scene free and uses the lower region for navigation, rather than estimating camera dimensions or narrowing the content. A useful status frame takes precedence when available. This fallback still needs physical-device verification.

## Automated validation

- 121 tests passed across navigation geometry/presentation, existing Duo layouts, tab background, Explore, Profile, Progress, and Tap In composer presentation.
- Full Home suite: 56 passed, 2 failed. The same previously identified assertions still fail: actorless activity expects `Clock3`; personal commitments expect the text `PERSONAL`. Neither expectation is changed by this work.
- Home geometry selection: all 4 tests passed, including a top-inset update without a new header measurement.
- TypeScript passed. Scoped lint has no errors and five existing Progress warnings. `git diff --check` passed.
- Signed Debug simulator build passed. The native bridge compiles with the existing iOS 15.1 minimum and guards the iOS 27.1 APIs.

Regression cases cover logical/physical edges and RTL, native numeric direction values, asymmetric insets, inset-only and container-size changes, status-area exclusion, unchanged content insets, local keyboard overlap, the tab-bar render callback, retained input state through presentation changes, event prevention for Tap In, and overflow navigation controls.

## Simulator evidence

Screenshots are local QA artifacts and are not versioned with the app. This workstation's copies are archived outside the repository at `/Users/kelvin/Documents/Codex/Hoyst-artifacts/2026-10-31-workspace-cleanup/docs/iphone-duo/evidence/side-navigation/`.

Recorded checks:

- Outer Home in dark and light appearance, with the bottom-aligned rail and original content width.
- Accessibility Large, with remaining destinations exposed by the scroll action and Profile subsequently opened.
- Inner landscape Home and inner portrait Home with bottom navigation restored.
- Explore query `water` and the selected tab retained across open/closed transitions.
- Ordinary iPhone portrait with existing Home spacing and the bottom capsule retained.

Native checks also exercised all main destinations, Settings and appearance selection, and guest Tap In opening the existing welcome flow, followed by Browse for now. No sign-in, Tap In submission, or upload was performed. Dark appearance and normal text size were restored on Hoyst Duo QA, which is left on Home.

Some Debug screenshots contain the existing React Native warning toast. It is development UI and is not part of the rail. Large-text labels may wrap across lines within the narrow rail; their text is not reduced to fit.

Physical Duo, actual OS Split View, authenticated drafts/photos, and a software-keyboard-visible transition were not manually reverified in this pass. Search entry used the simulator's hardware-input path; keyboard visibility and state retention have focused regression coverage. The earlier [basic compatibility report](compatibility.md) records the original composer/photo QA separately.

## References and distribution

- [Apple Duo preparation guidance](https://developer.apple.com/iphone-duo/prepare/)
- [UIKit vertical bar edge](https://developer.apple.com/documentation/uikit/uitraitcollection/verticalbaredge)

These changes are local and uncommitted. No dependency upgrade, backend/schema change, version bump, TestFlight upload, or release submission was performed.
