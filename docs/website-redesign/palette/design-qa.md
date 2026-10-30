# Hoyst blue and sage palette QA

Reviewed 2026-10-22. This report supersedes the original color assessment, while preserving its approved layout and behavior.

## Findings

No unresolved P0/P1/P2 findings. The previously dominant lavender surfaces, purple step accents, and purple illustration connections have been replaced. Purple remains in the existing Hoyst logo, the real app screenshot, and one Hoy in the introduction.

## Source and comparison evidence

- Visual source: the [approved mock](../approved-mockup.png), amended by the user's approved blue/sage palette and multi-color Hoy plan.
- Before implementation: [home-before.png](home-before.png), captured from the actual local page before editing.
- After implementation: [home-after.png](home-after.png). Both captures use the same default state, English, light theme, 899 CSS pixels, DPR 1, and measure exactly 899 × 2381 image pixels. No scale normalization or stretching was necessary.
- [Full core comparison](comparison-full.png), [focused hero comparison](comparison-hero.png), and [focused Hoy/signup comparison](comparison-hoy-signup.png) were opened and reviewed side by side. Both sides retain their source pixel scale.
- Desktop: [home-desktop.png](home-desktop.png), 1280 × 900 CSS viewport, DPR 1. [Hero detail](home-hero.png) shows the real screenshot and blue Hoy.
- Tablet: [home-tablet.png](home-tablet.png), 768 × 1024 CSS viewport, DPR 1.
- Mobile: [home-mobile.png](home-mobile.png), 390 × 844 CSS viewport, DPR 1; [narrow](home-narrow.png), 320 × 800 CSS viewport, DPR 1.
- Invitation: [desktop](invite-desktop.png), 899 × 900 CSS viewport; [mobile](invite-mobile.png), 390 × 844 CSS viewport. The route was additionally checked at 768 and 320 pixels wide.
- Confirmation: [desktop](confirmation-1280.png), 1280 × 900 CSS viewport; [narrow](confirmation-320.png), 320 × 800 CSS viewport. The route was additionally checked at 768 pixels wide. Missing-token state is intentional and remains disabled.

## Five fidelity surfaces

- Typography: existing self-hosted Manrope and Kalam, type sizes, wrapping, weights, hierarchy and copy are unchanged. Handwritten accents now use dark blue `#1059AD`.
- Spacing and layout: same hero, phone, overlapping Circle ribbon, numbered story, introduction, signup, FAQ and footer. Before and after matched-width captures have identical total dimensions. No document overflow at 1280, 899, 768, 390 or 320 pixels. Image slots retain their previous canvas dimensions; revised art is fit proportionately, without distortion.
- Colors: peach hero and blue actions retained. Hoy/signup section is sage `#EDF5EF`; signup remains white. Steps use pale blue/dark blue, sage/dark green, and peach/dark orange. Dashed connector is muted sage. Shared category styling still uses actual app category colors. Measured text contrast: blue/sky 6.04:1, green/sage 5.15:1, orange/peach 5.53:1, handwritten blue/peach 5.92:1. Blue focus ring/sage is 4.64:1.
- Images: blue Hoy reuses `setup-friendly-blue.png`; green invitation Hoy reuses `goal-completed.png`; golden confirmation Hoy reuses `progress-golden.png`; purple introduction Hoy remains unchanged. The real Workout Crew screenshot is byte-identical before/after, SHA-256 `7c3ae3bb5f0729c471fc43f9b0d566b0b18241bd377fd97a2ee5e2bc2e9639c3`. Three existing collage illustrations were edited through built-in Image Gen, preserving the people, arrangement, messages, and transparent composition. Colors now favor blue/green with yellow and peach highlights. Original edited PNGs, optimized production WebPs, and [full prompts](artwork-prompts.md) are retained. No mascot CSS color filter or hand-drawn replacement art was used.
- Content: approved text, CTA labels, installation instructions, actual invitation fields, and email behavior are unchanged. The hero and invitation image descriptions reflect their new blue/green colors.

## Behavior and technical checks

- All homepage assets loaded with nonzero natural image sizes. No broken images or visible transparency boxes were found.
- Keyboard navigation visibly focuses Meet Hoy with a 3-pixel blue outline. Reduced-motion emulation was used for navigation during matched captures, then reset.
- Invitation links remain `hoyst://join/workout123` and the existing TestFlight URL in the fictional local demo. The actual category appearance remains supplied by the app resolver.
- Confirmation art retains its 384:343 natural aspect ratio, rendered 150 × 133.98 CSS pixels. The existing no-token warning and disabled submit state remain intact.
- Homepage, invitation, and confirmation browser console checks returned no warnings or errors.
- Functions TypeScript build passed. Thirteen focused website/signup/beta web checks passed. Targeted renderer lint and `git diff --check` passed. No backend behavior, public API, data model, native app source, or production configuration changed in this palette revision.
- No production deployment occurred. Local email sending remains disabled.

## Comparison history and remaining polish

The first final before/after comparison found no actionable P0/P1/P2 issue. Existing generated-art portrait details vary slightly after palette editing; subject, expression, arrangement and visual role remain consistent. No further visual iteration is required for the scoped palette change.

## Implementation checklist

- [x] Sage introduction/signup surface and white signup card.
- [x] Blue handwritten accents and focus rings.
- [x] Distinct blue, green and warm step markers.
- [x] Blue hero Hoy, purple introduction Hoy, green invite Hoy and golden confirmation Hoy.
- [x] Blue/green storytelling artwork with warm highlights.
- [x] Existing screenshot, layout, copy, category colors, links and behavior preserved.
- [x] Desktop/tablet/narrow visual checks, contrast, focus and console review.
- [x] Local preview retained; production publication separate.

final result: passed
