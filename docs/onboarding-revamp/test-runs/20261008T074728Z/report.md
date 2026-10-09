# iOS onboarding critical-path test run

Run: 20261008T074728Z. Backend: hoyst-firebase-app. Google excluded. **Current status: returning Apple/phone sign-in, wrong-code recovery, native Avoid creation/Tap In with proof photo, and existing goal/name editing passed. Both completed journey records are cleared. The Mac locked before interrupted-save recovery setup could begin. Two QA accounts, two private commitments and one proof photo remain for further testing and cleanup. Full matrix remains incomplete.** No product fixes or deployments were performed.

## Environment

Dedicated iPhone 17 Pro and iPhone 16e QA Simulators preserve the user's existing Simulator data. Both devices were exercised. The smaller device required about five minutes to boot; the primary QA simulator was shut down to reduce host load. Cached preview packaging did not provide an authentication-qualified baseline, and manually re-signed copies failed to launch. A fresh Xcode Debug build with temporary Simulator signing entitlements launched successfully. Signing overrides and helper scripts were confined to temporary QA artifacts. Simulator entitlement packaging differs from the ordinary codesign entitlement blob; SDK session persistence passed a cold restart on the primary QA device.

Source revision and working-tree fingerprint are in `inventory.json`. The product diff was verified unchanged after testing. The same working-tree JavaScript was served by the existing Metro instance.

## Coverage ledger

| Scenario | Result | Evidence / limits |
| --- | --- | --- |
| Fresh onboarding and interests | Native passed | Started from Guest Home; selected three interests; fourth rejected; Skip continued to Suggestions. `evidence/interests-limit.png` |
| Starter/custom selection | Native passed | Typed custom text, selected the reading starter, then restored both after restart. Chose custom text again. |
| Save for later and restart | Native passed | Home displayed Finish setup; cold app restart/build reinstall retained selected starter and custom text. |
| Personal/shared choice | Native passed | Shared was initially selected. Personal and shared branches both completed natively. |
| Pace/frequency | Native passed for exercised paths | Daily initially selected; Weekly default 4; changed to 5; Monthly default 16; returning to Weekly retained 5. Daily skipped frequency. |
| Build Goal editor | Native passed for exercised paths | Build initially selected; custom selected Just show up; amount mode retained starter amount/unit. Set numeric target 1, matched mixed-case unit to preset, cleared unit, verified incomplete preview and blocked advancement, then restored unit. Mode switching retained amount 1 and unit. |
| Limit/Avoid configuration | Live service and automated passed | Monthly Limit 0–2 with 16 opportunities; personal Avoid. Native Monthly Limit range validation and creation passed. Avoid remains service-only. |
| Name, timezone, appearance and Review | Native passed | Independent personal name, retained commitment text, selected London timezone, preserved a purple appearance override, edited name from Review and returned directly to Review. Personal skipped access/capacity. `evidence/personal-review.png` |
| Authentication cancellation | Native passed | Account Back returned to Review with all configured values. |
| Email registration | Native passed | Empty form disabled; malformed email returned an inline error; valid disposable account reached Working. Auth lookup confirms the account was created. The resumed app reached Profile, saved it, completed the personal commitment and retained authentication across a cold restart. |
| Apple authentication | Native authentication passed; profile handoff failed | User manually signed the QA device into the Japan sandbox tester and authorized its use. Hoyst Apple authorization/password succeeded; backend apple.com provider verified. Profile Save returned Home before Reminders (BUG-06); Finish setup recovered the remaining step. Returning Apple sign-in still needs testing. |
| Phone authentication | Native SMS verification and profile-only completion passed | User-authorized number had no preexisting Hoyst account. SMS code verified and profile-only setup reached Home. Wrong/expired code, resend and returning-phone sign-in remain pending. |
| Combined profile and photos | Native passed for exercised paths | Live username conflict and explicit no-photo profile behavior passed. Native photo cancellation retained inputs; imported blue Hoy photo selection/upload passed. Native taken-username rejection and no-photo profile completion also passed on the smaller device. |
| Discovery/joining | Live service passed | Guest suggestions returned the eligible QA public Circle. Active joining, repeated membership, full-Circle rejection and pending approval passed. Native QA invite preview, Sign in, Profile, pending approval completion and View Circle passed. Active invite joining, full-state recovery and future-window completion also passed natively on the primary device. Repeated invite for an active member incorrectly shows Full (BUG-04). Unavailable invite crashes (BUG-05). |
| Creation metadata and retries | Live service passed | Numeric Build target 1 retained quantity mode; capacity 2 included owner; same requestId returned same Circle. Onboarding completeProfile honored capacity 2 and replayed the same setupId without duplication. |
| Numeric Tap In/privacy | Live service passed | Numeric target 1: currentValue 0 returned partial, then 1 returned covered. A private QA note did not appear in guest suggestions. Native quantity-one composer handoff and covered Tap In passed. Public photo privacy remains unverified. |
| Reminders and completion cleanup | Native passed for exercised paths | Not now continued with no OS prompt. Enable reminders explicitly showed the iOS permission prompt; Don’t Allow continued to pending completion. Personal and regular creation cleared their records on completion exit. Invite exit cleared only its record and retained another custom draft. First Tap In and View Circle destinations passed. |
| Themes/keyboard/accessibility/small screen | Native incomplete | Primary device dark mode and hardware text input exercised. Smaller device, Light mode and Accessibility Large were exercised. Enlarged text exposed BUG-02. Software keyboard exposed hidden focused input (BUG-03). VoiceOver and the full matrix remain pending. |
| Automated regression checks | Passed | 220 tests in 9 Jest suites; app type checking passed. Functions compiled to temporary output. 10 isolated Firestore emulator tests passed against that output. |
| Live service checks | Passed | 10 functional scenarios across `service-results.json` and `onboarding-service-results.json`, plus cleanup calls. API results are not claimed as native UI coverage. |

## Findings for later work

### OBS-01: Authentication error copy exposes a Firebase identifier (P3 polish)

On account creation, enter `not-an-email` and a password meeting the length requirement, then submit. The error is `[auth/invalid-email] The email address is badly formatted.` Validation correctly prevents registration. The technical prefix is unnecessary in user-facing copy. Evidence: native accessibility result captured during this run. No fix applied.

### OBS-02: Known unit preset remains plural for an amount of one (P3 polish)

Build → Track an amount → Amount 1 → pages preset. Preview reads `At least 1 pages`. Numeric meaning remains correct; manually entering `page` produces the expected singular copy. Evidence: native accessibility result during Goal mode-switching checks. No fix applied.

A functional cleanup defect was confirmed in the live deletion check, documented below. Unrun/blocked paths are not passes. These observations do not constitute release acceptance.

### BUG-01: Account deletion leaves a private momentum subdocument after a Tap In (P2)

Create a disposable account and an onboarding Circle with a numeric goal of 1. Submit currentValue 0 (partial), then 1 (covered), and delete the account through the existing deleteAccount service. Auth, profile, handle, Circle and discovery entry were absent afterward, but userPrivate/{uid}/momentum/current still existed beneath the missing private root. The residual document contained momentum/streak/opportunity projection fields. Evidence: residual-momentum.json and the initial cleanup verification.

A second existing-service deletion call returned deleted: true and removed the remaining document. Verification more than two minutes after that retry found no private subcollections. Root cause is not confirmed; asynchronous projection recreation is a hypothesis for later investigation. No source fix or manual database purge was applied.

## Cleanup ledger

Four service-created Auth accounts and four QA Circles were removed through the existing account deletion service. Initial verification confirmed removal of Auth records, profiles, handles, private roots, owned Circles and discovery entries, but found a remaining momentum subdocument for one deleted actor. A second call to the existing deletion service removed it; a later read confirmed no remaining private subcollections. See `cleanup-verification.json`, `private-cleanup-verification.json`, `residual-momentum.json`, `cleanup-retry.json` and `cleanup-verification-after-retry.json`. The service scenarios uploaded no media. Temporary service credentials were removed after verification.

One native email account remains **retained for resuming the interrupted journey**: actor `email-main`, UID recorded in `inventory.json`, with two native commitments now submitted. It must be cleaned up after the remaining native tests or if this run is cancelled. Its password is not stored in the report or repository. Dedicated QA Simulator state remains available for resume. The external Apple test identity was not changed or deleted.

## Resume requirements

1. Unlock the Mac again to complete remaining native routes and delete the primary disposable account through its authenticated app session.
2. Provide the dedicated phone number and SMS handoff when phone testing is reached.
3. Complete native active/open/full/unavailable invite states, future-window completion, returning complete-profile sign-in, password recovery and save-failure recovery. Shared setup, pending approval, reminders, eligible completion, first Tap In and selective persisted-draft cleanup have passed.
4. Complete the light/dark, software-keyboard, enlarged-text and smaller-device matrix, then remove the retained native account and any new fixtures.

## Resumed native pass

The Mac was unlocked and the authenticated Profile screen resumed with the pending personal draft. Photo-picker cancellation retained form values; an imported blue Hoy image was selected and uploaded successfully. Username availability, profile saving, Reminders Not now, eligible completion, contextual quantity-one Tap In, and Done to Home passed. No automatic notification dialog appeared before the explicit reminders choice. Backend evidence confirms the profile photo, independent personal title and quantity goal 1.

After leaving completion, the persisted setup journey records were empty and Home showed no Finish setup. A cold app restart retained authentication, the completed Tap In and the absence of Finish setup.

Regular creation skipped Welcome/interests/account/profile. Shared Money commitment: Daily/Build defaults, Monthly 16, Limit 0 to 1 cups, reversed-range validation, Public default, Open seats default, approval selection, capacity 2, and London timezone passed. Back from capacity retained the value and skipped the nonapplicable join step for Link only. Review reflected Public / Request approval / capacity 2. Creation succeeded; Not now returned Home without a Tap In. Backend metadata and fixture IDs are recorded in native-owned-circles.json and inventory.json.

No product fixes were applied. The native account and two owned QA commitments remain pending cleanup while additional routes are exercised.

The iPhone 16e simulator boot completed after a resource-delay interruption. Guest Welcome and Sign in rendered on the actual route. Apple presented the iOS Settings account prerequisite; cancellation exposed raw AuthorizationError 1000 (OBS-03). Phone form and method cancellation were exercised without sending SMS.

A saved custom onboarding draft coexisted with an incoming QA approval invite. Accept invite → email Sign in → required Profile retained the join intent. A taken username displayed an inline error and disabled Save; an available username enabled it. No-photo profile save succeeded. Enable reminders showed the iOS permission prompt only after the explicit tap. Don’t Allow continued to “Your request is in”. View Circle reached the matching pending Circle with Tap In disabled. The invite record was removed on completion exit, while the unrelated onboarding custom text and stable requestId remained. See native-invite-store-before-exit.json and native-invite-store-after-exit.json.

App Light mode was selected via Preferences. Suggestions showed category surfaces, blue accent/Hoy and retained custom text on the smaller device. Accessibility Large revealed clipped heading/section/badge text (BUG-02). Default size was restored after capturing evidence. Phone verification, Apple success, Android and the remaining keyboard/recovery matrix remain unverified.

Current blocking state: the UI tool reported the Mac locked again during the restored-size Suggestions check. No unlock bypass was attempted. The primary QA account and its two owned commitments remain for authenticated cleanup; the new invite-member cleanup is recorded separately. No product source changes, fixes or deployments were made.

Cleanup update: the disposable invite member was deleted through deleteAccount. Auth, profile, handle, private root, momentum and pending membership were absent afterward. A later read found no private subcollections and no pending join-request document. Its temporary credential file and UI-runtime binding were cleared. Five disposable accounts have now been removed across this run; the primary native account and its two owned Circles remain for authenticated cleanup after unlock. See native-member-cleanup.json and native-member-cleanup-later.json.

Additional findings from the resumed pass are in bugs.md: BUG-02 enlarged-text clipping, OBS-03 raw Apple cancellation error and OBS-04 owner-style wording shown to a pending member.

## Third native pass after unlock

Normal text size and Light mode were retained on the smaller simulator. Opening the software keyboard on Suggestions left Make it mine reachable above the keyboard but largely hid the focused custom field behind the footer (BUG-03). Screenshot captured. The smaller QA simulator was shut down before starting the primary to reduce resource use.

Two isolated private QA invitation Circles and two disposable fixture accounts were created. A full two-seat Circle displayed the correct full-state recovery; Find another Circle returned Suggestions. An existing complete-profile account accepted the remaining seat in the second Circle without Account/Profile screens, and received “You’re in” with future-window wording. Go to Home completed that journey. Reopening its invite incorrectly showed Full despite backend-confirmed active membership (BUG-04).

A valid-format nonexistent invite opened from Home caused “Maximum update depth exceeded” and a blank screen (BUG-05). A cold restart reproduced it. The setup/invite persisted state was captured; only the pending-invite key in the dedicated QA simulator was reset to recover Home for cleanup. Product source and unfinished journey records were not changed.

The two new accounts/Circles were deleted through the existing service. Final verification found seven deleted accounts with no Auth records, profiles, private roots or private subcollections; six QA Circles were absent. The remaining primary account still owns its two QA commitments and one uploaded avatar. Its Delete account screen is prepared for the exact handle qa074728native and awaiting required final confirmation. See final-cleanup-verification.json.

Tracked product diff fingerprint remains unchanged. No bug fixes, source edits or deployments occurred. Apple success/SMS/Android/VoiceOver, password recovery and explicit save-error recovery remain incomplete. Google stays excluded. The unavailable-invite failure blocks release acceptance for this tested path.

## Confirmed final cleanup

The user confirmed primary-account deletion. The native app reported Account deleted. Auth, profile, private root, owned Circles, discovery indexes and uploaded avatar were gone, but userPrivate/{primaryQaUid}/momentum/current remained. This independently reproduced BUG-01 through the native deletion flow. Captured primary-deletion-service-verification.json and native-primary-residual-momentum.json, then explicitly deleted that QA-only orphan with the authorized admin cleanup API. No product code was changed.

Final verification found all eight Auth accounts, eight QA Circles and indexes absent; all eight private subtrees had no remaining collections, and the primary avatar storage prefix contained zero objects. See final-cleanup-verification.json and native-primary-orphan-cleanup.json. All external test fixtures from this run are cleaned.

The full test matrix is still incomplete: Apple provider success, SMS verification, Android, VoiceOver, password recovery, returning complete-profile email Sign in and explicit save-error recovery were not completed. Google was explicitly excluded. Unavailable invite, repeated active-member invite, enlarged-text and focused-keyboard defects remain documented and unfixed. Existing 220 Jest checks, type checking, Functions compilation and 10 emulator checks passed earlier in this run; they were not rerun after documentation-only updates.

## Continued testing with authorized SMS number

The supplied test number had no existing Hoyst Auth account before testing. Hoyst requested an SMS, the user supplied its code, and verification succeeded into the combined Profile screen. The new phone actor is recorded in inventory.json using a masked number label. The code and temporary verification credentials are not in the report. Profile-only completion with an available username and no photo reached Home without creating a commitment or leaving setup records. Enable reminders showed the iOS OS prompt, Allow continued successfully. Actual reminder delivery is still untested. The phone account remains for completing the remaining native paths and cleanup.

Apple Notes' Sandbox Tester credentials were tried only in QA iOS Settings. Apple accepted them up to its iCloud and Apple Media Services Terms screen. Confirmation to accept those legally binding terms was requested and remains pending. Sign in with Apple inside Hoyst has not yet succeeded. No external Apple identity was deleted or changed.

Targeted ESLint on seven onboarding/auth/store files completed with zero errors and 113 warnings; no fixes were applied. Android assembleDebug succeeded. A fresh isolated QA AVD was configured without copying existing user data, and the current APK installed and launched on emulator-5556. Native UI verification remains blocked because the computer-use tool could not attach to Android Studio's embedded window or the standalone emulator application. Build/install/start are not counted as Android flow passes.

The 16 existing momentum-schedule Jest tests passed. Ten additional helper-level assertions passed for February 28 days, leap February 29 days, 30/31-day months, counts 16/31, unique contiguous windows bounded to the month, and month selection across New York/Kiritimati timezones. These do not verify a live or native month rollover. See calendar-boundary-results.json.

A personal Work-category Avoid draft was started with verified name QA Phone Avoid and commitment Avoid QA distractions. The Mac locked during its Daily-to-type transition. Native Avoid creation/Tap In and editing remain incomplete. The UI tool requires manual unlock; no bypass was attempted. Product code remains unchanged.

The dedicated Android QA emulator was shut down after its native UI attachment blocker to reduce resource use. The original Android emulator, physical Android device and original iOS simulator were not reset. No SMS verification code remains in persisted setup journeys.

## Apple testing after user-assisted device sign-in

The first Notes candidate later showed an Apple Settings credential error. Apple3 credentials were submitted, but their success was not established: the user separately signed the device in manually using the Japan sandbox tester. The user explicitly authorized continued Hoyst testing with that signed-in account. No Apple Terms were accepted by the agent.

The phone account’s draft was saved before signing out. Hoyst’s Apple sheet presented, Share My Email was selected, and the matching Japan password from Notes authenticated successfully. A new Hoyst account with apple.com provider was verified; its UID and new-account status are in apple-verification-result.json. The external Apple identity is retained. No password is stored in the QA report.

The Apple profile Save and continue returned Home before the remaining Reminders step, leaving an Apple-owned saved reminders record and Finish setup entry (BUG-06). That banner reopened Reminders; Not now completed the profile-only journey and removed its record. The separate phone draft and requestId remained unchanged and were hidden from the Apple account’s banner. See apple-profile-finish-store.json, apple-resumed-completion-store.json and the associated screenshots.

A separate personal General commitment, QA Apple show up, was created with Daily pace and Build confirmation. Review showed Confirm you did it; backend stored buildTrackingMode confirmation, targetValue 1 and canonical unit Tap In. Its contextual composer had no quantity controls. Tap In completed, awarded XP/streak, and Done returned Home.

Existing commitment editing was opened through Circle detail → Settings → Edit Commitment. Switching this unconfigured confirmation goal to amount tracking correctly initialized amount 1 and minutes, with the minutes preset selected. Further validation, mode retention, independent-name saving and historical snapshot checks are not yet complete: the Mac locked before the next action. The pre-edit confirmation Tap In snapshot was captured in confirmation-snapshot-before-edit.json. No edit was saved.

## Existing editor checks after unlock

The existing personal commitment editor retained its unsaved amount-tracking state. Mixed-case unit text with surrounding spaces selected the pages preset. Amount 0 displayed an incomplete preview and disabled Save. Restoring 1 enabled Save; clearing Unit disabled it again. Switching to confirmation and back retained amount 1 and the empty unit within the same visit. A custom unit page selected no preset and enabled Save.

The personal name was changed independently to QA Apple Edited Name; its commitment remained QA Apple show up. Saving disabled the tracking choices, inputs and preset controls while busy, then returned to Settings. Backend verification confirms quantity mode, numeric target 1, unit page and the independent title. Every field of the earlier confirmation Tap In was unchanged. See native-editor-verification.json and confirmation-snapshot-before-edit.json / confirmation-snapshot-after-edit.json. Circle detail displayed the new title and 1 page goal.

Returning Apple sign-in was started after a normal Hoyst sign-out. The Apple introduction sheet appeared, but the UI tool repeatedly could not target the QA window for coordinate clicks. The QA window was re-selected and centered without changing product code or the original simulator's data. The Mac then locked again. This is a tooling/environment blocker, not a new app failure or a returning-auth pass. Rebinding the UI tool after the QA window is foreground is the next recovery step. No new SMS was requested in this pass.

## Returning-user and Avoid pass

Rebinding the computer-use runtime to the foreground QA simulator resolved the earlier coordinate-targeting problem. Returning Apple sign-in authenticated the existing Japan tester and went directly Home without Profile or Reminders, retaining QA Apple Edited Name and the numeric goal of 1 page.

A fresh SMS request was made for the authorized test number. One incorrect code was rejected and controls were restored; the raw SDK error is added to OBS-01. The supplied valid code then authenticated successfully without another SMS. Returning phone sign-in skipped Profile and restored the saved draft. No verification code is stored in this report.

The phone draft retained its personal name/statement, Daily pace, Work category, blue appearance and New York timezone. Selecting Avoid skipped numeric goal entry and shared access steps. Review reflected Confirm you stayed clear. Creation succeeded and the contextual composer had confirmation controls without quantity inputs. The imported blue Hoy asset was selected as optional proof. Upload/submission succeeded with status done and coverageStatus covered; Home showed the completed Tap In. The private Circle and proof URL were excluded from guest suggestions. This verifies personal/private exclusion, not the full public-Circle photo-preview matrix. See returning-phone-result.json, returning-apple-result.json and avoid-proof-verification.json.

Completed setup records were removed (phone-avoid-completion-store.json). Interrupted-save recovery was planned using a controlled lost-acknowledgement fixture, but the Mac locked before that fixture could be created. That check remains unrun. Password recovery remains waiting on a test inbox and user-managed password change. No new app bug was confirmed beyond the additional OBS-01 SMS example, and no source fixes were applied.


## Controlled interrupted-save recovery

Created private personal QA Recovery through the actual signed-in creation route with Daily, Build confirmation. After server-confirmed completion, terminated only the QA app and changed only its persisted journey to saving/review with the result removed, preserving requestId and submittedDraft. This is a controlled lost-acknowledgement simulation, not a genuine network failure.

Restart showed Finish setup; resuming displayed the explicit recovery screen. Back returned Review. Attempting to edit the name was blocked with “Try again to confirm the submitted setup before changing it.” Retrying the unchanged submission reached completion and returned the original Circle dDpi7cMFcotb7fS1ym9n and requestId setup-mv0imksp-s0vkf5nxk6. Backend owner count remained two, with no duplicate. Not now reached Home, removed the record and Finish setup banner. Evidence: recovery-before-interruption.json, recovery-lost-ack-fixture.json, recovery-retry-result.json and recovery-completion-store.json.

The user supplied development.wavelink@gmail.com for email recovery testing. Current retained fixtures are two test accounts, three private Circles and one proof photo. No product code was changed or bugs fixed.


## Email password-reset request

Exact-email lookup found no preexisting Hoyst account for the user-supplied test inbox. Created a disposable email Auth fixture and complete profile through existing service APIs, then used the actual Welcome → Sign in → Email → Forgot password route. The address carried into the recovery form. Send reset link displayed its busy state and then “Check your inbox for the reset link,” with Back to sign in. Screenshot: evidence/email-reset-sent.png. Inbox receipt, reset-link validity and new-password sign-in remain pending user completion; sending success alone is not an end-to-end pass. Computer-use policy requires the user to enter and submit the new password.

Three QA accounts and three private Circles now remain pending cleanup, plus one proof photo. The external Gmail and Apple identities must be retained.


## Password-reset completion and returning email sign-in

The user reported completing the emailed password reset. Native Email Sign in accepted that existing credential. The existing complete profile QA Email Recovery appeared directly on the originating Profile tab, without profile setup or Reminders. The iOS Save Password prompt was declined; no new credential was saved by the agent. This verifies the reset-to-sign-in outcome, while reset-form interaction and email receipt were user-executed. The destination is the originating Profile tab, not an automatic Home redirect. See email-reset-signin-verification.json and evidence/email-reset-returning-profile.png.


## Approval lifecycle service pass and current outstanding work

Using the email QA owner and two new disposable members, both private approval-Circle joins returned pending. Self-approval was denied. Owner approval changed membership to active with next_opening eligibility and memberCount 2. Approving the second member at capacity was rejected; declining it succeeded and removed pending membership. Repeating approval returned NOT_FOUND without incrementing membership. These are live service checks, not native approval/rejection UI checks. See approval-lifecycle-results.json and approval-lifecycle-verification.json. The fixture Circle and both member accounts were deleted through existing services; Auth, profiles, private roots and momentum/current were absent on verification (approval-cleanup-verification.json).

A fresh attempt to attach to Android Studio still failed with cgWindowNotFound. User assistance bringing its main window and Running Devices panel forward was requested. Android native journeys and hardware Back remain blocked, although the build/install/start passed earlier.

Currently unfinished: Android native flows; native owner approval/rejection UI; actual network save-failure recovery (controlled lost-ack recovery passed); expired/resend SMS; VoiceOver; exhaustive light/dark, small-screen, enlarged-text, keyboard and landscape screen matrix; old-installed-draft migration (automated coverage passed); actual reminder delivery; live month rollover; complete public-photo/stale-discovery native checks. Google remains explicitly excluded. Three QA accounts, three private Circles and one proof photo remain for remaining checks and final cleanup. The external Gmail and Apple identities must not be deleted.

No new confirmed bug was found in this pass. Existing bugs and observations remain unfixed. Product tracked diff fingerprint remains unchanged.


## Native owner review pass

A fresh private QA Native Review Circle and disposable requester were created using existing services. In the actual iOS Circle detail, selecting the pending member → Review → Deny showed Request declined. Backend confirmed declined status and absent membership. The same requester rejoined; native Approve showed Request approved and backend confirmed active membership, count 2 and next_opening eligibility.

The success alert incorrectly claimed immediate Tap In availability, while the member strip and selected member detail offered Needs Tap In/Nudge. An immediate member submitTapIn was correctly rejected because no Opportunity had opened. This is documented as BUG-07; no nudge was sent and no code was changed. Native owner review coverage is now completed, superseding the preceding outstanding list.


The native-review requester and Circle were deleted through existing services. Auth, profile, private root, momentum projection and Circle were absent on verification (native-review-cleanup-verification.json). The retained count is again three QA accounts, three private Circles and one proof photo for remaining tests and cleanup. Android still awaits an attachable window.
