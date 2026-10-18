# Tap In story overlay

Updated October 17, 2026.

The approved medium-height layout places a compact content group in the lower half of the standard, photo-backed, and transparent templates. The header is `{date} · I TAPPED IN ON MY ACCOUNTABILITY CIRCLE:`, with an uppercase date such as `OCT 17, 2026` and a balanced wrap before `ACCOUNTABILITY CIRCLE:`. Personal shares use `PERSONAL COMMITMENT:` instead. The separate category eyebrow and date row are removed.

Circle title, category artwork, and commitment lead into two stacked sections. Your progress contains This Tap In quantity/status, current-period progress, and personal streak. Group progress contains members who met their period goal and the group streak. Both streaks use orange Flame icons from the existing icon library. Member avatars and the invitation pill remain. Personal commitments omit group sections and avatars and retain Hoyst branding.

There are no saved notes, repeated goal labels, standalone result heading, progress bars, seven-day activity, legends, or activity metadata in the share model or image. Notes, goal settings, and history elsewhere in the app remain unchanged. Amounts and long custom unit labels wrap to two lines, then truncate; the recorded number remains visible.

The share loader runs the existing progress refresh callable and one server read of the selected viewer check-in in parallel. It makes no direct historical check-in, membership-history, or daily-coverage reads. Progress calculations remain owned by the existing backend. Reads retain their 10-second timeout, valid same-period completion fallback, deleted-entry handling, and no-account guard. The resolved preview stays fixed, ignores late results after unmount, and waits for capture-card photo/avatar settlement before enabling image actions.

Dates refer to the selected tap-in. Periods and streak units follow the commitment cadence. Older shares label the actual current progress period explicitly. PNG exports remain exactly 1080 × 1920 physical pixels; iOS dimensions account for display density. The transparent export excludes the preview checkerboard.

## Verification

Six focused suites cover the share context, data builder/native sharing, share screen, completion screen, composer, and Circle detail. They include exact middot/colon copy, result grouping, flame icons, personal variants, omitted content, notes still saving in the app, one-entry-only reads, parallel loading, current-period fallback, unavailable/deleted data, capture readiness, navigation, and existing share destinations.

Native fixtures were exported on iPhone 17 Pro (iOS 26.5) and Pixel 10 (Android emulator): standard, transparent, long transparent, long large-value photo, personal, unavailable, daily, monthly, confirmation, and failed. All twenty exports measured 1080 × 1920. All transparent fixtures retained alpha from 0 through 255. Photo checks use bundled Hoy artwork as a colorful local fixture. The reading photograph in the design mock is not a production asset. Posting into Instagram/Snapchat and a live production tap-in submission were not exercised.

The debug host supports `hoyst://tap-in-story-preview/<mode>`. Modes include `light`, `transparent`, `long-transparent`, `long-large-photo`, `personal-transparent`, `unknown-transparent`, `daily`, `monthly`, `confirmation`, `failed`, and `close`. It uses local fixtures and automatically captures a PNG without submissions or account access.

- [iOS standard export](reference/tap-in/contextual-story/approved-overlay/ios-light.png)
- [iOS transparent export](reference/tap-in/contextual-story/approved-overlay/ios-transparent.png)
- [Android standard export](reference/tap-in/contextual-story/approved-overlay/android-light.png)
- [Android transparent export](reference/tap-in/contextual-story/approved-overlay/android-transparent.png)
- [Native export measurements](reference/tap-in/contextual-story/approved-overlay/validation.json)
- [Design comparison and QA](tap-in-story-share-qa.md)
