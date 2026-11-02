# Expanded commitment cards

Approved November 1, 2026, design system 2.0.0; header spacing refined in 2.0.1, the gradient removed in 2.0.2, and icon padding/alignment plus goal icons refined in 2.0.3. Initial visual target: `outputs/home-circle-card-redesign-2026-11-01/round-2/02-soft-color-wash.png`.

## Presentation

Version 2.0.4 reduces the space between the footer divider and content from 12 to 6 points across the shared card surfaces.

Version 2.0.6 keeps pending/completed status labels beside member context when space permits. These statuses no longer force a full-width second row; member copy can wrap within its column, and narrow or enlarged-text layouts can still wrap the footer naturally. The `pending-light-narrow` fixture exercises the Home pending state.

Commitment cards use a neutral white body in light mode and charcoal in dark mode. The card has no gradient or category-colored background wash. Category accents remain on the icon, label, and actions. The category icon sits to the left of a stacked category label and title, with the details arrow on the right. Description and configured goal follow, then applicable streaks and a divided action footer. There is no colored edge stripe or disclosure state.

The shared native `CommitmentCardSurface` and `CommitmentCardHeader` accept resolved colors from `getCommitmentCardColors`. This keeps existing Home, setup, and opt-in theme boundaries intact. Generic surfaces, category mappings, and global typography/theme defaults are unchanged. Card-local dimensions are radius 22, horizontal inset 18, equal top/bottom insets 16, content gap 8, title 18/24 semibold, body 14/20, and supporting text 12/16. The header uses a 12-point gap between the icon and text column, with 2 points between the category label and title. The 32-point category icon has 6 points of padding inside a 44-point circular background. Version 2.0.5 vertically centers the category/title stack beside this circle, superseding the previous top alignment. Goal lines retain their small target icon. Long titles wrap within the flexible text column. Titles and metadata wrap; controls keep 44-point iOS / 48-dp Android targets.

`DSCommitmentPreview` no longer accepts `expanded` or `onExpand`. Home no longer tracks a focused commitment. Completed and pending commitments retain the expanded presentation without gaining submission actions. Details access remains separate from Tap In, Nudge, Share, Update, and restoration controls.

## Coverage and data contracts

- Home and All commitments retain existing ordering, action eligibility, live progress, per-card busy state, and associated join-request prompts.
- Explore retains availability and public activity, with group-only metrics and View details.
- The Tap In selector uses distinct expanded cards for due and utility commitments. Saved quantities, Limit compliance, deadlines, and duplicate-request locking stay in the existing controllers.
- Setup and invite context, template, and Circle choice cards use the same treatment. Selection, drafts, and wizard controls are preserved; unrelated form choices retain their existing presentation.
- Archived and past Circle summaries use the same neutral surface and category accents without inventing goals, streaks, member progress, or other unavailable data. Restoration remains owner-only.
- Personal cards omit group metrics and member avatars. Category and appearance values continue to come from existing helpers. No backend or persistent schema changes are required.

Full-screen Circle Detail, composer/completion headers, share/export imagery, activity/history rows, other Home presentation, and navigation remain outside this change.

## Native fixtures

In a Debug build, use **Commitment card previews** from the developer menu, or open `hoyst://commitment-cards-preview/light`. Supported mode suffixes include `dark`, `light-narrow`, `dark-narrow`, `light-bottom`, `dark-bottom`, `light-long-narrow`, `complete-light-narrow`, and `other-light` / `other-dark`. Fixtures use the production Home stack, design-system card recipe, and setup choices. Actions update local fixture state only. The temporary appearance override is restored when the fixture closes. Use `hoyst://commitment-cards-preview/close` to close it.

The existing Tap In selector previews also render the new production cards. Use local fixtures for visual and interaction checks without submitting account data.

## Validation

The 2.0.6 footer-status fix passes TypeScript, scoped lint, and all 30 Home-stack/design-system tests. Native simulator review confirms pending status beside member context on narrow Home cards in both themes and on the shared preview recipe. Screenshots use the `pending-footer-*` prefix in the implementation evidence directory.

The 2.0.5 title-size and vertical-centering refinement passes scoped lint and diff checks. Native simulator review covers light narrow cards and dark narrow cards with long titles; screenshots are saved as `centered-title-*` in the implementation evidence directory.

The 2.0.3 header and goal-icon refinement passes TypeScript, scoped lint, and all 30 Home-stack/design-system tests. Native simulator review covers the light narrow layout and dark narrow layout with long titles; screenshots are saved as `padded-icon-goal-*` in the implementation evidence directory.

The scoped visual review passed. TypeScript, scoped lint, signed iOS Debug build, and Android release JavaScript bundle pass. The 11 focused suites pass 131 tests. Full Home passes 57 tests with one existing actorless activity-icon assertion still failing outside this redesign. Native iOS fixtures cover both themes, 360-point width, long titles, accessibility-large text, completion, setup selection, and Duo open/closed state retention. Android native and physical devices remain unverified.


Validation results and native screenshots are recorded in the implementation evidence directory beneath `outputs/home-circle-card-redesign-2026-11-01/implementation/`. The frozen-reference manifest is not regenerated: its baseline already reports 25 differences, including the two Home files explicitly covered by this card exception.

The existing contrast test previously discarded alpha in eight-digit category colors. Its helper now composites those colors over the actual background, and separate checks cover every palette's text against the neutral card surface and the category icon backplate.
