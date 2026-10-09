## Onboarding revamp, 2026-10-07

**Final result: passed** for the captured native visual comparison. Broader release verification remains incomplete, as listed below.

### Visual truth and normalization

The source is the latest approved onboarding mock set. Its app-content panels are preserved on the left side of `docs/onboarding-revamp/qa/comparison-suggestions.jpg`, `comparison-build-goal.jpg`, `comparison-profile.jpg`, and `comparison-ios-reminders.jpg`. Each file contains the actual approved source and its matching rendered native state together. These are comparison images, not recreated illustrations. Source app content is 390 x 844 pixels. iOS screenshots are 1206 x 2622 pixels, representing 402 x 874 points at 3x. Native comparison panels crop the OS safe areas (186 top and 102 bottom pixels), then scale width to 390 while preserving aspect ratio. The resulting native panel is 390 x 754 pixels. Height is not stretched to match the source. Android captures are 1080 x 2424 pixels from the emulator. Device chrome remains native.

State: light-theme Suggestions with the walking starter selected and an eligible public Circle; Build quantity 20 minutes with weekly four; combined profile with illustrative name and available username; iOS reminder preview. Native-only captures additionally cover weekly/monthly configuration, privacy, open seats, capacity, timezone, appearance, personal/shared Review, basic Build, Limit, type choice, joining, email and phone forms. `ios-limit-goal-final.png` is the post-fix dark Limit state with an inactive Build quantity choice retained. No fixture created a production Circle, uploaded a photo, sent an SMS, or requested OS permission. Temporary registration code was removed and the real app relaunched.

Full-view evidence: the four `comparison-*.jpg` files. Focused comparisons examined each source/native heading and Hoy bubble, selected recommendation card, custom alternative/input, amount/unit controls, profile fields/availability, and platform notification preview. These regions are readable in the paired captures. Configuration contact sheets 1 through 4 supplement those comparisons.

### Fidelity surfaces

- Typography: native HoystText uses the app's existing fonts, weights and text colors. The heading hierarchy, equally styled suggestion/custom headings, independent name/commitment fields, and per-Tap-In labels are retained. Native font rendering and minimum input sizes replace raster mock typography.
- Spacing: persistent footer actions stay outside the scroll area; OS safe areas and the keyboard are honored. Inputs use the app's existing radii and heights. The compact numeric Build layout keeps amount and unit together and the preview visible at the captured size. Longer configuration content scrolls.
- Color: the light canvas, lavender top tint, purple primary actions, semantic green selection, and tinted recommendation cards follow the approved direction. Dark captures use the app's existing dark surfaces and foregrounds. Solid native buttons replace the mock's gradient for consistency with current app controls.
- Assets: the actual Hoyst logo and existing raster Hoy are reused. Native emoji render Build, Limit and Avoid consistently with the rest of the app. The official Google sign-in mark is reused without alteration. Public Circle previews honor their stored appearance.
- Copy: screen subtitles and selected-interest chips are removed. Welcome actions, separated custom option, Goal for each Tap In, Tap Ins per week/month, optional photo, inline availability, privacy disclosure, and platform reminder preview match the approved behavior. Recommendations intentionally vary with the query, interests and current public availability.

### Comparison history and fixes

| Earlier finding | Fix | Post-fix evidence |
| --- | --- | --- |
| P1: Welcome rendered the icon instead of the Hoyst wordmark. | Use the existing logo BrandMark. | `ios-welcome-light.png` |
| P1: The modal presentation reduced usable wizard height. | Use full-screen native presentation. | All final configuration and comparison captures |
| P1: A conditional text child produced a native raw-text warning. | Correct conditional rendering. | Final live native flow and configuration sheets |
| P2: Numeric Build controls pushed its preview below the initial viewport. | Compact tracking choices and put amount/unit beside each other. | `comparison-build-goal.jpg`, `ios-build-goal-keyboard.png` |
| P2: A retained scroll position hid the goal heading after keyboard testing. | Reset the wizard scroll on step changes and recapture the neutral state. | `comparison-build-goal.jpg` |
| P2: Review's privacy disclosure could be missed below long details. | Place it beside the persistent review action. | `ios-review-light.png`, `ios-review-personal-light.png`, `android-review-light.png` |
| P2: Limit's emoji was omitted when an inactive Build quantity mode remained. | Scope the header suppression specifically to numeric Build. | `ios-limit-goal-final.png` |
| P2: Timezone offset display was inaccurate in Hermes. | Use Luxon timezone offsets. | `ios-timezone-light.png` and three timezone tests |

### Interactions and verification limits

Native iOS checks exercised the welcome/custom/starter configuration path, Save for later and Home resume, configuration choices, profile/auth forms without sending credentials, keyboard behavior, and review. Android light Review/reminder and dark goal rendering were captured and inspected. Automated tests cover journey ordering/skips, mode and pace retention, Review edits, migration, restart recovery, auth cancellation, retained invite/custom intent, duplicate submission prevention, permission opt-in, pending membership, full-Circle races and contextual composer handoff.

The Mac locked during the last interactive pass. Earlier captures and interactions remain valid; final code checks and the dark Limit capture were completed independently. Android's headless emulator was unavailable to the computer-use tool, so its gesture/back, keyboard, photo-picker and accessibility interactions are not claimed as verified. Small-screen/enlarged-text device checks and physical Apple/Google/SMS, photo picking/upload, OS permission delivery, and TestFlight checks remain release tasks. No store build was distributed.

### Follow-up polish

P3: The compact native Hoy and photo placeholder place more emphasis on fields than the generated mock. They reuse the current app's component scale. A later visual iteration can increase their emphasis if desired. Mock gradient/shadow refinements are optional because native controls deliberately use the current app's tokens.

### Implementation checklist

- [x] Shared native onboarding/create/invite configuration and explicit completion ownership.
- [x] Matched source/native visual comparison and post-fix captures.
- [x] Client/server validation, emulator checks, native Debug builds and selective backend deployment.
- [ ] Physical-device authentication, photos and notification delivery on an internal build.
- [ ] Android interaction and small-screen/enlarged-text accessibility pass before wider release.

final result: passed


## October 7 follow-up: Hoy messages and Welcome polish

The shared Hoy message surface and emphasized-text renderer now power Home and the complete onboarding scaffold, including configuration, account/profile, invite, recovery and completion states. Copy provides explicit emphasis phrases without formatting characters. Goal emphasizes the selected pace. Home's surface radius, padding, warm light shadow, black dark shadow and theme foreground are preserved; the existing Home interactions and onboarding's 58-point Hoy remain intact. At accessibility font scales of 1.6 or greater, onboarding stacks Hoy above the full-width message to keep text readable.

Welcome now has an opaque white card in light mode and Home's #1D1D20 card surface in dark mode, a subtle border and soft shadow. Get started remains the only filled button. The whole centered account prompt is tappable, with muted regular prompt text and a purple semibold Sign in span. Browse for now is a smaller muted link. The links have 44-point iOS and 48-point Android minimum targets and naturally wrapping text.

### Native evidence

- `qa/polish/ios-polish-matrix.jpg` and `qa/polish/android-polish-matrix.jpg` contain native Welcome, Suggestions, numeric Goal, Profile, account method selection and save-recovery states in both light and dark mode. All 24 full-resolution captures are in the same directory. Captures use production screen components with local, non-persistent fixture state and blocked submission gateways. No account, Circle, SMS, photo upload or OS permission was submitted.
- `qa/polish/home-message-comparison.jpg` puts the exact pre-polish Home component, the shared-renderer Home component and Welcome side by side at the same width. Home's message-area pixels are identical in the paired iOS captures, excluding status-bar time. The compared full-resolution region is x=0..1206 and y=160..650. Home's bubble/shadow/text and orb position are unchanged.
- `qa/polish/ios-welcome-small-light.png` and `qa/polish/android-welcome-small-light.png` render Welcome inside a 360-by-680-point content region. The message, preview and all three footer actions remain visible. This is a constrained native content viewport on the existing simulators, not a separate physical small device.

Native images were normalized by width without stretching height and visually inspected together. Light bubbles have Home's white surface, primary foreground, bold emphasis and warm shadow. Dark bubbles use Home's #252527 surface and light foreground. Welcome's preview is clearly separated from the canvas in both themes. The selected goal pace, profile instruction, saved account intent and recovery status have visible emphasis. The compact footer uses the approved hierarchy without secondary pill backgrounds.

### Behavior and automated verification

- App TypeScript checking and targeted ESLint passed with zero errors.
- Five focused Jest suites passed: create-circle-screen, circle-invite-screen, setup-journey, auth and auth-phone, totaling 131 tests. New checks exercise the Welcome footer's single filled button, original Sign in/Get started destinations, Browse preserving a deferred custom setup and stable identifier, and the actual monthly pace as the only goal-message emphasis.
- Home's existing suite passed 52 tests and retained the same two baseline failures: actorless activity meaning-icon expectation and the legacy PERSONAL label expectation. Neither failure is caused by the shared message extraction.
- Native iOS Get started, Interests skip, Suggestions selection and subsequent setup navigation were exercised. Existing navigation and draft persistence callbacks remain unchanged by this presentation update.

### Remaining verification

The Mac locked during the last interactive accessibility pass. One preferred-text-size increment was exercised and restored, but the full enlarged-text, wrapping, scroll and keyboard interaction checks could not be completed. Android rendering is verified in both themes; its footer gesture and keyboard pass remains pending. No claim is made that those blocked interaction checks passed. The temporary fixture registration was removed, the real entry point restored and both native apps cold-launched with their original persisted settings and setup intent.

Implementation and captured visual comparison: passed. Interactive accessibility/keyboard acceptance: needs follow-up after unlocking the Mac.

## October 7 follow-up: safe areas and Back controls

Earlier standalone polish captures did not exercise the real native modal boundaries. The actual onboarding route reproduced the reported overlap. The shared scaffold now measures each native screen locally, applies live top and horizontal insets once, and pads the footer by the bottom inset plus 8 points. A keyboard with positive height uses only the 8-point gap. Floating zero-height input toolbars retain the system inset. iOS owns keyboard avoidance; Android retains native adjustResize. Automatic scroll-view insets are disabled.

Back retains the existing transition handler and submission guards. Android subscribes only while focused, leaving covering authentication screens in control of Back. Navigation targets are 44 points on iOS and 48 on Android. Personal now uses the shared 40-point 👤 emoji with a purple surface. Larger text gets wider phase-label space.

### Actual native route checks

- [Before/after comparison](qa/safe-area/safe-area-comparison.jpg): actual iOS onboarding before/after and Android onboarding after. Both header controls clear the status area; Continue clears the system gesture area.
- iOS: Back returned from Mode to Suggestions with the selected starter retained. With the software keyboard open, the custom field scrolled into view and Make it mine stayed tappable above the keyboard. Five preferred-text-size increments were checked after a fresh app load. Heading/message wrapping, scrolling to Personal, and the persistent footer passed. Text size and keyboard preferences were restored.
- Android: Home's actual onboarding entry exercised Welcome, Interests, Suggestions and Mode in dark mode. The emoji, header and footer passed.
- Creation and invite: actual RootNavigator CreateCircle full-screen modal and CircleInvite routes were exercised on both native apps. Creation was inspected in iOS dark mode and Android light mode. Synthetic invite metadata was used locally with persistence disabled. Temporary navigation selected the real routes with their original providers and native boundaries, then was removed. No Circle was created or joined.
- Android hardware Back cancelled covering sign-in, returned to the retained invite Account step, then returned to the same invite preview. See android-auth-cancel.png and android-invite-back.png in the safe-area capture directory.
- Android's floating handwriting toolbar exposed a zero-height keyboard edge case. The footer fix and focused regression address it. Floating input rendering was inspected; it does not establish a docked-keyboard resize pass.

### Verification and limits

TypeScript and targeted ESLint passed. Seven affected suites passed with 154 tests: setup-journey-frame, create-circle-screen, circle-invite-screen, circular-emoji, setup-journey, auth and auth-phone. Added coverage checks nonzero/rotated insets, visible-keyboard mounting/dismissal, floating input, retained values and identifiers on Back, conditional skips, Review return, focused Android subscriptions and 👤 selection.

The smaller iPhone 17e simulator installed the Debug app but failed to launch it, including after a restart. Its actual-route checks remain unverified. Android docked-keyboard/enlarged-text interactions and the full theme/viewport matrix remain release QA tasks. Constrained standalone captures do not substitute for those checks. Original persisted setup intent and unrelated checkout changes were preserved. No backend or stored-data change was required.

Implementation, focused verification and completed native checks: passed. Full device matrix: incomplete as described above.

## Welcome heading and Fitness example, October 7, 2026

- Welcome now reads exactly `Let's get started..`. The featured example uses Fitness defaults for its emoji and Home's selected-card background rule: category backplate in light mode, category accent with `20` alpha in dark mode. Existing card geometry, border, shadow, copy and footer destinations remain unchanged.
- All 25 creation/wizard screen tests passed, including two new theme cases with a saved Mindfulness draft using a purple palette and sunflower emoji. The example stayed Fitness and the saved draft stayed unchanged. Type checking passed. Targeted lint reported 0 errors and 76 existing warnings.
- Inspected the actual RootNavigator → Auth → Welcome route on iPhone 17 Pro (iOS 26.5) and Pixel 10 emulator (API 37), in light and dark themes. Captures are in `qa/welcome-category/`. Android captures retain a development warning overlay; the changed heading and card are fully visible.
- iOS light verification used the normal guest Home entry. For remaining theme cases, a temporary app-start bootstrap opened the same native navigation route with an in-memory custom draft and theme override. Writes to setup, onboarding and settings persistence were disabled for these overrides. The bootstrap was removed and the original app entry restored. No backend actions or account submissions were performed.

### Welcome logo alignment and punctuation follow-up

The heading is now exactly `Let's get started!`, superseding the two-period wording above. Welcome retains the logo's existing rendered size and compensates locally for the black/white logo PNGs' transparent left gutters so the visible artwork aligns with the title. The shared BrandMark and Home are unchanged. Verified the normal iOS onboarding route via Fast Refresh; `qa/welcome-category/ios-logo-aligned.png` captures the result. All 25 wizard screen tests and type checking passed; targeted lint remains at 0 errors and 76 existing warnings. Android and native dark mode were not rechecked for this follow-up.

### Shared onboarding Hoy shadow

All screens using SetupJourneyFrame now render Hoy through the existing HoyOrb Home presentation, including its theme-aware radial ground shadow. The smiling artwork remains static at its previous 58-point image size and placement. Home and HoyOrb itself are unchanged. Verified Welcome in iOS Simulator light mode (`qa/hoy-shadow/ios-welcome-light.png`). Two new scaffold checks cover shadow tone in both themes and retained artwork size. All 64 tests across scaffold, wizard, invite screen and HoyOrb passed; type checking passed; targeted lint reported 0 errors and 4 existing warnings. Native Android and dark mode were not rechecked for this follow-up.

### Compact Interests skip link

Interests now opts into `tertiaryPresentation="link"` on SetupJourneyFrame. It reuses Welcome's muted 13/18 semibold centered text-link styling, existing footer spacing, and 44-point iOS / 48-dp Android minimum touch targets. Other steps retain their prior footer presentation. Skipping still clears interests and opens Suggestions.

Both themes were inspected through the native Auth → Welcome onboarding route on iPhone 17 Pro (iOS 26.5) and Pixel 10 emulator (API 37), at normal text size and enlarged text (iOS accessibility-large; Android font scale 1.3). The Skip link stays readable and above the system navigation area. A native iOS tap opened Suggestions. Captures are in `qa/compact-skip/`. Oversized iOS text also exposes wrapping and primary-action clipping in the unchanged grid/button layout; this narrowly scoped link change does not address those existing controls.

The iOS light normal-size check used the standard guest Home entry. Other theme checks used a temporary startup bootstrap opening the same native route with a local QA draft; setup/onboarding/settings writes were disabled for overrides. The bootstrap was removed, original source restored, and simulator text settings confirmed back at iOS large and Android 1.0. No account or Circle submissions occurred.

All 34 scaffold/wizard tests passed, including new light/dark Skip checks for presentation, transition, cleared interests, retained draft and stable request identifier. Type checking passed. Targeted lint reported 0 errors and 80 existing warnings.

### Category colors on Suggestions

Suggestion cards now take their tone from the same category/appearance resolver as their emoji. Curated starters use category defaults; public Circles honor stored appearance overrides. Backgrounds, label badges, selected borders and checkmarks use that palette in both themes. Fixed positional green/blue/purple/orange tones were removed only from the Suggestions calls. Ordering, geometry, shared choice defaults and Home remain unchanged.

All 48 wizard/journey tests passed. Six new cases cover light/dark starter colors, selected states, reordered interests, public Circle defaults and custom pink appearance, retained custom text, stable request identifiers and the join-preview handoff. Type checking passed; targeted lint reported 0 errors and 76 existing warnings.

Inspected starter and real public Circle cards through the native Auth → Welcome route on iPhone 17 Pro (iOS 26.5) and Pixel 10 emulator (API 37), in both themes. Captures are in `qa/suggestion-colors/`. The normal iOS light screen showed the live Fitness suggestion matching peach; remaining checks showed the General public Circle matching gray. Native iOS selection also applied the public Circle's palette to its border/checkmark. Custom public appearance overrides are covered by Jest rather than native fixture screenshots.

Remaining theme cases used a temporary app-start bootstrap opening the same native route with an in-memory draft and theme override. Setup/onboarding/settings persistence writes were disabled for the overrides; the bootstrap was removed, original app source restored and both apps cold-launched. No account, create or join submission occurred.

### Daily selected by default for new setups

New drafts now start with Daily and the existing daily frequency representation of seven days, displaying one Tap In each day. This supersedes the earlier Weekly default for fresh onboarding and regular creation. Choosing Weekly still initially selects four Tap Ins; Monthly still initially selects sixteen. Existing saved draft cadence/frequency, legacy normalization and stored Circles are not rewritten. Daily continues to skip the frequency screen.

All 147 wizard, journey, authentication and invite screen tests passed. Added checks cover Daily selection for both entry routes, Daily frequency skipping, unchanged saved Weekly/Monthly choices, stable submission IDs, and Weekly/Monthly initial counts after switching from Daily. Existing weekly-path and fresh onboarding-reset expectations were updated to distinguish the new default from a deliberately chosen Weekly pace. Type checking passed. Targeted lint reported zero errors and six existing warnings.

Confirmed native Android dark mode renders Daily selected for a fresh draft (`qa/daily-default/android-dark.png`). iOS displayed the Daily pace summary on the subsequent Goal screen; a direct native iOS Pace capture was not taken. The temporary bootstrap used a separate in-memory QA draft on the normal Auth → Welcome route, disabled preference/draft persistence writes, and performed no account or Circle submissions. Original app source was restored and both apps cold-launched afterward.

### Build preselection verified

Build was already the new-draft default and the commitment-type screen derives its selected card from that draft value. No production change was required. Saved Limit/Avoid choices and starter-provided types remain intact. Extended the existing fresh-setup tests to assert Build's selected radio card after Daily's Continue action in both onboarding and regular creation, plus Build in the initial draft. All 53 wizard/journey tests and type checking passed; targeted lint reported zero errors and six existing warnings. No native QA overrides or UI state changes were used for this verification.

### Shared Goal editor clarity

GoalEditor now uses icon-free green confirmation and blue amount-tracking choices. Build's amount field is above a full-width Unit group; Limit retains its paired Minimum and Maximum fields above the same group. The bordered Unit container includes its field, compact wrapping presets and helper. Preset targets are at least 44 points on iOS and 48 on Android. Matching ignores case and surrounding spaces without rewriting manually entered text. Disabled fields, choices and presets cannot change the draft.

Empty numeric units initialize to minutes once per commitment type during an editor visit. First activation of amount tracking also replaces the unconfigured confirmation sentinel with minutes. Existing starter/custom numeric units remain intact, including an explicitly numeric Tap In unit. Clearing a unit remains empty for validation during that visit and survives Build mode switches; reopening an empty numeric editor initializes it again. The new bordered Tap In preview separates For each Tap In from Pace. Existing numeric validation drives the incomplete-goal message, while pace stays visible. Submission, schema, backend and Home were unchanged.

All 77 tests across create-circle-screen, setup-journey and edit-circle-screen passed. New checks cover both wizard entry modes, minutes initialization, existing units, normalized preset matching, clearing, remounting, mode/type switching, locked controls, platform touch targets, semantic colors in both themes, target 1, invalid/incomplete amounts, Limit bounds and the shared editing screen. Existing journey coverage retains active-configuration submission checks. App type checking passed; targeted lint reported 0 errors and 21 warnings. The final whitespace check passed.

Native captures in `qa/goal-editor/`:

- `ios-light.png` checks the normal Home Finish setup route with the retained saved draft. `ios-dark.png` checks the actual Auth → Welcome route with a separate in-memory Goal draft.
- `ios-dark-enlarged-keyboard.png` checks accessibility-large text, Unit focus/scrolling and a reachable Continue action above the software keyboard.
- `ios-light-limit-preview.png` checks the full labeled Limit preview after selecting cups; the field, preset selection and preview update together.
- `android-dark-preview.png` checks the complete Build amount preview. Native selection of pages also updated the field and preview.
- `android-dark-enlarged-narrow.png` and `android-light-enlarged-narrow-limit.png` check both themes at font scale 1.3 and a narrower logical viewport using density 460. Presets wrap, the preview remains readable and footer actions clear the navigation area.

The remaining theme/Limit cases used a temporary app-start bootstrap opening the real native navigation route with persistence writes disabled for setup, onboarding and settings. The bootstrap was removed, the original app entry restored byte-for-byte, and both apps cold-launched. iOS preferred text size was restored to large; Android font scale was restored to 1.0 and its density override removed. No account, Circle creation or join submission occurred.

Native verification covers iPhone 17 Pro on iOS 26.5 and Pixel 10 emulator on API 37. Android's floating keyboard was inspected; a docked-keyboard pass remains unverified. No separate small iOS device or native commitment-editing/regular-creation route was exercised for this update; shared editor behavior in those routes is covered by automated screen tests. These are remaining device-matrix checks, not claimed passes.

### Open seats preselection verified

Open seats was already the new-draft default. The joining screen selects it directly from `joinMode: 'open'`, matching the supplied Simulator capture. No production change was needed. Four new screen cases verify its default selection and continuation in onboarding and regular creation, plus preservation of a saved Request approval choice and stable request identifiers. All 76 wizard/journey tests and type checking passed. Targeted lint reported zero errors. No new native override or persisted draft changes were made for this verification.

### Account method button presentation

SetupAuthForm now renders Google as an opaque white button with charcoal text and the existing multicolor G in both themes. Its 1-point gray stroke uses the existing brand gray token. A local, noninteractive stroke layer keeps it above the fill after native inspection showed the shared button's fill covering its outer border. This retains the existing button dimensions and avoids changing shared button defaults. Email and phone use solid app purple with matching borders, white text and white contextual icons. Apple remains unchanged. The shared form applies this presentation to onboarding and Sign in.

All 175 tests across setup-auth-form, create-circle-screen, auth, auth-phone and circle-invite-screen passed. The new form suite checks iOS/Android, both themes, creation/sign-in modes, icon colors, Google's stroke, unchanged Apple presentation, email/phone destinations, Back and disabled provider controls while an authentication request is pending. Type checking passed. Targeted lint reported zero errors and 10 warnings. No authentication service, navigation, persistence, backend or Home implementation changed.

Native verification used the actual onboarding and Sign in routes on iPhone 17 Pro (iOS 26.5) and Pixel 10 emulator (API 37). Both themes were inspected. Native iOS email and phone buttons opened their existing forms and Back returned to the provider list. Captures are in `qa/account-buttons/`. Android light/dark captures at font scale 1.3 and density 460 verify enlarged text and the narrower logical viewport for both routes. Buttons remain legible and clear the system gesture area.

iOS accessibility-large was exercised after a cold launch. It exposes the inherited provider layout's very large multiline labels and content extending below the scroll viewport. Automated scrolling did not establish a reliable full-provider inspection, so this enlarged iOS check is incomplete rather than a claimed pass. No separate small iOS device was checked. Provider prompts opened during attempted UI gestures were dismissed or cancelled by restarting the host app; no credentials, account creation or phone verification were submitted.

The initial iOS light checks used the user's normal saved onboarding route. Remaining theme checks used a separate in-memory draft on the same native Auth → Welcome route with setup, onboarding and settings persistence writes disabled. The temporary bootstrap was removed and the app entry restored byte-for-byte. iOS text size was confirmed restored to large; Android font scale to 1.0 and density to physical 420 with no override. Both apps were cold-launched afterward, retaining their original persisted preferences and setup intent.

### Clear completed saved setups

The shared completion handler now removes the active persisted journey after confirmed success and the user's exit choice. It captures the Circle and pending destination first, preserving Home, Circle Detail and contextual Tap In navigation. A pending approval request also completes the wizard. Profile-only setup exits after the reminder choice. Completing the first Tap In is optional.

Legacy draft data and resume flags are cleared only when the submission identifier matches; onboarding completion and account preferences remain. Saving regular creation no longer overwrites another legacy draft. Legacy migration requires a pending setup, so a previously completed mirror cannot repopulate a new wizard. Hydration removes old completed journey records but retains saved journeys whose completion screen has not yet been exited and preserves uncertain-save recovery data.

Only explicit draft initialization can create a missing record. A completed wizard also ignores later patches and initialization, preventing late reminder callbacks or duplicate completion actions from recreating it. Unfinished and unrelated records remain intact.

All 208 tests across setup-journey-store, create-circle-screen, circle-invite-screen, setup-journey, auth, auth-phone, circle-invite-coordinator and circle-invite passed. Added coverage checks creation in both entry modes, profile-only completion, active and pending invite joins, future Tap In windows, all completion destinations, Finish setup removal, restart/rehydration, identifier-matched legacy cleanup, fresh reopening, duplicate exit and late callback behavior. Existing cancellation, Save for later, failure and idempotent retry checks also pass. Type checking passed. Targeted lint reported zero errors and 81 existing warnings; the whitespace check passed. Native devices were not re-exercised for this persistence-only change. No backend, stored-schema or Home presentation changes were made.

### Blue shared setup presentation

Shared setup opts into a local blue palette: #086CA8 filled actions with white text, readable blue links, #18B9FF selection accents and pale blue top tints. Onboarding, regular creation, invite setup, Sign in and shared editing controls use it. Generic Personal/private/joining choices use blue. Category/custom commitment palettes and appearance swatches remain authoritative, including purple. Green, orange and red choices retain their meaning. Apple and Google keep their existing provider treatments; email and phone now use blue.

A separate transparent friendly blue Hoy asset is supplied through an optional HoyOrb artwork override. The default Home asset map, state behavior, artwork size and Home shadow presentation are retained. Setup message surfaces, emphasis and text remain unchanged. The timezone picker and setup progress bar have optional local color overrides whose default behavior is unchanged. No Home, Explore, global theme/button defaults, backend or stored-data logic was changed for this presentation update.

All 238 tests in 12 suites passed: setup-presentation, setup-auth-form, setup-journey-frame, hoy-orb, create-circle-screen, edit-circle-screen, commitment-setup-scaffold, setup-progress-bar, commitment-appearance-control, auth, auth-phone and circle-invite-screen. New assertions verify light/dark blue actions and tints, provider colors in both account modes/platforms, generic choices, blue editing actions, setup artwork and unchanged default Home sources/global/category palettes. Existing category/custom appearance, goal, navigation, disabled-control and authentication tests pass. Type checking and whitespace checks passed. Targeted lint reported zero errors and 106 warnings.

Native captures in `qa/blue-setup/` inspect the actual Auth/Welcome and Sign in routes on iPhone 17 Pro (iOS 26.5) and Pixel 10 emulator (API 37). Welcome and Goal were inspected in both themes; Sign in was inspected in both themes on iOS and dark mode on Android. The iOS Goal footer remains above the software keyboard. Enlarged Goal checks use iOS extra-extra-large and Android font scale 1.3 with density 460; Android's dark Sign in and light Welcome remain legible in this narrower configuration. The original iOS dark Sign in check used the normal app; later theme/Goal checks used temporary in-memory fixtures with settings/setup/onboarding persistence writes disabled.

The full native route matrix is not claimed complete: regular creation, invite configuration, editing, profile, recovery and completion were covered through automated screens/shared presentation but not independently visited on devices for this update. Android's software-keyboard check remained incomplete because focusing the email field displayed its floating hardware-input toolbar. iOS Goal initially positions part of the focused Unit field beneath the fixed footer, requiring additional scrolling; its footer itself remains reachable. Largest accessibility text settings and a separate small iOS device were not checked.

The temporary QA bootstrap was removed and the app entry restored byte-for-byte. Both apps were cold-launched. iOS content size was restored to large; Android font scale to 1.0 and density to physical 420 with no override. App preference and draft writes were disabled during the temporary fixtures. No account, join, creation, verification or reminder-permission submissions were made during native checks.
