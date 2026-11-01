# Basic iPhone Duo compatibility

The [October 31 Home spacing and side-navigation pass](side-navigation.md) adds the subsequently requested bottom-aligned rail while preserving outer-display content width.

Date: October 30, 2026.

## Implementation

- Retains Hoyst's existing screens and bottom navigation. Navigation consumes each live safe-area edge once, including asymmetric side bars.
- Home content, member grids, Profile statistics and Progress layouts use available content space. Narrow member grids drop the overflow peek or use one column so actions remain usable.
- Shared screen backgrounds extend behind safe areas while their controls remain inset.
- Tap In picker/composer use the current scene frame and live insets instead of launch-time metrics. Composer keyboard clearance comes from a native `UIKeyboardLayoutGuide` in the sheet's own coordinates, including offset Split View windows.
- Story previews measure their container and retain the selected template after resizing. PNG exports retain their existing 1080 x 1920 dimensions.
- CocoaPods targets below Hoyst's existing minimum are raised to iOS 15.1, which resolves Xcode 27.1's deployment-target errors. No pod versions were upgraded.
- React Native's root is created directly in the connected scene instead of first creating its legacy screen-sized window. Scene activation and geometry changes forward React Native's window-size notification, with callbacks for both iOS 26+ and older supported releases.

The iPhone target, ordinary-iPhone portrait declaration, iOS 15.1 minimum, scene-based lifecycle and launch storyboard are retained. There are no backend or stored-data changes.

## Automated validation

Focused checks cover scene resizing, inset changes without size changes, narrow overflow grids, native keyboard inset events, expanded sheet detents, story selection and animation, and retention of typed quantity/selected proof without resubscribing or uploading.

- TypeScript passes.
- Scoped ESLint has no errors; existing inline-style and curly-brace warnings remain.
- Tap In controller: 33 tests passed.
- Duo/layout, composer presentation, member grid and story screen: 43 tests passed.
- Creation/editing, picker, Progress, Circle cards and story export: 196 tests passed.
- Circle Detail, Inbox, Profile and setup frame: 119 tests passed.
- Home: 55 of 57 tests passed, including its new live-inset regression. Its two failures concern the actorless reminder icon and the expected PERSONAL label. Both also fail when the original Home screen source from HEAD is used. They are unrelated to this compatibility change.

## Native validation

Native verification uses Xcode 27.1, the iOS 27.1 SDK and an isolated simulator named Hoyst Duo QA. The final signed Debug build passed, including compilation and registration of the native keyboard helper and the scene initialization repair.

| Scenario | Result / evidence |
| --- | --- |
| Cold launch after scene repair | [Expanded](evidence/cold-launch-open.png), [closed](evidence/cold-launch-closed.png); both reach Home. Debug-only library warning banners remain visible in these captures. |
| Onboarding closed and expanded | [Closed](evidence/onboarding-closed-dark.png), [expanded](evidence/onboarding-open-dark.png); text and footer actions remain available. |
| Home in both inner-display orientations | [Landscape](evidence/home-open-dark.png), [portrait](evidence/home-open-portrait-dark.png). |
| Narrow content container | [360-point native fixture](evidence/home-narrow-fixture-light.png); the header, week path and tabs fit the offered width. |
| Ordinary iPhone portrait | [iPhone 18 Pro, iOS 27.0](evidence/ordinary-iphone-portrait.png); Home renders with the existing portrait structure. |
| Keyboard and repeated folding | [Expanded portrait](evidence/composer-keyboard-open-portrait.png), [closed](evidence/composer-keyboard-closed.png), [expanded landscape](evidence/composer-keyboard-open-landscape.png); typed draft 37 is retained and the action stays above the keyboard. |
| Photo retention and light appearance | [Expanded](evidence/composer-photo-open-light.png), [closed](evidence/composer-photo-closed-light.png); the local photo remains attached. |
| Accessibility text size | [Repaired composer at text scale 2.14](evidence/composer-open-large-text.png); labels render at their full measured height and the footer stays available while body content scrolls. [Before repair](evidence/composer-large-text-before-fix.png) shows the stale static text metrics. The editable input remains mounted. |

Composer/photo inspection used local fixtures and did not submit a Tap In or upload proof. Development-only fixture links `hoyst://tap-in-composer-preview` and `hoyst://tap-in-picker-preview` expose the existing fixture menus; append `/close` to dismiss. Release builds do not load their host.

The final native pass restored system text size to large, closed the local fixture and disabled Device Hub keyboard forwarding. Other apps' simulators and existing data were preserved. No distribution or production deployment was performed.

Actual OS Split View remains unverified: Device Hub's resize mode was disabled for the Duo simulator and no native Split View action was exposed. Narrow containers, scene resizing, and asymmetric insets are covered by the native fixtures and regression tests above. Authenticated end-to-end completion, camera permission flows and every authenticated screen were not exercised on this fresh simulator; their relevant controller/screen tests passed.

## References

- [Apple: Three steps to make your app shine on iPhone Duo](https://developer.apple.com/iphone-duo/prepare/)
- Apple's bundled app-resizability checklist in Xcode, including independent verification of the compatibility changes.

Physical-device verification, TestFlight distribution, App Store assets and release submission are outside this pass.
