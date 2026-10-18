# Hoyst legal page drafts

Prepared October 16, 2026. These are local review drafts, not adopted policies, legal advice, or a representation that Hoyst meets every requirement in every region. Obtain appropriate legal review for the operator and intended release markets before publication.

The website drafts are `privacy.html` and `terms.html`, with shared `legal.css`. They match the existing Hoyst website, use no additional scripts or trackers, and include mobile layouts, contents links, print styling, visible draft notices, and `noindex, nofollow` metadata. Their future clean URLs are `/privacy` and `/terms`.

They are deliberately outside the Firebase Hosting public directory. An ordinary hosting deployment will not publish them. The live homepage is unchanged. The app source now points to the planned production legal URLs; those pages remain unpublished.

## Decisions received October 16, 2026

- Operator: **Wave Link, LLC**, legally based in **Georgia**, with the public mailing address **24 Knowles Rd, Cataula, GA 31804-3908, United States**. The user explicitly confirmed the legal base and address. The address also appears in the developer-published [Snippeta Google Play listing](https://play.google.com/store/apps/details?id=com.wavelinkllc.snippeta).
- Launch availability: **United States only**.
- Audience: **18+ only**. The user revised the earlier teen-access choice and explicitly wants to retain Gemini. Earlier 13+ wording is superseded.
- Keep the existing **Gemini Home greeting integration**. No removal or provider switch is requested.
- Public profile: **display name, username, avatar, and bio only**. Keep timezone, sign-in provider details, and internal account fields private. This requires a code/rules/data transition; policy wording alone does not establish that privacy.
- Personal history: **retain when leaving or archiving a Circle, until account deletion**, subject to supported user deletions and the limited retention exceptions accurately disclosed in the policy.
- Keep `support@hoyst.app` for support and privacy requests.
- Adult signup: required checkbox, **“I’m 18 or older and agree to the Terms,”** with linked Terms and a Privacy Policy link. Do not collect a date of birth for this choice. Record the acknowledgment and policy version privately. Self-attestation is not verified age or a guarantee of compliance with provider requirements.
- Business practices: **no personal-data sales, no sharing for targeted advertising, and no members’ posts/photos in Hoyst marketing**. Provider processing needed to operate Hoyst still requires separate verification.
- No further business questionnaire is pending. Local implementation is prepared. Remaining work is deployment/configuration verification, final text review, and setting the effective date at publication. No publication has occurred.

## Implementation status, October 17, 2026

The local app now includes the signup checkbox, Terms/Privacy links, inline acknowledgment in Settings for existing members, private server-side acknowledgment records, and a server guard on Gemini greetings. No separate age-confirmation screen or blocking modal is shown. Signup/profile setup keeps confirmation inline, preserving setup drafts and authentication handoff. The acknowledgment is self-attestation, not verified age.

The local backend publishes only display name, handle, avatar URL, and bio to `publicProfiles`. Account documents under `users` are owner-readable under the proposed rules; handle reservation records are server-only. Signup and profile edits update the public record transactionally, and a retrying trigger synchronizes direct avatar updates/deletions from the latest account state. Member-profile listeners use the public collection. A dry-run-by-default backfill repairs existing projections and removes orphans.

Account deletion now submits idempotent OneSignal deletion and, when configured, RevenueCat deletion before removing Firebase data. Provider errors leave the account available for retry. Greeting caches/counters are cleaned up, and old cache entries expire through scheduled cleanup. A minimal server-only account deletion marker prevents late signup/acknowledgment requests from recreating removed account data.

Settings contains the two requested legal rows for guests and signed-in members, with browser-link failure handling. Their destinations are `https://hoyst.app/privacy` and `https://hoyst.app/terms`. These destination pages have **not** been published yet.

### Configuration verified

- Read-only Google Cloud verification traced the **deployed** greeting function's bound Gemini secret to its actual API-key owner project and verified **active billing** on that project. No key or credential was printed or changed. This supports the paid-service description in the draft under the [Gemini terms](https://ai.google.dev/gemini-api/terms), checked October 17, 2026.
- No live account deletion or provider-deletion request was made. Provider API tests use injected HTTP responses. Live credentials/configuration still require deployment verification.
- OneSignal is initialized before sign-in in the existing app. The draft continues to disclose operational device/session collection, including when notification delivery is disabled. No new claim that the SDK collects nothing has been introduced.

### Release prerequisites

- Follow [implementation and rollout notes](implementation.md). Deploy the new index before cleanup uses it, deploy Functions, backfill public records, and verify before tightening reads. Older app builds that still read other users' account records need a coordinated update at cutover.
- Verify OneSignal credentials and deletion permissions. Enable RevenueCat deletion whenever native RevenueCat keys are supplied, even if purchases are temporarily disabled. The delete endpoint requires a secret API key; a native public SDK key is insufficient.
- Review operational log, backup, support-mail, SDK data-use settings/agreements, store privacy disclosures, US distribution, age rating, and the app license presented with downloads. Existing `PrivacyInfo.xcprivacy` does not constitute an audit of app/SDK collection.
- Review the final proposed text, set the actual publication date, publish the approved pages, and verify both production links before distributing the app build that requires acknowledgment. An unpublished draft cannot support operative acceptance.

No production migration, rules deployment, Function deployment, hosting publication, store metadata change, or live account/provider deletion has occurred.

## Primary references checked

- [FTC mobile-app marketing and privacy guidance](https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start): describe actual practices clearly and keep promises accurate.
- [Firebase privacy and security information](https://firebase.google.com/support/privacy): service roles, data processing, and customer responsibilities.
- [Firebase phone authentication information](https://firebase.google.com/docs/auth/web/phone-auth): phone-number processing for Google's spam and abuse prevention.
- [OneSignal SDK data collection](https://documentation.onesignal.com/docs/en/data-collected-by-the-onesignal-sdk): device, session, subscription, and interaction information and collection controls.
- [Gemini API terms](https://ai.google.dev/gemini-api/terms): age, regions, service tiers, and data treatment. Checked October 16, 2026; page effective March 23, 2026.
- [RevenueCat privacy policy](https://www.revenuecat.com/privacy): purchase-service data processing. Verify the project's actual configuration and agreements.
- [Apple Standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) and [minimum custom-EULA terms](https://www.apple.com/legal/internet-services/itunes/dev/minterms/): store licensing approach. These drafts do not purport to replace Apple's license.

## Publication and app connection

The draft HTML remains outside Firebase Hosting. `scripts/prepare-legal-pages.mjs` creates review candidates outside the hosting directory by default, using an explicitly supplied effective date. It removes internal review notes/draft markers from the candidate and prepares homepage footer links. Regenerate candidates with the actual publication date after approval, review the diff, then copy only the approved assets to Hosting.

The app links are implemented locally and must ship only after the matching pages and backend/rules cutover are verified. See [implementation and rollout notes](implementation.md) for the ordered procedure and validation evidence.
