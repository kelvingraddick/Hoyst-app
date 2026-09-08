# Compact Home refinement validation

This refinement applies the approved compact scale across Home while preserving the existing daily-action model, tab bar, contextual themes, guest artwork/authentication flows, and navigation destinations. It supersedes the sizing and compact-row navigation described in the initial Home redesign report.

## Implementation

- Home uses a shared typography scale: message 15/20, titles 16/21, body 14/20, headings 18/23, statistics 20/24, secondary text 12/16, actions 13/18, and categories 11/15.
- The header starts at safe area +4, with a 12-point hero gap and 8-point bottom spacing. Cards use 12-point padding, major sections use 16-point gaps, and commitment heading/subtitle spacing is 4 points.
- Hoy's Home variant renders an approximately 80-point visible face within a 92-point cluster. Image scaling accounts for the source artwork's transparent padding. Its radial ground shadow and small, unframed state accents are Home-specific. Default Hoy appearance elsewhere is retained.
- Statistics use two balanced columns, a 32-point divider, and a minimum 48-point row. Daily action counts and progress semantics are unchanged.
- Compact icon/text targets and separate right chevrons expand a commitment in place. Tap In/Nudge is a separate direct action. Expanded headers open details.
- Completed and pending commitments can be expanded intentionally. Initial focus selects the first actionable commitment, otherwise none. When focused work finishes, focus advances to the next actionable commitment or collapses. Manual completed/pending selection survives data refreshes.
- Category backplates are 32 points and member/activity avatars are 24 points. All my commitments uses the same icon width and title-column spacing. Interactive targets remain at least 44 points, even where visible action pills are smaller.
- At enlarged text sizes, the hero stacks and compact action controls move below the wrapping text. The screen retains normal scrolling and bottom clearance.

## Automated verification

- 149 tests passed across seven suites, with HomeScreen run separately from the other six: HomeScreen, HomeCommitmentStack, home-data, home-daily-actions, hoy-state, HoyOrb, and hoy-feedback-store.
- TypeScript passed.
- Changed-file ESLint passed with no warnings.
- `git diff --check` passed.

The tests cover separate expansion/action/detail behavior, completed/pending expansion, focus preservation and advancement, all Hoy assets and Home-only shadow/badge treatment, reduced-motion composition, one-shot celebration state, daily progress, Nudge success/failure/zero-target handling, duplicate submission prevention, guest/authentication controls, account switching, and navigation. The HomeScreen suite still emits its existing asynchronous greeting `act(...)` warning; it passes without suppressing that warning.

## Simulator verification

Captures are under the git-ignored `reports/home-compact/` directory. Fixtures were temporarily connected to the actual Home screen for visual state coverage, then removed. They do not establish production backend outcomes.

| Coverage | Evidence |
| --- | --- |
| Live signed-in iPhone 17 Pro, 402-point width | `live-final-light.png` |
| Revised layout in both themes | `final-light-top.png`, `final-dark-top.png`, `final-attention.png` |
| All eight Hoy expressions and contextual accents, both themes | State-named light/dark captures and `states-dark-review.png` |
| Full lower screen, completed rows, aligned overview link, six activity rows, media thumbnail, bottom clearance | `mixed-light-bottom.png`, `mixed-dark-bottom.png` |
| Guest and public discovery, both themes | `guest-final-top.png`, `guest-lower.png`, `guest-dark.png`, `guest-dark-lower.png` |
| Incomplete profile, loading/authentication, error, empty, pending, completed | Corresponding state-named captures and `alternate-review.png` |
| Long messages/titles and enlarged text | `final-long-dark.png`, `large-type-top.png`, `large-type-middle.png`, `large-type-lower.png`, `large-type-bottom.png` |
| iPhone 17e, 390-point width, long content | `narrow-long-dark.png` |
| Completed and pending row expansion on the narrower phone | `completed-expanded-narrow.png`, `pending-expanded-narrow.png` |

Live interaction checks confirmed that the Sleep commitment's chevron expands it without navigation, and its compact Tap In opens the correct composer directly. The composer was closed without saving. Completed and pending expansion were also exercised using rendered fixtures. Accessibility trees exposed separate expansion, action, details, notification, and progress labels.

## Remaining manual verification

- A hands-on VoiceOver traversal and physical-device touch/scroll pass remain unavailable. Accessibility labels/targets were inspected through code and the Simulator tree. Lower-screen captures used controlled native scroll offsets.
- No physical iPhone or Android render was captured. The iPhone 17e Simulator was shut down afterward, the iPhone 17 Pro's original text-size setting was restored, and the live account was left on Home.
- No real Tap In or Nudge was submitted. Existing backend deployment and multi-device Nudge verification remain separate release work documented in `home-redesign-validation.md`. This refinement adds no backend or daily-action schema changes.

## Follow-up visual polish

Hoy now has a 72-point visible face (68 on widths below 390), stays vertically centered beside the bubble, and uses a darker radial shadow. Bubble padding is 16 points. Today's node, weekday, date, and label use Hoyst blue, including a completed current-day node. Statistics are left aligned with a 22-point inset after the centered divider, 18/22 values, 11/15 captions, and a 16-point flame. Activity images fill their 24-point circle without the shared avatar component's gray ring. Other avatar usages are unchanged.

Verified live account renders at 402 points in light and dark, including all six activity rows. Captures are in `reports/home-polish/`. HomeScreen and HoyOrb tests: 62 passed; TypeScript and changed-file lint passed. Temporary theme/scroll overrides were removed afterward.

## Hoy accents and statistics container

Status icons, stars, and completion checks are now 16 points, with 20-point rays. Accents move outward along the upper diagonals and tilt by 12 degrees. The existing statistics target now has a light `#F1F1EE` or dark `#1D1D20` fill, 14-point radius, 12-point horizontal padding, 6-point vertical padding, and a 56-point minimum height. Daily-action progress stays outside it. Hoy's face size, shadow, centering, bubble, and shared/default appearance are unchanged.

All eight accent states were rendered in both themes at 402 points. The 390-point Simulator checked the real statistics component with temporary 120-day/75-percent sample values; those samples were never persisted. Enlarged text verified wrapping and container growth. Captures are under `reports/home-container/`. Preview overrides were removed, original text size restored, and the additional Simulator shut down. The final checks passed: 79 tests across HomeScreen, HoyOrb, and hoy-state, TypeScript, changed-file lint, and diff checks. Test suites were run in separate invocations after the combined runner stalled, consistent with the earlier runner limitation.

## Statistics icon alignment and focused-card shadow

Streak and momentum now use matching icon/value rows with vertical centering, 16-point flame/trend icons, and captions aligned under their numbers. The gap from the centered divider to momentum is 12 points, matching the container padding. Focused cards use the Hoy bubble's shadow parameters: 6-point vertical offset, 0.1 opacity, 12-point radius, elevation 3, warm `#92723E` in light mode and black in dark mode.

Light and dark 402-point live-account renders were inspected in `reports/home-stats-alignment/`; the temporary theme override was removed. All 48 HomeScreen/commitment tests, TypeScript, changed-file lint, and diff checks passed. Navigation and daily-action behavior were not changed.

## Statistics surface revision

The streak/momentum container now matches the Home canvas (`#FAFAF7` light, `#121212` dark) and uses the same theme-specific shadow as Hoy's message bubble: offset 0/6, opacity 0.1, radius 12, elevation 3. Dimensions, content, and interactions remain unchanged. Both theme renders were inspected in `reports/home-stats-shadow/`. All 36 HomeScreen tests, TypeScript, changed-file lint, and diff checks passed; the temporary theme override was removed.
