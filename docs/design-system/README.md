# Hoyst design system

Version **1.2.0**, established September 8, 2026. Approved Home source revision: `00d4726793147f6f933886a696ad4530735daa58`.

**Home is the frozen reference, not a migration target.** Do not refactor Home into this system or change its transitive shared styles, theme defaults, artwork, or tab bar. Other screens adopt this opt-in system independently. Retain legacy components for Home as long as it needs them.

## Start here

| Artifact | Purpose |
| --- | --- |
| [Foundations](foundations.md) | Typography, spacing, theme roles, surfaces, accessibility, motion |
| [Component guide](components.md) | APIs, anatomy, states, reusable recipes and migration example |
| [Home reference](reference/README.md) | Current screenshots, observed values, approved refinements and specialist patterns |
| [App migration inventory](migration.md) | Every route and known modal, ordered delivery stages, behavior gates |
| [Contribution and validation](validation.md) | Acceptance checklist, exact checks, current evidence and remaining device work |
| [Typed implementation](../../src/design/system/index.ts) | Opt-in public barrel, tokens and primitives |
| [Native gallery](../../src/design/system/DesignSystemGallery.tsx) | Live examples with local fixtures and theme controls |
| [Tap In composer](tap-in-composer.md) | Scoped category fade, glowing action, quantity controls and native validation |

## Open the gallery

Run a Debug build with Metro running. Open the React Native developer menu, then choose **Hoyst Design System**. On iOS Simulator use **Command+D** or **Device > Shake**. On the Android emulator, `adb -s emulator-5554 shell input keyevent 82` opens the developer menu. Select Foundations, Controls, Patterns, or States. Use Show dark/Show light, Long content and 360 width to vary the examples. The width option constrains the native content to 360 points/dp; it simulates a narrow layout without pretending to be a different physical device. Set text size through the OS to check real native scaling.

The gallery is a full-screen developer modal, not an application route. Close it to return to the exact underlying screen. It does not write appearance preferences, authenticate, fetch account data, send notifications, or submit actions. Buttons resolve local fixtures. The existing app can continue its normal background subscriptions underneath the modal.

The gallery integration remains a development-only host in `App.tsx`; release builds do not load that host. Circles is the first production screen to adopt the opt-in system. Home and all other unmigrated screens retain their existing presentation.

## Source-of-truth rules

1. The user-approved current Home rendering governs this initial reference. Older generated mockups and Home QA documents are historical context, not competing specifications.
2. The new typed tokens govern future opt-in screens. Docs explain their intended use; gallery examples exercise those same tokens, not independently copied values.
3. Home-specific deviations are recorded explicitly. For example, its current focused card has 18-point horizontal padding, while the reusable card default is 12. Its actual statistics use 18/22 despite the older unused `homeTypography.statistic` being 20/24. Do not edit Home to reconcile these differences.
4. Existing category names, icons, assets, eligibility, navigation and submission logic remain authoritative. Presentation components accept data and callbacks; they do not reimplement these rules.
5. Changes to this system are explicit and versioned. Fixes increment patch, additive roles increment minor, and incompatible API or default visual changes increment major. Record decisions and update reference evidence rather than silently retuning global styles.

## Decision log

- **2026-09-08:** Home is approved and excluded from every migration stage, including indirect changes.
- **2026-09-08:** Deliver docs, typed tokens/components and a native developer gallery before migrating production screens.
- **2026-09-08:** Support iOS and Android with native fonts and a compact base. Allow documented exceptions for onboarding art, important metrics, charts and celebrations.
- **2026-09-08:** Start the later rollout with commitment flows. Keep the current tab bar and all existing destinations.
- **2026-09-08:** Version 1.1 migrates Circles as the first production screen and adds member-aware focused commitment previews with flexible action labels.
- **2026-09-09:** Version 1.2 adds the composer presentation and an optional `DSButton.labelStyle` override. Existing button defaults remain unchanged. The user-approved hierarchy revision uses a 52-point floating mark, an 18-point commitment title and a 56-point Skip target. See the scoped Tap In guide for evidence and outstanding device checks.

This package is an implementation foundation, not evidence that all app screens or assistive technologies have passed QA. See the validation ledger for actual coverage.
