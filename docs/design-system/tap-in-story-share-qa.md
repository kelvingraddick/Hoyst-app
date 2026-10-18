# Tap In overlay design QA

final result: passed

## Source and implementation

Source visual truth: `/Users/kelvin/.codex/generated_images/01a14bb9-7b2b-79a3-9aae-52a9c927519c/exec-f0447478-3049-47e5-8a8a-63f3aa529f2e.png`, the selected option 2 revision, with the user's subsequent explicit change from the header divider to a middot. This copy change takes precedence over the older source pixels.

Implementation: native `TapInStoryShareCard` renders and PNG exports from iPhone 17 Pro (iOS 26.5) and Pixel 10. The source and exported cards were normalized to 1080 × 1920, corresponding to the fixed 360 × 640 logical-point card at an export density of 3. The Android device display density is 420 dpi; its PNG is explicitly resized by the existing capture API. Device screenshot chrome was excluded from the comparisons.

State: group Circle, A little reading every day, 12 pages / Partial, weekly personal progress 2 of 4, group progress 3 of 8 members, 3-week personal streak, 2-week group streak, AV/CA/JO/+5 avatar cluster. The reference has a reading photograph; the implementation comparisons composite its transparent PNG over a neutral dark surface to inspect the overlay itself. Background photography is intentionally not compared: the user requires their own photos, not the mock photograph. Native photo behavior was separately checked with bundled colorful Hoy artwork.

The project-root `design-qa.md` describes unrelated Progress work and was preserved. This report is scoped to the user's overlay request.

## Comparison evidence

Source is left, native implementation is right in each combined input:

- [iOS full comparison](reference/tap-in/contextual-story/approved-overlay/comparison-ios.png)
- [iOS focused content comparison](reference/tap-in/contextual-story/approved-overlay/comparison-ios-detail.png)
- [Android full comparison](reference/tap-in/contextual-story/approved-overlay/comparison-android.png)
- [Android focused content comparison](reference/tap-in/contextual-story/approved-overlay/comparison-android-detail.png)

Full-view comparisons were opened to evaluate the medium-height lower composition. Focused comparisons were opened to check the header, grid, text, icons, dividers, and footer. The imagery and final header punctuation differences described above are intentional.

## Findings and comparison history

- Earlier [P2] the header wrapped only CIRCLE onto the last line. Evidence: [initial iOS capture](reference/tap-in/contextual-story/approved-overlay/initial-ios-header.png). Fixed with an explicit balanced break after MY, matching the reference's two-line phrase. Both platform final exports retain the exact words, middot, and colon.
- Earlier [P2] the identity-to-stats spacing and title weight/size did not closely match the compact mock. Raised the title to 22/27 logical points and tightened the group spacing and separator padding. The full and focused post-fix comparisons above show the final result.
- No actionable P0/P1/P2 issues remain in the verified states. Long titles and commitment descriptions truncate within two lines; the content expands upward and leaves the footer visible. Large quantities preserve the full number; unusually long custom unit phrases ellipsize after two lines.

## Required fidelity surfaces

- Fonts and typography: existing native System font, semibold/bold hierarchy, fixed export typography, balanced header wrap, and readable three-column personal stats. Platform font rendering varies as expected. Confirmation and unavailable labels fit without a duplicate status line.
- Spacing and layout: medium-height bottom-anchored group, safe margins, thin internal rules, stacked personal/group sections, and intact avatar/invitation footer. Long content grows upward without clipping the footer.
- Colors and tokens: white photo/transparent foregrounds, slate secondary text on neutral cards, existing category tint, and orange Flame icons. Dividers and the invitation outline remain subtle. Photos retain the existing darkening gradient for contrast.
- Images and assets: existing Hoyst wordmark and category visual, existing avatar rendering, and vector Flame icons from the app's icon library. Emoji category artwork varies by native platform as elsewhere in Hoyst. No mock photo was introduced into production. Export alpha was measured and the checkerboard remains preview-only.
- Copy and content: date first, middot separator, exact first-person Circle/personal wording and colon, result only under Your progress / This Tap In, correct period/streak units, and no notes, repeated goal, progress bars, activity/history row, legends, or captions.

## Validation and residual gaps

Both platforms exported all ten fixture states successfully; [measurements](reference/tap-in/contextual-story/approved-overlay/validation.json) record 1080 × 1920 and correct alpha. Regression checks cover image/link sharing through mocked native destinations, snapshot stability, image settlement, and no direct history reads. Real social-app posting and a live production-account submission were not tested.

Follow-up polish [P3]: unusually long custom unit names can be shortened by the user for cleaner story text. Standard units and the full large numeric amount remain readable.
