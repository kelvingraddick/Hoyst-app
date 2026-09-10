# Contextual Hoy Actions and Notification Bell Design QA

Source visual truth: `/Users/kelvin/Pictures/Photos Library.photoslibrary/resources/derivatives/6/6D680874-9FB9-4BF9-9A70-94CC78A4A26E_1_101_o.jpeg`

Implementation evidence:

- Final dark Home: `/tmp/hoyst-header-dark-final.png`
- Final light Home: `/tmp/hoyst-header-light-final.png`
- Accessibility Large text: `/tmp/hoyst-header-light-large-stable.png`
- Zero-unread bell: `/tmp/hoyst-header-light-zero.png`
- Full-view source comparison: `/tmp/hoyst-design-comparison-full.jpg`
- Focused header comparison: `/tmp/hoyst-design-comparison-header.jpg`
- Light and dark comparison: `/tmp/hoyst-design-comparison-themes-final.jpg`

Viewport: iPhone 17 Pro simulator, iOS 26.5, 402 x 874 points.

Pixels and density: source and implementation are both 1206 x 2622 pixels at native 3x density. CSS-equivalent size is 402 x 874 points. No resizing or density normalization was needed before comparison.

State: the source shows Kelvin with an initial Tap In action and 9 unread updates. The implementation shows Phil with an at-risk Tap In update and 9 unread updates so the three-line contextual state can be evaluated. The account data differs intentionally; header geometry, typography, surfaces, assets, and action placement are the comparison targets.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography passed. The existing system family, 15-point bubble copy, 20-point line height, and strong Home hierarchy are preserved. The contextual headline stays readable at three lines and at Accessibility Large without clipping the bubble, Hoy, logo, or bell.
- Spacing and layout rhythm passed. The final focused comparison preserves the source bubble width, top inset, tail-dot spacing, 52-point Hoy slot, and horizontal margins. A three-line message adds only its required vertical height. The Hoyst logo and bell share one aligned row, and the bell keeps a bare 44-point hit target.
- Colors and tokens passed. Frosted bubble treatments, brand background, text contrast, tail dots, orb state colors, red unread badge, and light/dark token mappings remain consistent with the existing Home design.
- Image quality and asset fidelity passed. The existing Hoyst logo and Hoy orb assets remain sharp at native 3x density. The notification control uses the app's established icon library rather than a text glyph, emoji, custom SVG, or drawn substitute.
- Copy and content passed. The bubble names the Circle, risk state, and Tap In update in a direct-then-playful voice. The 90-character limit remains visually compatible with the three-line bubble.
- Icons passed. The 24-point bell has consistent stroke weight and optical alignment with the logo row. The 22-point unread badge sits above the bell's top-right edge, caps at 9, and disappears cleanly at zero.
- Accessibility passed. The combined bubble, tail, and Hoy surface is exposed as one action button that announces the contextual message. The bell separately announces its unread count. The action remains disabled before greeting readiness, and the bell retains a practical 44-point target.
- Interaction passed. Activating Hoy in the simulator opened the correct `TapInComposer` update for Sleep 7 Hours. Automated coverage verifies initial Tap In, nudge and pending Circle Detail routing, Explore, Momentum, bell Inbox navigation, unread clearing, and unresolved disabled behavior.
- Full-view comparison passed. The header maintains the original composition and does not obscure the week strip or summary cards. The intentional three-line message moves later header content down by one text line without causing overlap.
- Focused comparison was required because the bell, badge, three-line wrapping, tail spacing, and logo alignment were too small to judge reliably in the full screen alone.

## Comparison history

- Initial comparison finding [P1]: applying the row layout directly to the outer `Pressable` caused the bubble to consume the available width and pushed the tail and Hoy onto a second row.
- Fix: retained the outer combined action target but moved the horizontal layout onto an inner row container so native Pressable behavior cannot alter child sizing.
- Post-fix evidence: `/tmp/hoyst-design-comparison-header.jpg` shows the bubble, tail, and Hoy restored to the source proportions at the same viewport and density. `/tmp/hoyst-design-comparison-full.jpg` confirms the rest of Home remains aligned.
- Final polish: shifted the unread badge slightly farther above and right of the bell so the icon remains recognizable while the count stays visually attached.

Primary interactions tested: contextual Hoy action navigation, appearance switching, standard and Accessibility Large text sizes, three-line copy, 9 unread, and zero unread. Bell Inbox mutation was verified by automated tests rather than clearing the live simulator account's unread state.

Automated coverage: focused Home data, Hoy state, greeting client, greeting function, Home screen, Tap In picker, and Circles suites; TypeScript typecheck; Firebase Functions build.

final result: passed

---

# Launch Screen Light and Dark QA

Status: **Passed** on September 9, 2026.

## Compared reference and implementation

- Source visual truth: `/Users/kelvin/Downloads/exec-75afb1ff-4676-409f-b5b6-a065164e1048.png`
- Final light implementation: `/tmp/hoyst-launch-final-light-clean.png`
- Final dark implementation: `/tmp/hoyst-launch-final-dark-clean.png`
- Viewport: iPhone 17 Pro simulator, iOS 26.5, 402 x 874 points at native 3x density
- Pixels and density: the supplied 853 x 1844-pixel reference represents the requested 390 x 844 composition. The implementation captures are 1206 x 2622 pixels at 3x. The full-view comparison used normalized screen proportions because the source and implementation have matching aspect ratios but different pixel density and point size. No CSS viewport applies to this native launch storyboard.
- State: the same launch composition was rendered in system light and dark appearances.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography passed. The existing adaptive Hoyst wordmark asset is used without recreating or altering its lettering. The black light-mode and white dark-mode variants retain the multicolor ring and internal proportions.
- Spacing and layout rhythm passed. The wordmark is geometrically centered and matches the selected larger reference scale. Hoy retains the reference crop and normalized upper-right position without covering the wordmark.
- Colors and visual tokens passed. The storyboard uses the existing adaptive `LaunchBackground` color asset, resolving to `#F5F5F7` in light mode and `#0E0E0E` in dark mode. Only the background and wordmark foreground change between appearances.
- Image quality and asset fidelity passed. Hoy is a transparent 263 x 520 raster cutout derived from the approved source, so facial construction, highlights, scale, and edge crop remain identical in both themes. The cutout is sharp, has a real alpha channel, and shows no visible light fringe on the dark canvas.
- Copy and content passed. The only app-provided visible content is the Hoyst wordmark and Hoy. The previous decorative launch rings, system status-bar indicators, and all additional launch copy or controls are absent.
- Full-view comparison passed. The supplied reference and final light render were opened together. Their normalized Hoy top edge, right crop, wordmark center, and wordmark width align visually.
- A separate focused crop was not needed because the wordmark and Hoy are large, isolated elements with ample negative space and were legible at full native resolution. Asset-level inspection additionally verified the Hoy cutout alpha and both adaptive wordmark renditions.

## Comparison history

- Initial comparison finding [P2]: the first native wordmark render was about 10 percent smaller than the selected reference because the existing logo image includes transparent internal padding.
- Fix: increased the proportional logo image-view width from 0.59 to 0.654 of the screen while retaining geometric centering and the source asset's aspect ratio.
- Post-fix evidence: `/tmp/hoyst-launch-final-light-clean.png` aligns with the supplied reference at normalized scale. `/tmp/hoyst-launch-final-dark-clean.png` confirms identical Hoy and wordmark geometry after the adaptive color change.

## Implementation checklist

- Adaptive launch background verified in light and dark.
- Existing adaptive Hoyst wordmark verified at the selected larger size.
- Shared Hoy cutout verified at the same right-edge crop in both appearances.
- Launch-only status-bar suppression verified. React Native restores the existing status bar after the app mounts.
- Interface Builder validation completed with zero errors, warnings, or notices.
- iPhone 17 Pro simulator build completed successfully.

Residual coverage: Android has no existing custom launch-screen layout in this project and was not changed. A physical-device launch capture was not performed.

final result: passed

---

# Circle Detail Visual Refinement QA

Status: **Passed** on September 9, 2026.

## Compared reference and implementation

- Supplied visual reference: `/Users/kelvin/Downloads/Codex Image Sep 8, 2026, 10_53_28 PM.png`
- Final light header and progress: `/tmp/hoyst-circle-detail-refinement-light-top-final.png`
- Final light members and feed: `/tmp/hoyst-circle-detail-refinement-light-feed-final.png`
- Final dark header and progress: `/tmp/hoyst-circle-detail-refinement-dark-top-final.png`
- Final dark members and feed: `/tmp/hoyst-circle-detail-refinement-dark-feed-final.png`
- Combined same-viewport light comparison: `/tmp/hoyst-circle-detail-refinement-comparison-light.jpg`
- Composer follow-up before capture: `/tmp/hoyst-circle-composer-before.png`
- Composer follow-up final capture: `/tmp/hoyst-circle-composer-after-final.png`
- Composer focused source comparison: `/tmp/hoyst-circle-composer-focused-comparison-final.jpg`
- Composer width final capture: `/tmp/hoyst-circle-composer-fill-width-final.png`
- Composer width focused source comparison: `/tmp/hoyst-circle-composer-fill-width-comparison-final.jpg`
- Remove Tap In final capture: `/tmp/hoyst-circle-remove-tap-in-row-final.png`
- Remove Tap In focused comparison: `/tmp/hoyst-circle-remove-tap-in-row-comparison-final.jpg`
- Viewport: iPhone 17 Pro simulator, iOS 26.5, 402 x 874 points at native 3x density
- Composer-width comparison normalization: the supplied 853 x 1844-pixel reference and 1206 x 2622-pixel native Simulator capture were both normalized to 853 pixels wide before the focused comparison. The implementation crop covers the same Circle feed heading, composer, and first date separator region.
- State: active owner group. The reference and Simulator use different dates and activity data, so composition, typography, surfaces, assets, and interaction placement are the comparison targets.

## Review result

- No actionable P0, P1, or P2 differences remain after the combined reference comparison.
- The hero uses the approved design-system type scale and a single category-tint-to-canvas fade measured from the absolute screen top through the content-driven hero. The wash reaches the canvas before Tap In and translates with scroll, so it does not remain fixed behind later content.
- Metadata uses quiet 12/16 text with hairline vertical dividers. Tap In keeps its circular brand mark, action-blue surface, supporting copy, chevron, and the requested compact hero-to-action spacing.
- Group progress uses the requested two-column alignment, 4-point supporting gap, 18/22 streak value, 11/15 caption, 5-point track, category fill, and 16-point track-to-week-path gap. Complete checks, proportional partial arcs, Today treatment, skip coverage, and all-member accessibility labels remain intact.
- Circle members uses the sentence-case section heading with the total-member subtitle, horizontal avatar strip, compact status labels, subtle 18-point Invite icon, and full-width Home list-row treatment for Nudge all. Ready, busy, and sent states retain the title and expose the appropriate chevron, spinner, or check treatment.
- Circle feed has no quick cheers or enclosing feed card. The standalone composer uses a 40-point viewer avatar, 14/20 input, persistent image and Send controls, and selected-image support. Date labels and 40-point borderless feed-avatar rows render directly on the canvas with 64-point minimum rows, quiet timestamps, compact proof thumbnails, hairline dividers, and accessible trailing actions.
- Composer follow-up finding [P2]: the avatar wrapper sat two points above the input and controls, its 11/15 fallback initial looked undersized at 40 points, the 44-point input was below the guide's 48-point control height, and wide column spacing compressed the editable field. Fix: center every control on a 48-point row, use an 8-point content gap, scale the fallback initial to 14/20 semibold, increase both action glyphs to 20 points, and add a 4-point visual gap between the image and Send faces while preserving separate 44-point targets.
- Composer post-fix evidence: `/tmp/hoyst-circle-composer-after-final.png` and `/tmp/hoyst-circle-composer-focused-comparison-final.jpg` show the avatar, input, image action, and Send action on one optical centerline with a wider editable field and balanced control spacing. The 64-point outer surface, 18-point radius, hairline boundary, 40-point avatar, 32-point visual faces, permanent Send visibility, and selected-photo behavior remain unchanged.
- Composer-width follow-up finding [P2]: the two 44-point action targets occupied a separate trailing flex column, so the muted editable surface stopped early and looked narrower than the available composer row. Fix: place the targets as a trailing overlay inside the input shell and reserve 104 points of trailing text padding. The field now reaches the composer’s available right edge while text cannot run beneath the controls; the controls retain independent 44-point hit targets and 32-point visual faces.
- Composer-width post-fix evidence: `/tmp/hoyst-circle-composer-fill-width-final.png` and `/tmp/hoyst-circle-composer-fill-width-comparison-final.jpg` show the input treatment continuously filling the available row behind the camera and Send controls. The intentional persistent Send control differs from the supplied mock because the approved written behavior requires it.
- Remove Tap In follow-up finding [P2]: the destructive action used a separate pill-shaped utility control, breaking the member-action rhythm established by the Nudge all row directly above it. Fix: rebuild it with the same 44-point design-system list-row geometry, 32-point leading tile, text stack, divider, and trailing target as Nudge all, while mapping the danger semantic token to the Trash icon, tile, title, and chevron.
- Remove Tap In post-fix evidence: `/tmp/hoyst-circle-remove-tap-in-row-final.png` is the rendered native iPhone 17 Pro state. `/tmp/hoyst-circle-remove-tap-in-row-comparison-final.jpg` combines the live Nudge all reference pattern and the final destructive variation at the same native density. The rows share alignment, spacing, and divider treatment; title and icon colors distinguish the destructive action. The 1206 x 2622-pixel native capture is a 402 x 874-point screen at 3x, and both focused crops retain that density.
- Remove Tap In fidelity pass: typography uses the existing 16/21 title and 12/16 supporting scale; spacing keeps the matching 12-point leading gap, 32-point tile, 44-point targets, and hairline divider; colors use `theme.danger` with a translucent danger tile; the standard Lucide `Trash2` icon is sharp at 18 points; copy remains “Remove Tap In” with the quiet “Undo today” consequence. The loading state swaps the chevron for a danger-colored spinner and keeps the row disabled, preserving existing confirmation and removal behavior.
- First Simulator pass finding [P1]: the Nudge content wrapped vertically instead of following the Home row pattern. Fix: render the action with the exact shared design-system list row used by Find more circles.
- First Simulator pass finding [P1]: separate tint regions produced a visible safe-area seam. Fix: use one measured background gradient, then translate it with the screen scroll offset.
- The final light and dark Simulator captures verify the active owner group at 402 points. Focused fixtures cover 360-point layout, larger text, complete and partial group days, public preview, personal, pending, archived, member selection, Invite, Nudge all states, composer, image upload, likes, sharing, pagination, and read-only behavior. A physical-device capture and maximum accessibility text capture were not performed.
- The frozen Home reference command remains blocked by pre-existing dirty changes in `src/design/components/TapInPulseButton.tsx` and `src/features/home/components/HomeProgress.tsx`. This refinement did not modify either file. Focused Home regression suites pass.

final result: passed

---

# Circles Design-System Migration QA

Status: **Passed** on September 8, 2026.

## Compared reference and implementation

- Approved reference: `docs/design-system/reference/circles/approved-circles-mock.png`
- iOS light implementation: `docs/design-system/reference/circles/ios-circles-light.png`
- iOS dark implementation: `docs/design-system/reference/circles/ios-circles-dark.png`
- Viewport: iPhone 17 Pro, 402 points wide

## Review result

- The navigation row, heading hierarchy, supporting copy, four-way summary, sort control and full focused-card treatment match the approved composition.
- Exact typography, spacing, radii, touch targets and shadows use the versioned design-system values. These numeric values govern places where the generated reference renders larger than the approved Home scale.
- Light and dark canvases, category surfaces, readable foregrounds, avatar crops and independent card/action affordances render correctly.
- Filter selection and clearing, the sort sheet, name/progress ordering, card detail access and Tap In isolation were exercised in the Simulator or focused tests.
- The frozen Home manifest passes with all 81 protected files unchanged.
- Follow-up refinement: the back glyph is aligned to the navigation gutter, Create now uses the raised filter-surface treatment, the filter uses equal 12-point padding, and focused-card descriptions no longer reserve an extra 44-point row.
- Follow-up refinement: the northeast detail arrow now sits at the focused card's padded top-right edge while retaining its independent 44-point target.

## Open device coverage

Android native rendering, a physical-device pass, maximum accessibility text sizes and live VoiceOver/TalkBack traversal were unavailable for this pass. Component fixtures cover long-copy wrapping, and focused Circles tests cover loading/error/empty states, status filtering and action-state behavior. These do not replace the remaining device checks.

final result: passed
