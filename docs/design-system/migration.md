# App migration inventory

Status: **in progress**. Circles completed its first design-system migration on September 8, 2026. The remaining inventory is based on current navigator registrations and screen/component source at the reference revision. Visual audits happen at the start of each wave. Home and the existing bottom tab bar are excluded permanently unless separately authorized.

## Completed migration

**Circles:** Uses the warm canvas, compact navigation, exact Home heading and supporting-text roles, four-way status filter, urgency/name/progress sorting, full focused commitment cards, compact past-circle rows, and design-system loading/error/empty feedback. It preserves existing subscriptions, personal/group distinctions, Tap In, Nudge, Share, Circle Detail, past-circle, Create, and Explore destinations. See the validation ledger for tested and device-checked coverage.

## Delivery sequence

**Tap In composer, September 9:** Implementation and focused regression checks are complete. The composer uses a local provider, measured category fade, glowing primary action, compact quantity controls and an opt-in details editor. Native iOS fixtures cover both themes, expanded editing, keyboard clearance and enlarged text. Android visual/accessibility and narrow-device checks remain open. Completion, story share and picker retain their existing presentation. See [the scoped guide](tap-in-composer.md).

| Wave | Route / surface | Presentation work | Behavior that must remain intact |
| --- | --- | --- | --- |
| 1 | Circles | Compact list, section/filter controls, action and navigation targets | Sorting, circle/personal distinctions, membership gating, Tap In/Nudge |
| 1 | CircleDetail | Header, commitment/context, participation/member views, history and thread | Join/pending approval, member selection, reminders, edit/delete saved Tap In, message/photo actions |
| 1 | TapInPicker | List density, grouped headings, selection/action controls | Current selection, eligibility, source route and circle focus |
| 1 | TapInComposer | Sheet typography, inputs, options, safe-area/keyboard spacing | Sheet detents, scrolling, save/update/delete, skip/partial/failed/done values, quantity units and photo/note handling |
| 1 | TapInComplete | Compact supporting UI, prominent outcome where justified | One-shot celebration, momentum feedback, source-aware return, edit details and share |
| 1 | TapInStoryShare | Controls surrounding share preview | Exact export dimensions, image capture, invite URL, native share/copy behavior; artwork is a specialist exception |
| 2 | CreateCircle | Wizard scaffold, fields, category/type selection, summaries | Step validation, cadence/frequency/timezone options, personal/circle mode, invitations and submit |
| 2 | EditCircle | Same form components and rhythm as CreateCircle | Existing data, permissions, unsaved-change prompt and save behavior |
| 2 | CircleTools | Compact settings rows, destructive action grouping | Ownership checks, archive/restore, leave/transfer/delete semantics |
| 2 | ConvertPersonalCircle | Explanation, conversion fields and summary | Conversion rules, member capacity, invitations and sharing |
| 2 | CircleInvite | Invite summary, guest/pending/member presentation | Deep-link handling, authentication handoff, join/resume destination |
| 2 | ArchivedCircles | Quiet archive list, status and restoration controls | Owner/member permissions, restore and leave behavior |
| 2 | PastCircle | Read-only summary, history, media | Historical values and access rules; no active-action affordance |
| 3 | Explore | Discovery cards, search, category filters, empty results | Public discovery, filters, previews, existing navigation and join eligibility |
| 3 | Inbox | Compact activity/notification rows, timestamps, media | Read/unread handling, event semantics, pagination, deep-link destinations |
| 4 | Momentum | Compact explanatory text and summary surfaces | Existing scores, date selection, eligibility, calendar/chart semantics and achievement tiers |
| 5 | Profile | Compact stats/settings rows and grouped headings | Guest/account states, notification preferences, appearance, sign-out and account gating |
| 5 | EditProfile | Shared labeled fields, photo control, save/error handling | Profile validation, photo permissions, timezone, authentication identity |
| 5 | Welcome | Compact supporting forms with expressive artwork exceptions | Registration/onboarding steps, returning-member entry, provider authentication and profile completion |
| 5 | SignIn | Labels, inputs, controls and readable error states | Email/phone/SMS, Apple/Google, provider recovery, reset and entry-point return |
| 5 | Loading (RootNavigator) | Neutral loading surface | Hydration/auth state resolution, no guest flash or fabricated statistics |
| Excluded | Home | Reference only | Entire screen, all states, dependencies and daily actions remain unchanged |
| Excluded | MainTabs / central Tap In affordance | Keep existing tab bar | Five-tab structure, selected state, floating clearance, central action routing |
| Wrapper | Auth stack | Audit modal bounds while migrating child screens | Existing modal registration, dismissal and authentication handoff |

Circles is migrated. Every other entry remains **not migrated**. Track implementation PR, before/after evidence, component variants used, tests and remaining limitations for each entry when its wave begins.

## Modal, sheet and embedded inventory

| Surface | Wave | Checks |
| --- | --- | --- |
| TapInPicker native-stack modal | 1 | Dismissal, list scrolling, selected circle and safe areas |
| TapInComposer native sheet | 1 | Detents, keyboard resizing, multiline fields, buttons above obstruction |
| CircleDetail member actions and join-request review alerts | 1 | Member context, permitted actions, cancel and destructive confirmation |
| Circle thread, message composition and media controls | 1 | List/keyboard interaction, send/error state, photo visibility, reply/edit/delete semantics |
| TapInDetailsSection and photo source prompts | 1 | Dirty notes/photos, discard/save errors, camera/library permissions |
| Native share/copy sheets and media preview | 1/2 | Preserve OS controls, exported assets, invite link and cancellation |
| Create/Edit commitment setup fields and step scaffold | 2 | Every step, disabled submit, validation, cadence/type-specific controls |
| DeleteCircleConfirmModal | 2 | Explicit confirmation, cancel/back, pending request and failure |
| Archive/restore/leave/transfer/discard alerts | 2 | Keep native alert semantics, destructive labels and server permissions |
| Profile AppearancePreferenceModal | 5 | Light/system/dark selection, persistence, cancellation |
| Profile DeleteAccountConfirmModal | 5 | Confirmation copy, pending/errors, cancel/back and existing deletion rules |
| TimezonePicker search modal | 2/5 | Shared by forms/onboarding; search, long names, selected value, close and keyboard |
| Welcome embedded onboarding steps and provider recovery | 5 | Artwork, email/phone/SMS/profile/photo steps, incomplete account states |
| Authentication reset/provider/permission/error alerts | 5 | Preserve provider guidance, error meaning and entry-point destinations |
| System photo, push permission and native authentication dialogs | As encountered | OS-owned surfaces retain native styling. Audit surrounding explanations and return paths. |

Do not restyle shared fields while they still serve an unmigrated flow unless a new opt-in variant is used. Do not replace native alerts with custom dialogs simply for visual consistency.

## Required states per migrated flow

- Initial authentication/loading: neutral placeholders, no flash of guest content or false zero values.
- Refresh with known content: retain the last resolved content and show quiet pending feedback.
- Failure: readable explanation and working retry; no implication of completion.
- Empty data/search/activity: helpful explanation and appropriate discovery/reset action.
- Guest/incomplete profile: preserve copy, existing artwork, authentication handoff and gates; no fabricated personal progress.
- Pending memberships: explicit status, details access, no inappropriate action or daily-action credit.
- Actionable/mixed/completed commitments: distinct Tap In/Nudge actions, pending duplicate protection, preserved completion semantics and list order.
- Long titles, messages, categories and translated-sized labels; missing/failed images; very large statistics.
- Narrow layouts, enlarged text, both themes, keyboard open/closed, safe-area and floating-control clearance.

## Per-wave implementation procedure

1. Capture every route and modal before changes, including below the fold. Record known functional tests and visual exceptions.
2. Adopt the system through a screen-local provider using the current appearance preference. Keep controllers, services and navigation parameters unchanged.
3. Compose existing primitives and domain artwork. Add a shared variant only when there is a concrete repeated need. Document any expressive exception.
4. Exercise real row/action/detail flows and their failure paths. For Tap In and Nudge, use safe test accounts or mocks rather than submit production actions for visual QA.
5. Check every state above that applies, on iOS and Android. Review full-scroll screenshots, accessibility order and keyboard behavior.
6. Run focused regression tests, TypeScript, changed-file lint and the frozen-reference check. Review the diff for changes to Home dependencies.
7. Record evidence and sign off the wave before expanding to the next. Production deployment/distribution is a separate release decision.

No backend schema, scoring, deduplication, notification or authentication changes are part of this visual migration. If one is needed for another reason, separate it from the design-system adoption.
