# Hoyst public iPhone beta

Launch November 1, 2026 at 10 a.m. Eastern. Free and ongoing. US adults 18+. Recruit broadly through KG.codes and Wave Link. Goals: 25 onboarded accounts by November 8 and at least 50 by November 15. These goals are not forecasts.

## Prepared assets

- `launch-copy.md`: teaser, launch captions, email copy, Stories, Circle walkthrough, demo recording script and November 15 update template.
- `campaign-links.csv`: tagged links for each account, channel and asset. Use the matching link; avoid adding personal data to tags.
- `audience-template.csv`: normalized input headers for the local permission/deduplication review.
- `../../outputs/beta-launch-20261101/feedback-tracker.xlsx`: empty feedback tracker. Keep the working copy private and record concise summaries, not message transcripts or attachments.

## Service setup

**Sentry:** Hoyst project created in Wave Link at https://wave-link.sentry.io/projects/hoyst/. Its DSN is stored only in the ignored local `.env`. No account token is included in tracked code. App initialization sets release/build and filters JavaScript error content. A generic transport check reached Sentry as HOYST-1 with release 1.0 (50). A native startup error, now fixed, reached HOYST-2 and revealed that native crash events bypass the JavaScript filter. With Kelvin's explicit approval, the TestFlight release chat owns the native privacy fix and verification before tester distribution. Source-map symbolication also remains a release check.

**Resend:** Keep the existing account. Created empty segment `Hoyst` and topic `Hoyst beta updates` (private, default `opt_out`). In Resend’s terminology, that default means no one receives topic mail until explicitly subscribed. Do not add the Snippeta segment or all subscribers to Hoyst broadcasts. Live inventory on October 21: existing Snippeta segment 4,091 contacts, including 88 unsubscribed. Subscription status does not prove permission for Hoyst promotion. A read-only API inventory and local review were saved under ignored `.beta-private/audience/`; the provider export contains no permission wording, so none of these addresses was automatically approved for Hoyst. Kelvin states explicit brand/new-app permission exists and will identify the source; annotate only the matching records once that evidence is supplied.

**Mailchimp:** Keep KG.codes brand marketing in its current audience. Live inventory on October 21: 213 contacts, including 180 email subscribers. The private export includes 180 subscribed, 33 unsubscribed and 5 cleaned addresses; the UI total of 213 excludes the cleaned records. There are six unique addresses shared with Resend, none currently suppressed in either inventory. Subscriber sources: 35 Popup Form, 30 Hosted Signup Form, 63 file import, 15 Mailchimp for iOS, 23 API, 11 Admin Add, and 3 unspecified. All 180 have an opt-in timestamp, but the export contains no historical permission wording or real engagement timestamps. These counts are inventory, not a verified eligible list. Private originals, normalized records and a review queue are under ignored `.beta-private/audience/`; no source subscriptions were changed.

**PostHog:** US project Hoyst (678033) is configured in ignored app `.env` and the public web capture configuration. Autocapture, replay, heatmaps and web vitals are disabled. The project discards client IP data for future events, and explicit events disable location enrichment. The saved dashboard is https://us.posthog.com/project/678033/dashboard/2238566. Seven queries were validated against the live project, including mature cohort rates, raw counts and clearly labeled empty rows. No personal API key was created.

**Website coordination:** The “Redesign Hoyst home page” chat owns the homepage, invitation styling, shared `functions/src/updates` signup implementation and publication decision. This beta chat created the Resend segment/topic/domain, stored the approved key as Firebase Secret Manager `HOYST_RESEND_API_KEY`, and verified the domain after adding all four sending records in GoDaddy. Do not deploy the website from this chat. Preserve the web analytics and privacy changes in that release.

**October 22 publication:** The website chat published Hosting and only `invitePage`, `launchSignup` and `updatesConfirmation`. Current Hosting version `b6dbc9c9770f2ab2` has public one-step checkbox signup enabled (`UPDATES_ENABLED=true`). Production checks passed for the desktop/mobile homepage, original invitation, assets, legal pages, Universal Links association files and request validation. Analytics privacy filters and disclosures were preserved. Both secrets and audience configuration are provisioned, and all three scoped TTL policies are active. See `../website-redesign/publication/README.md` for the initial release and `../website-redesign/checkbox/README.md` for the current signup release.

**Controlled test passed:** Kelvin authorized `development@wavelinkllc.com`. The earlier confirmation-based release sent exactly one confirmation email, with Resend reporting delivery. Its live confirmation, topic opt-out, duplicate signup and replay checks passed. Kelvin subsequently approved immediate signup with an initially unchecked consent box. The current release passed live consent validation and saved-state/reset checks; read-only verification confirms the test address remains opted out with its original consent evidence. First-time direct enrollment was tested in the emulator, without subscribing another production address. No additional email or campaign was sent.

## App and web configuration

For a beta release, local `.env` needs `APP_ENV=beta`, `POSTHOG_PROJECT_KEY`, `POSTHOG_HOST=https://us.i.posthog.com`, and `SENTRY_DSN`. Local development analytics are off unless `ANALYTICS_DEBUG=true`. Set `ANALYTICS_INTERNAL=true` on internal QA builds. Do not distribute a QA build as the public measurement build.

Set the same public capture token and ingestion host in `hosting/beta-config.js`. Public capture tokens are designed for client use; personal API keys are not. Both web and app tracking explicitly exclude user text, email, full URLs and invitation tokens. Replay and touch autocapture are disabled. The website uses a random identifier in sessionStorage with a 30-minute inactivity window, no tracking cookies, and respects Do Not Track / Global Privacy Control. App users can disable optional usage analytics in Settings.

The homepage's optional Hoyst-only signup form posts to `/api/launch-signup` with email and explicit checkbox consent. The required box starts unchecked. Successful new subscriptions are added directly to the Hoyst segment/topic without a confirmation email. The shared implementation in `functions/src/updates` preserves existing opt-outs, privately records consent wording/version/timestamp, and limits requests. Checkbox consent is not email ownership verification. Legacy confirmation links at `/updates/confirm` remain supported for their original lifetime, without bulk activation. The website chat owns configuration, tests and deployment. Signup is never required to install Hoyst. The sending domain `hoyst.app` is verified in Resend. Public DNS setup records are in `resend-dns-records.json`; that file contains no private key. Use `development@wavelinkllc.com` directly for support and email replies, per Kelvin. Sender: Hoyst <updates@hoyst.app>.

Install native dependencies with the existing package manager and run `pod install` in `ios` before rebuilding. The existing “🚀 Commit, build, and deploy to Testflight” chat owns the mobile release gates; the mobile changes are committed as `e419175` and the build 51 bump as `44c9eb6`. It reports build 51 uploaded but unassigned while checking native privacy. A privacy fix requires a replacement build before tester distribution. Website deployment does not update installed mobile builds.

## Saved PostHog dashboard

`node scripts/provision-beta-dashboard.mjs` prints the seven prepared insight definitions without changing anything. For a future scripted update, set `POSTHOG_API_HOST=https://us.posthog.com`, `POSTHOG_PROJECT_ID` and `POSTHOG_PERSONAL_API_KEY` in the process environment, then run:

```sh
node scripts/provision-beta-dashboard.mjs --apply
```

The provisioner saves one dashboard and validates SQL against the live project before saving each card. Progress is stored in ignored `.beta-private/posthog-dashboard.json` so retries reuse the same dashboard/cards. Keep that state when retrying. The live dashboard already exists. The provisioner discovers a same-named dashboard and its insight IDs when private state is absent, so a future update can reuse the UI-created dashboard.

Onboarded testers are unique authenticated accounts observed completing onboarding after November 1 at 15:00 UTC, excluding internal/development events. Activation is a saved `done`, `partial` or `failed` Tap In in the first seven elapsed days after onboarding. A confirmed save requires an active Commitment membership, so it also verifies creation/joining. Skip and rest do not activate. Second-week repeat use requires another non-skip save in the interval from 7 days inclusive to 14 days exclusive after activation. Only fully observed cohorts enter a rate; show eligible, achieved and pending counts. Monthly cadence is separate and needs longer follow-up. Initial activation mode/cadence fixes each user’s segment.

Local deduplication suppresses retries of the same server coverage revision and repeated setup writes. Distinct-account metrics tolerate multiple devices; event totals can still differ from current database records. Optional analytics and blockers can undercount usage. Never treat website sessions as installed testers or infer per-channel installs across TestFlight. Self-reported discovery remains a separate measure.

## Read-only Firebase cross-check

With Google Application Default Credentials authorized for the project:

```sh
node scripts/reconcile-beta-firebase.mjs --project=hoyst-firebase-app --start=2026-11-01T15:00:00Z --end=2026-11-15T15:00:00Z
```

Optional `BETA_INTERNAL_UIDS` excludes known internal accounts. The script reads bounded users, circles and checkIns queries and prints aggregate counts only. It makes no writes. This compares current surviving records, not a full historical event ledger; deleted users/Tap Ins, edits, offline event delivery and profile timestamp differences can explain discrepancies. Investigate differences rather than forcing totals to match. Production data is not needed to manufacture a baseline before the beta exists.

## Email audience review

Export each provider’s subscribed and suppressed records into a private working folder. Preserve originals. Normalize a derived copy to the six headers in `audience-template.csv`: provider (`mailchimp`/`resend`), email, permission_scope (`brand`/`new_products`/`hoyst` only when evidenced), permission_evidence (the actual signup wording or evidence reference), status, last_engaged_at (ISO timestamp of real engagement where available). Leave uncertain permission blank. App registration and a provider’s subscribed flag alone are not permission evidence. Avoid using opens as proof of recent engagement.

```sh
python3 scripts/audit-beta-audience.py .beta-private/mailchimp.csv .beta-private/resend.csv
```

The script writes private per-provider eligible lists, a review file, and aggregate counts. It suppresses addresses with any source unsubscribe/bounce/complaint, deduplicates eligible addresses, and selects the most recently engaged eligible provider record (Mailchimp wins ties). This conservative global suppression policy is specific to this campaign. It does not change source subscriptions, upload contacts or send email. Recheck suppressions immediately before sending. Send 100–250 recent eligible contacts first, review delivery/complaints over 24 hours, then expand. All sends must retain the provider’s real unsubscribe footer.

## Operating calendar

- October 21–25: app/web setup, audience review, demo recording.
- October 26–28: 5–10 pilot testers on physical iPhones. Check fresh install, signup, first Commitment, first Tap In and a Circle invitation.
- October 29–31: founder teaser/demo and bio links. Have the release build and external TestFlight availability confirmed by October 29.
- November 1, 10 a.m. Eastern: publish launch video/Stories and send the initial eligible email batch. Pin the post and save a Hoyst Beta Highlight.
- November 2–7: answer installation questions, publish the use case/Circle walkthrough, send one November 5 reminder to eligible recipients. Community updates start on Instagram.
- November 8–14: share shipped improvements, ask one focused question at a time, hold two short conversations.
- November 15: review mature cohorts, choose the next three changes, publish the completed update template.

Weekly budget: 90 minutes content, 60 minutes replies/triage, 30 minutes metrics, 30 minutes campaigns, 30 minutes tester conversations. App development is separate. Kelvin owns promotion, replies and review. No future posts, sends or recurring automation are silently scheduled by these files.

## Release gates

- External TestFlight link accepts a new tester, has room and an unexpired public build. App Store Connect redirected to login during the October 21 check; capacity remains unverified.
- New build installs on a physical iPhone. Test fresh/returning authentication, first setup, accepted Tap In and reminders.
- Invitation works with Hoyst installed and uninstalled. New users install, return to the invitation page, then tap Open Hoyst. Pending membership is distinct from approval.
- Support and feature choices open Instagram/email; failed mail launch offers Copy email. Clicking a contact route is not a sent ticket.
- Source question appears after new onboarding, can be skipped and does not repeat after answering. Existing completed accounts are not prompted.
- Confirm PostHog events, logout reset, retries, opt-out persistence, missing config/network failure, sensitive-data filtering, internal exclusions and real build metadata.
- Confirm a controlled native-build event reaches Sentry with the native privacy filter applied. Verify symbolication/source-map upload separately; DSN configuration alone does not establish this. The TestFlight chat owns this gate.
- Homepage, invitation pages and privacy disclosures were published October 22 by the website chat. Preserve them in subsequent releases and avoid unrelated backend changes.
- Public Hoyst signup uses the required unchecked consent box and immediate subscription. Live validation, saved-state/reset and existing opt-out preservation passed October 22; first-time direct enrollment passed emulator checks. Legacy confirmation links remain compatible. Check tagged campaign links and each real campaign's unsubscribe footer before sending. The website chat owns subsequent signup deployments and pinned function revisions.

If installation/authentication or saved activity fails, hold broad promotion until fixed. If onboarding stalls, prioritize that flow before expanding email. If people activate but do not return, examine usefulness, cadence and reminders. If Circle activity stalls, examine installation handoff, approval delays and availability of companions. There are no invented retention benchmarks.
