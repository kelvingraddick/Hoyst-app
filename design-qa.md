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
