# Home redesign validation

Implemented the approved combined Home direction with iOS System (SF Pro), Home-specific typography and surfaces, contextual Hoy treatment, a staggered week path, separate statistics and daily actions, compact commitment/activity rows, and alternate states. The bottom tab bar and pre-existing guest authentication/artwork changes remain intact.

## Data contract

Home uses one daily-action resolver for card actions, sorting, remaining copy, progress, and Hoy's next-action context. Any saved Tap In counts once, including partial, failed, and skipped results. Saving advances Home to an eligible Nudge; editing remains in circle details and other screens keep their existing editing rules. Pending/archived commitments and View/Share do not contribute. Zero actions and a completed nonzero total have distinct labels.

A successful positive-target Nudge writes `lastNudgedAt` on the sender's membership. The transaction preserves newer concurrent receipts and cannot recreate a deleted membership. The callable response and notification deduplication remain unchanged. The client derives each receipt in the circle's timezone, prevents duplicate in-flight submissions, and gives no credit to errors or zero-target responses. Home refreshes on focus, foreground, and circle-local midnight. Resolved content is retained during refresh; account-specific snapshots prevent cross-account content reuse.

## Automated checks

- Focused Home screen, commitment, data, daily-action, Hoy, circle, and Nudge persistence tests: 143 passed across seven suites, run in two bounded invocations. A combined invocation stalled after completed suites, so the Home screen suite was verified separately.
- TypeScript: passed.
- Functions TypeScript build: passed, including tracked generated JavaScript.
- ESLint for changed application, backend, and test files: passed without warnings.
- `git diff --check`: passed.

Coverage includes saved Tap In statuses, editing isolation, removal/restoration, live denominator changes, obsolete and completed Nudges, pending/archive/personal exclusions, timezone boundaries, newer concurrent receipts, zero-target/failure responses, duplicate submissions, account switching, Retry, selective message emphasis, and partial week markers.

## Simulator evidence

Local captures are in `reports/home-redesign/` (git-ignored). Temporary rendering fixtures have been removed from application source. Fixture state labels are visual probes, not real account history or a production end-to-end result.

| Check | Evidence |
| --- | --- |
| Live iPhone 17 Pro, 402-point width | `live-final-light.png` |
| Mixed actions, light and dark | `mixed-light-top.png`, `mixed-light-lower.png`, `mixed-dark-top.png`, `mixed-dark-lower.png` |
| All six activity preview rows and bottom clearance | `mixed-light-bottom.png` |
| All eight Hoy states in both themes | State-named captures and `states-sheet.jpg`, `dark-states-sheet.jpg` |
| Guest, incomplete profile, authentication/loading, failure, empty, pending, complete | `guest-top.png`, `guest-lower.png`, `guest-dark.png`, `incomplete.png`, `loading.png`, `initial-loading.png`, `error.png`, `empty.png`, `empty-lower.png`, `pending.png`, `complete.png` |
| Long content | `long-dark.png` |
| Enlarged text | `large-type-top.png`, `large-type-lower.png`, `large-type-bottom.png` |
| Narrower iPhone 17e, 390-point width | `narrow-light.png` |

The large-text pass led to reliable compact calendar-label scaling with full accessibility date labels, a stacked Hoy/message layout, and separate action lines for compact commitments. Native accessibility trees confirmed meaningful button, state, and progress labels. Interactive targets use at least 44 points, including hit slop on 40-point category icons.

Live navigation was checked for the expanded Tap In composer, compact circle details, Momentum statistics, All my commitments, See all/Inbox, and the guest start flow. Automated tests cover the bell, Hoy action, compact actions, activity media/deeplinks, guest login, and Retry. Opening Inbox during this check exercised its existing mark-read behavior. No real Tap In or Nudge was submitted.

## Remaining verification and release

- Real multi-device Nudge persistence, reopening against the updated callable, and simultaneous accounts/timezones require deploying the backend and using designated test accounts. Current verification uses focused transaction/model tests and local rendered fixtures.
- A manual VoiceOver navigation and touch/scroll pass remains. The Simulator accessibility tree was inspected, but CUA drags sometimes registered as taps. Lower content was checked at controlled scroll offsets; native status-bar scroll-to-top was verified.
- Physical iPhone and Android visual checks were not performed. The additional iPhone 17e Simulator was shut down and the original iPhone 17 Pro was left on Home. Its original text-size setting was restored.
- Deploy `nudgeCircleMembers` before releasing the client. Production deployment and TestFlight distribution were not performed in this task.
