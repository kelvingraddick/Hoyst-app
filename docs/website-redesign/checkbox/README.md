# One-step checkbox signup

Approved and implemented 2026-10-22. This supersedes the earlier double-opt-in requirement for new website signups.

## Behavior and interface

- Visitors enter an email, actively tick the initially unchecked consent box, and submit **Keep me updated**. Subscription is processed directly; no confirmation or welcome email is sent.
- Exact consent: “Email me Hoyst news, new features, and launch updates. Unsubscribe anytime.” The server records this text, version `hoyst-updates-checkbox-2026-10-22`, method `website_checkbox`, and timestamp. The HTML wording is contract-tested against the server constant.
- `POST /api/launch-signup` accepts JSON `{email, consent: true}`. Plain HTML form submission accepts `consent=yes` with URL-encoded content type. Missing/false consent is rejected before storage/provider access.
- Success returns HTTP 202 and “You’re all set. Your email preferences are saved.” The same generic response preserves membership privacy and avoids promising re-enrollment for an opted-out address.
- Existing confirmed/subscribed/unsubscribed records are left unchanged. Global and Hoyst topic opt-outs remain respected by the provider. Other brands' topics and segments are preserved.
- First-time successful records use `status=subscribed`, `emailVerified=false`, consent evidence and `subscribedAt`. Checkbox consent is not represented as email ownership verification.
- Same-origin guards, payload limits, keyed identifiers, verified-sender checks and rate limits remain. Limits are three attempts per email per hour, ten per IP per hour, and global caps of 80/hour and 250/day. A 120-second durable lease prevents concurrent duplicate provider calls and supports recovery after interrupted attempts. Failures show retry feedback without false success.
- Existing confirmation links remain valid for their original lifetime. They can confirm a legacy pending request; after checkbox signup they return a safe already-completed result. Expired/invalid links direct visitors to the checkbox form. There is no bulk activation of pending addresses.
- Homepage CSS and signup JavaScript URLs have a revision query to avoid stale asset combinations. Older open pages may need refreshing; stale submissions without consent fail safely.
- Privacy disclosures were updated in Hosting and both existing legal-document copies. No new analytics or email events were added.

## Visual QA

No unresolved P0/P1/P2 findings.

Source is the previously approved blue/sage page plus the user's approved checkbox amendment. [Before](before.png) and [after](after.png) both use 899 CSS pixels, DPR 1, light theme and the default unchecked state. Source image is 899 × 2381 pixels; implementation is 899 × 2437. The additional 56 pixels accommodate the consent row. [Full comparison](comparison-full.png) and [focused comparison](comparison-form.png) were opened together and reviewed.

- Typography: Manrope/Kalam, headings, weights and copy hierarchy unchanged. Consent text is readable muted 12-pixel body text with 1.55 line height, matching the form's supporting type.
- Spacing/layout: only the signup grid changes. Email spans the row; consent and submit sit below on desktop, then stack on mobile. Email → checkbox → submit is the DOM and keyboard order. The approved hero, real phone, illustrations, Hoy and surrounding sections remain unchanged.
- Colors: existing sage surface, white form, muted text and blue action/focus are retained. Existing text/canvas contrast is 6.84:1 and white/action contrast 5.15:1.
- Assets: existing assets and real app screenshot unchanged. No new artwork was needed.
- Copy: clear opt-in sentence, generic saved-state feedback, and honest retry messages. No new-email or confirmation instruction appears in the new signup flow.

[Desktop form](form-1280.png), [mobile form](form-390.png), and [narrow form](form-320.png) were inspected. Browser checks covered 1280, 899, 768, 390 and 320 CSS pixels at DPR 1. No horizontal overflow was found; consent starts unchecked and is required at every width. Its label has a minimum 44-pixel touch region. Entering an email and submitting without consent focuses the missing checkbox without a network request. Tab reaches the checkbox, Space toggles it, and Tab reaches the submit button. The focus outline is blue. Local browser console has no warnings/errors. Temporary viewport and reduced-motion overrides are restored at handoff.

## Automated verification

32 focused checks passed: 14 provider/HTTP/markup/beta checks and 18 actual Firestore-emulator tests. They cover new subscription without email/token creation, consent evidence, missing/false consent, JSON/plain form behavior, duplicate safety, failures/retries, same-address concurrency, expired-lease recovery and stale completions, opt-outs, per-email/IP/global limits, legacy confirmation compatibility, provider REST contract, sender verification, client-access denial and request guards. Functions build, targeted lint and application TypeScript passed.

## Production rollout

Published with explicit user approval as Hosting version `b6dbc9c9770f2ab2` at `2026-10-23T02:32:44.540Z`, October 22 in New York. Hosting and its three pinned website functions were deployed successfully. [Live form](production-form.png) and [mobile page](production-mobile.png) show the new consent flow. Production checks confirmed initially unchecked required consent, native validation, immediate generic saved-state feedback and form reset. At 390 CSS pixels there is no horizontal overflow. The browser console has no warnings/errors.

[HTTP checks](production-http.json) show missing/false/string JSON consent and invalid email rejected with 400, cross-origin requests with 403, and current homepage, privacy and assets with 200. The authorized development test address returned success without changing its existing preferences. [Read-only provider and Firestore verification](production-preferences.json) confirmed the Hoyst topic remains opted out, the Hoyst segment is retained, global preference is unchanged, and the original confirmed record/consent version is preserved. No additional email or campaign was sent. First-time direct enrollment and failure/retry paths were exercised in the emulator, not by subscribing a new production address.

final result: passed
