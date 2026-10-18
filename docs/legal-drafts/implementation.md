# Legal and profile privacy implementation

Updated October 17, 2026. Local implementation only. No production deployment, account deletion, or policy adoption has occurred.

## App and server behavior

- New signup requires the unchecked-by-default “I’m 18 or older and agree to the Terms” checkbox before Apple/Google authentication or email/phone submission. Terms and Privacy are separate accessible links. Sending/resending a phone code never records acceptance. After authentication, the callable records the acknowledgment for that authenticated UID.
- Confirmation stays inline with signup/profile setup. Existing members can acknowledge in a compact Settings banner with smaller text, policy links, an unchecked checkbox, and a compact Confirm action, with retry/error handling. There is no separate confirmation screen or blocking modal. The setup wizard waits for the current account’s acknowledgment before automatically submitting an existing member’s saved setup; an already connected account can acknowledge alongside its setup review or profile fields. A change of account gets fresh state and subscriptions; late responses from the previous account are ignored.
- `acceptLegalTerms` validates explicit adult confirmation and current Terms/Privacy version identifiers, records a server timestamp under owner-readable `userPrivate`, and rejects deleting accounts. `completeProfile` requires that record. Gemini returns the existing built-in fallback before current acknowledgment, and new greeting cache writes recheck account eligibility transactionally.
- `users/{uid}` retains the existing internal schema for owner/server compatibility. Final rules permit owner reads only. `publicProfiles/{uid}` contains exactly `displayName`, `handle`, `avatarUrl`, and `bio`. Public reads fail closed on unexpected extra fields. Handle claims are server-only; availability stays in the existing callable.
- Signup/profile edits update the public projection in their transactions. Direct avatar edits and deletion use a retrying trigger that reads the latest account state, so stale events cannot republish a removed identity. Member listeners use public projections.
- Deletion first hides the public profile and writes a minimal server-only deletion marker. It requests OneSignal deletion and RevenueCat customer deletion when configured; 404 is retry-safe success, while credentials/rate-limit/server failures stop Firebase deletion and leave the authenticated account available for retry. Provider deletion is asynchronous after acceptance by the provider. No real provider delete was used during testing.
- Deletion also removes account-tagged greeting caches and usage records. Scheduled hourly cleanup removes old cache/usage records after a 48-hour cutoff, including legacy entries without owner tags. Read paths do not reuse expired greeting caches. Scheduled expiry is not a guarantee of a universal end-to-end deletion deadline. The deletion marker remains to prevent delayed requests from recreating removed account data.
- Guest and signed-in Settings now open `https://hoyst.app/privacy` and `https://hoyst.app/terms`, with a fallback alert on browser-link failure. Notifications and account controls remain hidden for guests.

## Production cutover order

These are reviewable deployment instructions, not commands that have already run. Do not distribute a build requiring acknowledgment before the approved pages and callable are reachable.

1. Review the candidate pages in `docs/legal-release/`. The current proposed date is October 17, 2026; regenerate with the actual approved publication date if publishing later. The version identifier `2026-10-17` is separate from the effective date and must stay identical in the app and Functions. Review US distribution/age rating, store privacy disclosures, and the license presented with the app download.
2. Verify OneSignal App ID, secret binding and deletion permissions in the actual deployment. If native RevenueCat SDK keys are supplied, enable `REVENUECAT_DELETION_CONFIGURED=true` and supply `REVENUECAT_SECRET_API_KEY`, even if `PROGRESS_PURCHASES_CONFIGURED` is temporarily false. Never use the public native SDK key for deletion. Successful provider API responses mean deletion was requested, not that all provider logs/backups are erased immediately.
3. Deploy the added collection-group `users.uid` index and wait until ready. It is used only to select greeting usage records; cleanup additionally restricts paths to `homeGreetingUsage/{date}/users/{uid}`. Other account/user documents are never deleted by that query.
4. Deploy the changed/new Functions: `acceptLegalTerms`, `completeProfile`, `updateProfile`, `refreshPublicProfile`, `deleteAccount`, `generateHomeGreeting`, and `expireHomeGreetingData`. Check the scheduler and provider secret bindings. The generated `functions/lib` files are kept in sync by `npm run functions:build`.
5. Run the public-profile backfill in dry-run mode, then commit, then verify zero remaining changes:

   ```sh
   node scripts/migrate-public-profiles.mjs --project=hoyst-firebase-app
   node scripts/migrate-public-profiles.mjs --project=hoyst-firebase-app --commit
   node scripts/migrate-public-profiles.mjs --project=hoyst-firebase-app
   ```

   The script defaults to dry run, requires an explicit project, logs counts rather than profile values, and reads the latest account in each write transaction. Its dry-run/commit/orphan-repair behavior is emulator-tested. No production backfill has been run.

6. Coordinate the client, final Firestore rules, and legal-page publication. Older app builds still read other members from `users` and can lose those listeners after the privacy restriction. Those members need the updated build. Restricting access and simultaneously preserving unrestricted reads by older clients are incompatible; do not silently retain public internal fields for compatibility. Verify the supported client version at cutover.
7. After the final rules are deployed, verify guest/other-account denial of internal account, private and handle records, and public access to the four-field projection. Confirm owner reads and circle member presentation work in the updated app.
8. Regenerate the legal candidates with the actual effective date, review the HTML, then copy only the approved `privacy.html`, `terms.html`, `legal.css`, and prepared `index.html` to `hosting/`. Keep the existing invite rewrite and association files. Deploy Hosting and verify `/privacy` and `/terms` return the approved pages. Candidate generation deliberately refuses to write directly into Hosting.
9. Verify native signup, existing-member acknowledgment, retry, sign-out/account switching, deletion retry, and legal links against the deployed services. Use disposable test accounts for destructive end-to-end checks. No existing user's legal acknowledgment should be accepted on their behalf during QA.

## Verification evidence

- Focused Jest coverage covers signup blocking, acknowledgment save/retry and account isolation, guest/authenticated legal links and failure handling, authentication handoff, Progress and greeting helpers, Home data mapping, public discovery, and circle services.
- All 30 Firestore emulator tests pass (including the migration executable, account-deletion race, and cache cleanup). Coverage exercises owner/public/other-account rules, forged acknowledgment rejection, backend signup enforcement, stale projection events/deletion, idempotent provider deletion responses, greeting cleanup, deletion tombstones, and the actual migration script's dry-run/commit behavior. Provider HTTP responses are injected; tests never call provider deletion endpoints.
- Read-only verification traced the deployed greeting function's Gemini key to its owning project and confirmed active billing. No credential was printed or changed.
- The standalone acknowledgment screen was removed after product review. Native iOS inspection confirms normal navigation is available without a blocking screen and Settings shows the unchecked confirmation inline with linked policies and a disabled save button. The account was not acknowledged. Verify final signup/profile controls and light/dark, narrow/large-text, Android, and authentication transitions before distribution. Do not describe automated tests as full cross-platform native QA. No real account acknowledgment was submitted during QA.
