# Hoyst website redesign

Approved target: `/Users/kelvin/.codex/generated_images/01a15d09-6e6c-7b20-8693-857141370fdf/exec-e4ac9c56-2156-4a44-b65e-75eba2fb1b0c.png`.

The approved 2026-10-22 palette revision keeps that layout with blue, soft sage and warm neutrals, one purple Hoy in the introduction, blue Hoy in the hero, green Hoy on invitations and golden Hoy on confirmation pages. Existing app mascot assets are reused directly. Updated collage artwork and full edit prompts are documented in [palette QA](palette/design-qa.md) and [asset provenance](palette/artwork-prompts.md). Purple no longer supplies the major section backgrounds or storytelling accents.

Production publication: [hoyst.app](https://hoyst.app) was released on 2026-10-22 after explicit user approval. The user subsequently approved [one-step checkbox signup](checkbox/README.md), replacing double opt-in for new requests. Existing confirmation links remain supported. See [publication verification](publication/README.md) for deployment history. The authorized test address development@wavelinkllc.com remains opted out.

## Local review

Use Node 22. Run `npm --prefix functions run build`, then `node scripts/preview-website.mjs`. The default URL is `http://localhost:4173`.

The preview server serves the actual website and production invitation renderer with fictional Workout Crew data. Review `/join/workout-crew`, `/join/approval`, `/join/full`, `/join/invite-only`, and `/join/unavailable`. The invitation links contain a fictional local demo code and are not production Circle invitations. Local email submission deliberately returns an unavailable message and never contacts Resend or writes production data. Confirmation-link GET views use the production handler and never subscribe anyone.

The homepage remains static HTML with shared CSS and a small progressively enhanced signup form. New signup requires an unchecked-by-default consent checkbox and directly subscribes without an email. Existing beta event hooks, analytics opt-out, privacy signals, support channels, eligibility wording and TestFlight destination are retained. No analytics SDK or new analytics events were added. The legacy confirmation route never loads beta analytics; its private fragment is cleared from history and explicit POST remains required. Provider HTTP 429 responses use bounded retry with jitter.

## Artwork and real app capture

The phone displays a native iPhone 17 Pro capture of the read-only `website` Circle progress fixture. It uses the real Circle hero, Tap In control, progress panel and member strip. Open `hoyst://circle-progress-preview/website` in a Debug build. It does not create a Circle, impersonate a user, or write account data. Demonstration avatars are bundled app fixtures.

The three connection illustrations were generated individually from the approved mock and optimized as WebP. Their original PNGs remain in `docs/website-redesign/artwork`. The supplied Hoy and black Hoyst logo are reused, with a bundled product-design iPhone bezel over the real screen capture. Manrope and the small Kalam handwritten accents are self-hosted with their OFL licenses in `hosting/assets/fonts`.

The separate invitation panel at the bottom of the mock is implemented as the `/join/` route, not repeated on the homepage. Installation guidance, an FAQ and footer sit below the approved core layout for a complete working acquisition flow.

## Production email configuration

The website and live signup are enabled. The functions retrieve the configured Resend domain and require `status=verified` and an exact match between that domain and the From address before sending or subscribing.

1. In the intended Resend account, verify the sending domain and create a `Hoyst updates` Segment and a `Hoyst updates` Topic. Use an opt-out default for that Topic so unrelated contacts are not enrolled automatically.
2. Both `HOYST_RESEND_API_KEY` and the randomly generated `UPDATES_TOKEN_SECRET` are now provisioned in Firebase Secret Manager and attached only to the two update functions. Retain these existing secrets. The provider key requires the domain check, emails, contacts, segments and topic subscription capabilities. Never put either secret in Hosting or Git.
3. Configure `RESEND_DOMAIN_ID`, `RESEND_SEGMENT_ID`, `RESEND_TOPIC_ID`, `UPDATES_FROM` (default `Hoyst <updates@hoyst.app>`), and `UPDATES_ORIGIN` (default `https://hoyst.app`). Configure `UPDATES_ENABLED=true` only after verification and a controlled delivery check. The same-origin endpoint is `/api/launch-signup`; the confirmation route is `/updates/confirm`.
4. All three website TTL policies are active. Future updates must redeploy the website functions and Hosting together so pinned rewrites point to the correct revisions. Firebase CLI can automatically include all functions referenced by Hosting `pinTag` rewrites even when a narrower function filter is supplied; treat this as publication of all three website functions. TTL uses `expiresAt` in `websiteUpdateSignups`, `websiteUpdateTokens` and `websiteUpdateRateLimits`. Existing Firestore default-deny rules protect these server-only collections.
5. Verify required consent, immediate subscription, consent evidence, the intended Contact/Segment/Topic, duplicate handling and existing opt-out preservation. Do not send a marketing Broadcast as part of website verification. Earlier confirmation links remain a compatibility path only.
6. Send future updates using Resend Broadcasts with the configured Topic and unsubscribe/preference link. Do not send campaigns using the transactional email endpoint, which does not enforce Broadcast subscription preferences.

The server stores consent wording, version, method and timestamp, normalized email, keyed email and IP identifiers, and subscription status. New checkbox signups do not create tokens or send email, and are explicitly marked as not email-verified. Unsuccessful requests expire after two days, legacy tokens after one day, and rate records after one day using TTL; completed records retain consent evidence. Three attempts per email/hour, ten per IP/hour and global caps of 80/hour and 250/day limit provider access and abuse. A 120-second durable claim supports concurrency and interrupted-attempt recovery. Global unsubscribes are never changed. Resend reports inherited private-topic opt-out defaults even for contacts who never joined Hoyst; explicit Hoyst consent can opt a new other-product contact into Hoyst. A Hoyst-topic opt-out paired with prior Hoyst segment membership remains suppressed. Keep that membership when a recipient unsubscribes. Existing processed signup records also prevent duplicate or later re-enrollment.

## Validation

- `npm --prefix functions run build`
- `npm run typecheck`
- `node --test tests/website-updates.test.mjs tests/beta-web.test.mjs`
- With a local Firestore emulator and demo project: `GCLOUD_PROJECT=demo-hoyst-website FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 node --test --test-concurrency=1 tests/website-updates-emulator.test.mjs`
- Existing invite regression tests: `npm test -- --runInBand __tests__/circle-invite.test.ts __tests__/circle-invite-coordinator.test.tsx`

The emulator suite refuses to run without an explicit emulator and a `demo-` project. It covers actual Firestore transactions, checkbox consent evidence, immediate enrollment without email, duplicate and concurrent requests, stale/expired tokens, failures and retries, concurrent confirmations, opt-outs and client-access denial. Provider tests mock the Resend HTTP boundary. Domain verification, audience configuration and actual delivery were checked during the earlier publication. Function configuration and both Secret Manager secrets are provisioned, and `UPDATES_ENABLED=true` is deployed. The current checkbox flow and unsubscribe preservation were verified in production using only the existing authorized test address; no additional email or campaign was sent. See the checkbox report for precise verification boundaries.

API reference used: [Contacts](https://resend.com/docs/api-reference/contacts/create-contact), [Contact topics](https://resend.com/docs/api-reference/contacts/update-contact-topics), [Domain verification status](https://resend.com/docs/api-reference/domains/get-domain).
