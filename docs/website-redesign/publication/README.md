# Hoyst website publication

Published with explicit user approval on 2026-10-22, America/New_York.

## Release

- Public URL: https://hoyst.app/
- Firebase project/site: `hoyst-firebase-app`.
- Current Hosting version: `b6dbc9c9770f2ab2`, released `2026-10-23T02:32:44.540Z` (October 22 in New York), with the approved one-step checkbox signup.
- Previous enabled double-opt-in version: `df697a9cde6a5a97`, released `2026-10-23T01:52:47.351Z`, included the corrected Resend REST payload.
- Initial redesign version: `abdf5eb85ddb00a8`, released `2026-10-23T01:30:16.349Z` with signup disabled. Before the redesign, version `a3aa0b639512ba66` was live; both remain in Firebase release history.
- Deployed only Hosting and `invitePage`, `launchSignup`, `updatesConfirmation` in `us-central1`. Hosting rewrites are pinned to the deployed revisions.
- All three website update collection TTL policies are `ACTIVE`; token expiry is also enforced in application code independently of asynchronous cleanup.
- Unrelated mobile code, other Functions, Firestore rules, Storage rules and Universal Links configuration were preserved.

## Production verification

- [Desktop screenshot](home-desktop.png), [mobile screenshot](home-mobile.png), and [live original invitation on mobile](invite-mobile.png) captured in the browser.
- Approved headline, sage section, blue hero Hoy, green invitation Hoy, native screenshot, and all images loaded correctly. No overflow at desktop or 390-pixel mobile width. No warnings or errors in the homepage or invitation browser console.
- Homepage, stylesheet, mascot assets, native screenshot, legal pages and confirmation page return HTTP 200. Downloaded mascot and screenshot bytes match the local verified assets.
- Both Apple association URLs return valid JSON preserving the `/join/*` scope.
- The original user-provided invitation returns HTTP 200 with actual Circle details and the correct app/install actions. An invalid invitation returns the designed HTTP 404 state.
- Signup rejects malformed email with HTTP 400 and cross-origin requests with HTTP 403. The initial disabled release returned HTTP 503. The enabled production release returns HTTP 202 for the authorized test address, preserving the existing opt-out.
- [Initial HTTP verification](http-verification.json) and [enabled signup HTTP verification](signup-http-verification.json) retain these checks without recording invitation access codes or confirmation tokens.
- Functions build, application TypeScript, 13 focused website/beta checks, and diff validation passed before publication.

## Signup status

`UPDATES_ENABLED=true` in production. The Resend domain is verified, and both secrets remain in Secret Manager. Non-secret audience settings remain in the ignored deployment environment file.

New signups now require the initially unchecked consent checkbox and subscribe immediately without a confirmation email. Existing opt-outs are preserved, and old confirmation links remain supported. The live form rejects missing/false consent, returns the generic saved-preferences result after a valid submission, and resets the field and checkbox. [Checkbox verification](../checkbox/README.md) records 32 passing focused checks, successful Functions build, targeted lint, application TypeScript, production request guards, browser evidence and the test address's unchanged opt-out. No additional email was sent during this rollout.

The following controlled confirmation test documents the earlier double-opt-in release, not the current new-signup experience.

The user explicitly selected development@wavelinkllc.com for the test. The address initially had no Resend contact or website signup. Exactly one confirmation email was sent using the compiled signup service and production Firestore; Resend reported `delivered`. This proves recipient-server acceptance; mailbox folder placement was not independently inspected.

Opening the real confirmation link left the Firestore record pending and did not create a Resend contact. Clicking **Confirm my email** on the live site then succeeded, creating the intended Hoyst segment/topic enrollment. See [successful confirmation](signup-confirmed.png).

The test changed only that address's Hoyst topic to `opt_out`. After the preference read reflected the update, the actual provider adapter refused re-enrollment, repeated signup sent no additional email, and token replay preserved preferences. Global preference, unrelated topics and segment memberships were unchanged. The test address remains opted out of Hoyst updates. No Broadcast or other campaign was sent. See [test evidence](signup-verification.json), [safe duplicate response](signup-repeat.png), and [link replay](signup-replay.png).

The earlier live integration check exposed an SDK-versus-REST body mismatch: contact-topic PATCH requires a raw array. The provider adapter and contract regression assertion were corrected, the Functions build and 13 focused tests passed, and the correction remains deployed. [Resend's REST example](https://resend.com/docs/api-reference/contacts/update-contact-topics) documents this shape.

Firebase automatically republished all three functions referenced by pinned Hosting rewrites during the attempted confirmation-only rollout. Actual confirmation and opt-out checks were completed on the enabled release, followed by the corrected final release. A narrower `--only functions:...` filter alongside Hosting must not be treated as isolation from the other pinned functions.

Production UI publication: passed. Live email signup: enabled and verified.
