# Onboarding beta fixes and build 47

Status: implementation and signed release archive complete. Version 1.0 build 47 uploaded successfully for internal-only TestFlight testing. App Store Connect processing and tester availability are not yet verified.

The seven confirmed findings have scoped changes in place. The latest targeted Jest run passed 252 tests in 10 suites, and app type checking passed. The final 12 emulator checks passed, including the caller-bound invite metadata. Two broader Home test failures also reproduce against the saved pre-fix source, so Home was not changed to address them.

Backend deployment completed for the deletion marker and momentum guard, its affected callable/trigger/scheduled consumers, and the invite resolver. A second resolver deployment binds membership metadata to the requesting UID.

Native iOS evidence: unavailable invite opens a usable recovery screen, survives cold restart, and returns to Suggestions. The separate saved custom draft and submission ID survive. Enlarged heading and starter badge remain readable on the main QA simulator. Typed custom text is visible above the keyboard footer. Approved members show Starts next window with no member/group nudge actions. Full-Circle preview offers View Circle for the existing authenticated member.

Remaining native verification: small-device retest, focus visibility before typing, profile-to-reminders handoff and actual network failure. The small QA simulator stalled on launch; its data was retained. Android is deferred and Google excluded. Four QA accounts and four private Circles, including the new regression fixtures, remain pending cleanup, plus the prior proof photo.

App Store Connect confirmed build 46 as the newest upload; version 1.0 build 47 is selected. Release archiving exposed static-framework header namespace failures in React Native. The Podfile now preserves existing search paths and derives iOS/common namespace roots, with iOS platform headers taking precedence over portable fallbacks. No dependency version changes were made. Export options are prepared with testFlightInternalTestingOnly true.

Archive: /tmp/Hoyst-TestFlight-47.xcarchive
Build log: /tmp/hoyst-beta47-archive.log
Internal-only export options: /tmp/Hoyst-ExportOptions-47-internal.plist

Final checks: 252 targeted Jest tests passed; app type checking passed; 12 Firestore emulator tests passed; targeted lint has zero errors and 114 warnings. The release archive succeeded. Header roots are also applied to the Hoyst app target.

Archive succeeded and strict deep signature verification passed. The main app and OneSignal extension are version 1.0 build 47. Internal-only export/upload failed with Failed to Use Accounts. Xcode Apple Accounts shows no signed-in account; developer-account sign-in was requested. No TestFlight upload or availability is claimed yet.

After the user signed into Xcode, the retry reported Upload succeeded, Uploaded Hoyst, and EXPORT SUCCEEDED. Upload log: /tmp/hoyst-beta47-upload-retry.log. The export retained testFlightInternalTestingOnly true, so build 47 cannot be assigned to external TestFlight or App Store distribution. Apple reported a missing Hermes framework dSYM warning, which did not block upload.

The Chrome App Store Connect session expired when refreshed. User sign-in was requested to verify processing, compliance, and internal group availability. No wider release was requested or performed.

Feature commit: 40a47b9, Revamp onboarding and unify commitment setup and appearance.
