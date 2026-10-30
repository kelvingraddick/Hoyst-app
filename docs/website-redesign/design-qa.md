# Hoyst website implementation QA

Current palette revision, 2026-10-22: [blue and sage QA](palette/design-qa.md) supersedes the color and mascot assessment below. The original approved-layout verification remains recorded here.

The user subsequently authorized production publication. See [release verification and signup status](publication/README.md); the no-publication statements below describe the earlier local review.

Latest signup revision: [checkbox flow QA](checkbox/README.md) supersedes the earlier double-opt-in description for new signups.

Reviewed 2026-10-21. Scope: approved homepage, Circle invitation pages, secondary update signup, and confirmation page. This is a local implementation review. Production is unchanged.

## Findings

No unresolved P0/P1/P2 findings in the implemented website. Live delivery is deliberately disabled and is a publication prerequisite, not a claimed passing production test.

- Fixed P2: initial desktop implementation was too tall and the reference-width headline wrapped to four lines. Tightened story spacing and art crops, adjusted the tablet grid and type size, and restored the approved three-line headline. See [initial comparison](comparison-initial.png), [final comparison](comparison-final.png), and [focused hero comparison](comparison-hero.png).
- Fixed P2: transparent padding made the illustrations too small in their slots. Cropped only empty alpha bounds and recaptured the final page. The real phone screenshot and supplied Hoy remain proportionate.
- Fixed P1: the confirmation page's `no-referrer` policy made browser form POSTs supply `Origin: null`, which the same-origin guard correctly rejected. The shared page now uses `strict-origin` in both HTTP and meta policies. It sends only the origin as a referrer, excludes token paths/query, and supports the guarded POST. A fresh browser GET followed by confirmation now produces the intended local unavailable/retry page. See [retry evidence](confirmation-retry.png). Cross-origin rejection remains covered by automated tests.
- Fixed P3: the browser's default outline surrounded the entire focusable main region after skip-link navigation. Main still receives focus; interactive links, fields, summaries, and buttons retain explicit focus rings.

## Source, state, and normalization

- Source visual truth: `/Users/kelvin/.codex/generated_images/01a15d09-6e6c-7b20-8693-857141370fdf/exec-e4ac9c56-2156-4a44-b65e-75eba2fb1b0c.png`, preserved as [approved-mockup.png](approved-mockup.png), 899 × 1750 pixels.
- Implementation: `http://localhost:4173/`, static Firebase Hosting source, light theme, English, default form and FAQ state, fictional Workout Crew content.
- Matched-width capture: [home-reference-width.png](home-reference-width.png), 899 CSS pixels wide, DPR 1, 899 × 2381 image pixels. No horizontal resizing or vertical stretching in the comparison. The reference's homepage core is y=0..1522; the implementation core ends at y=1631.4. The modest height increase accommodates real type, real app UI, and working signup copy.
- Full-view comparison: [comparison-final.png](comparison-final.png). Both cores sit side by side at their original 899-pixel width. The full implementation adds installation guidance, FAQ, legal/support links, and the final TestFlight action below the approved core.
- Focused comparison: [comparison-hero.png](comparison-hero.png), same density and width. This makes the logo, headline wrapping, CTA, phone mask, real screenshot, and Hoy visible at a useful scale.
- Invitation comparison: [comparison-invitation.png](comparison-invitation.png). The source's bottom panel is a separate route in the implementation. The standalone route enlarges the panel for actual details, accessible controls, installation guidance, support, and state messages. Both crops retain their original pixel sizes; they are not presented as a pixel-identical screen.
- Final desktop: [home-desktop.png](home-desktop.png), viewport 1280 × 900 CSS pixels, DPR 1, full-page image 1280 × 2815. [Hero detail](home-hero.png) is the first viewport.
- Tablet: [home-tablet.png](home-tablet.png), viewport 768 × 1024 CSS pixels, DPR 1.
- Mobile: [home-mobile.png](home-mobile.png), viewport 390 × 844 CSS pixels, DPR 1, full-page image 390 × 4312. [Hero detail](mobile-hero-detail.png) is the first viewport. [Narrow mobile](home-320.png) uses 320 × 800 CSS pixels, DPR 1.
- Reflow: [home-200-percent-reflow.png](home-200-percent-reflow.png), 640 × 450 CSS pixels at DPR 2, equivalent available CSS space to a 1280 × 900 window at 200% zoom. This checks reflow rather than claiming a native browser zoom-control test.

## Required fidelity surfaces

- Fonts and typography: self-hosted Manrope is the close rounded display/body match; self-hosted Kalam supplies the small handwritten accents. The approved headline, three numbered sections, Hoy introduction, and secondary signup hierarchy are retained. Headline wraps to three lines at the source width. Mobile uses a readable stacked composition. Differences from the generated mock's letterforms are accepted because the mock is not a font specification. Font licenses are bundled.
- Spacing and layout: peach hero, right-hand iPhone, foreground Hoy, overlapping white Circle panel, vertical numbered story, and lavender Hoy/signup section follow the approved composition. Art fits its intended slots without stretching. Mobile places the headline and TestFlight action before the phone, then presents each story step and its illustration in order. There is no horizontal document overflow at 1280, 899, 768, 640, 390, or 320 CSS pixels.
- Colors and tokens: cream canvas `#FAFAF7`, peach `#FFEADF`, blue action `#0866E8`, purple `#6231D5`, lavender, dark ink, and muted text retain the reference's balance. Calculated contrast: white/blue 5.15:1, muted/canvas 6.84:1, purple/peach 6.20:1, ink/peach 16.24:1. Interactive focus rings are visible. Category colors come from the existing app appearance resolver.
- Images and assets: one real native app capture appears inside the hero phone; the rest uses individually generated transparent connection/encouragement/shared-goal illustrations. Actual supplied Hoy and logo are reused. A real bezel asset masks the screenshot. No fake app UI fragments, handcrafted logo, inline SVG illustration, or CSS-drawn replacement artwork was introduced. All homepage images were loaded with nonzero natural dimensions in the final browser check. WebP assets preserve transparency without visible halos.
- Copy and content: exact approved headline, Workout Crew example with three workouts a week, three step titles, Hoy introduction, TestFlight beta label, general update copy and email-only form. The native capture uses realistic demonstration members and weekly progress. Invitation renderers escape user-supplied content and retain actual category, Commitment, cadence, counts, and access state. No launch date or platform dropdown was added.

## Browser behavior and accessibility

- Keyboard skip link focuses `main`; primary actions, navigation, email input, submit button, and native FAQ summaries are operable by keyboard. Enter toggles a FAQ summary. Fields have explicit labels and status feedback.
- Reduced-motion emulation yields `scroll-behavior: auto` and zero control transition durations. Responsive reflow and image proportions remain sound.
- TestFlight actions point to the existing `https://testflight.apple.com/join/uzrHGy3t` destination. Local fictional invitations use `hoyst://join/workout123`. The original invite-code lookup, normalization, resolver and Universal Links association remain intact. No physical-device install or Universal Link handoff is claimed from this local review.
- Reviewed available, approval-required, full, invite-only, and unavailable invitation states. Full Circles explain the capacity limit while allowing existing members to open the app. Unavailable pages omit an app deep link. Install instructions explicitly tell visitors to return to the invitation after installation. Signup is absent from invitations.
- Evidence: [desktop invite](invite-desktop.png), [mobile invite](invite-mobile.png), [full Circle](invite-full.png), [unavailable invitation](invite-unavailable.png).
- Signup rejects invalid email input and shows a truthful retry message when local delivery is disabled. See [signup unavailable](signup-mobile-unavailable.png). Local preview cannot send mail or access production Firestore.
- Confirmation GET does not subscribe anyone. The fragment is removed from the visible URL, and an explicit button POST is required. Local unavailable confirmation retains a retry button. Confirmation pages do not load analytics.
- Clean homepage and invitation console checks returned no warnings or errors. Intentional local 503 signup/confirmation responses were exercised separately. No analytics SDK or new event was added; existing beta hooks/preferences were preserved.

## Automated verification

- Functions TypeScript build passed.
- Application TypeScript validation passed after restoring the normal App entry point.
- 22 focused Node tests passed across website updates, actual Firestore emulator transactions/rules, and existing beta web behavior. After the referrer-policy fix, the affected Node suites were rerun: 13 passed.
- Existing Circle invite/coordinator Jest suites passed: 18 tests.
- Targeted website/functions lint and `git diff --check` passed.
- Cases include normalization and validation, safe duplicates, cooldown and per-email/IP/global limits, concurrent requests and confirmations, latest-token invalidation, expiry, stale claims, provider failure and retry, idempotent delivery, verified sender gating, HTTP 429 retry, explicit/inherited topic opt-outs, global unsubscribe preservation, request method/origin/body limits, escaped invitations, and denied client access to server collections.
- Resend sending-domain status and public audience configuration were independently checked read-only. No email was sent and no live contact subscription was changed. Production signup remains disabled pending secret/configuration setup and a controlled owned-inbox check.

## Open questions and follow-up polish

No clarification is required to review this local implementation. P3: generated avatar arrangements and the supplied production Hoy differ slightly from the approved generated mock; they retain its palette and visual role. Physical iPhone installation, production routing, and real delivery remain publication validation tasks.

## Implementation checklist

- [x] Approved homepage composition and responsive layouts.
- [x] Real Workout Crew screenshot, supplied Hoy, separate storytelling artwork.
- [x] Shared invitation styling, real preview fields, required states and links.
- [x] Secondary email-only signup and explicit double-opt-in confirmation.
- [x] Rate limits, duplicate safety, opt-out preservation, secret-only credentials.
- [x] Privacy disclosure and Resend setup documentation.
- [x] Browser evidence, visual comparisons, focused checks and TypeScript validation.
- [x] Unrelated checkout changes preserved; local preview retained.
- [ ] Separately authorized production publication, enablement and owned-inbox delivery check.

final result: passed
