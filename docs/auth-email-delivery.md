# Authentication email delivery

## Status: November 4, 2026

Project: `hoyst-firebase-app`. Password resets use Firebase's default delivery service through the existing client `sendPasswordResetEmail` call. Resend is used separately for website updates.

Applied and verified through the Identity Platform configuration API:

- Password reset sender display name: `Hoyst`.
- Password reset Reply-To: `development@wavelinkllc.com`.
- Existing reset subject, body, sender local part (`noreply`), action handler, and other authentication templates were preserved.

The sending domain is now **`hoyst.app`**, and the reset sender is **`Hoyst <noreply@hoyst.app>`**. Added the four Firebase DNS records below in GoDaddy, confirmed them on both authoritative nameservers, completed Firebase verification, and selected **Apply custom domain**. Firebase displayed **Custom domain applied**. The configuration API confirms `customDomain: hoyst.app` and `useCustomDomain: true`. Its pending-verification state resets to `NOT_STARTED` after application; this does not mean the applied domain is inactive.

No app source changes, backend deployment, or mobile release were required. Firebase applies the sending domain to all authentication email templates. The action handler remains the existing Firebase-hosted reset page.

## Fresh verification after activation

- Gmail: a controlled reset sent at 10:09 PM New York time on November 4 arrived with the `INBOX` label from `Hoyst <noreply@hoyst.app>`, with the expected support Reply-To. Gmail reports `spf=pass`, `dkim=pass` with identity `@hoyst.app` and selector `firebase2`, and `dmarc=pass` with `header.from=hoyst.app`. The received reset code was verified through Firebase's reset-code verification endpoint for the correct recipient. No real user's password was changed.
- Zoho, forwarded copy: the Gmail account forwards to the controlled Zoho mailbox. This copy appeared in the Zoho Inbox, and `mx.zohomail.com` reports SPF, DKIM, ARC, and DMARC passing. This is not a direct Firebase-to-Zoho delivery test.
- Zoho, direct test: the initial request to `development@wavelinkllc.com` did not produce a reset email because the address no longer had a Firebase Auth account. Created an isolated Auth-only user for that controlled address and sent a direct reset. Kelvin's supplied Mail screenshot confirms that the 10:15 PM message, addressed directly to `development@wavelinkllc.com`, arrived in **Inbox - Wave Link / Development / Zoho**. The screenshot also shows the expected Hoyst display name and support Reply-To. Direct inbox placement is verified; this message's authentication headers were not independently inspected because Mail automation stalled and Zoho webmail required sign-in. Removed the temporary Auth-only user and verified its removal while preserving the real Gmail account. Its reset link is invalid after test-user cleanup.
- Both authoritative nameservers return the new records, one apex SPF record, and the preserved hosting, DMARC, Resend, website A, and website CNAME records. No allowlist or spam-rule changes were made.

Configuration screenshots are in `/Users/kelvin/Documents/Codex/Hoyst-artifacts/2026-11-04-auth-email/`, including `godaddy-dns-saved.png` and `firebase-domain-active.png`. These contain configuration evidence, not reset codes.

## Observed delivery before domain activation

- Zoho: the November 4 reset to the controlled development mailbox was in Junk. The receiving `mx.zohomail.com` headers reported `spf=pass` and `dkim=pass`, with DKIM identity `@firebaseapp.com`. No explicit DMARC result or spam reason was present in the inspected headers. SPF/DKIM failure is therefore not established as the cause.
- Gmail: an October 9 reset to the controlled development Gmail account had the `INBOX` label and passing SPF/DKIM. This is historical evidence, not a fresh delivery test after these changes.
- The Zoho Junk folder also contained a previous Resend confirmation email. Switching delivery providers is not proven to resolve the filtering issue.

Do not record reset URLs, action codes, credentials, full email bodies, or raw message headers in this document.

## DNS records supplied by Firebase

In GoDaddy, add the following records for `hoyst.app`. The Name column is relative to the domain; use `@` for the apex.

| Type | Name | Value |
| --- | --- | --- |
| TXT | `@` | `v=spf1 include:_spf.firebasemail.com ~all` |
| TXT | `@` | `firebase=hoyst-firebase-app` |
| CNAME | `firebase1._domainkey` | `mail-hoyst-app.dkim1._domainkey.firebasemail.com.` |
| CNAME | `firebase2._domainkey` | `mail-hoyst-app.dkim2._domainkey.firebasemail.com.` |

Authoritative DNS inspection before the change found no apex SPF record, so the supplied apex SPF was added as written. Future changes must merge authorizations into that record rather than adding a second apex SPF record. Do not combine the separate `send.hoyst.app` SPF record with the apex record.

Preserve the existing hosting TXT record (`hosting-site=hoyst-firebase-app`), DMARC policy (`p=quarantine; adkim=r; aspf=r`), Resend DKIM TXT at `resend._domainkey`, SPF/MX at `send`, and CNAME at `rsend`, along with all unrelated DNS records. The authoritative nameservers are `ns43.domaincontrol.com` and `ns44.domaincontrol.com`.

## Activation and verification

1. Confirm that both authoritative nameservers return the four requested DNS records.
2. In Firebase Authentication > Templates > Password reset > Customize domain, use `hoyst.app`, select Verify, and wait for verification. The console warns this can take up to 48 hours.
3. Select Apply Custom Domain after verification. Firebase applies this sending domain to all authentication email templates. Confirm the reset sender is `Hoyst <noreply@hoyst.app>` and the Reply-To remains the support address above.
4. Send one controlled reset each to `development@wavelinkllc.com` (Zoho) and `development.wavelink@gmail.com` (Gmail). Inspect the received From, Reply-To, SPF, DKIM, DMARC, folder placement, and any spam verdict. Do not mark messages as Not Junk or allowlist the sender before measuring placement.
5. Open the new reset link and verify the reset form/code is valid. Have the account owner complete any actual password change; do not change a real account's password solely to test delivery.
6. If authentication passes but Zoho still filters the message, inspect Zoho's verdict and account/organization spam rules before considering a separate Firebase Admin SDK plus Resend implementation. Do not weaken DMARC, allowlist the entire `firebaseapp.com` domain, or enable custom SMTP as part of this configuration task.

Domain activation, Gmail authentication/placement, the Gmail reset code, Zoho's forwarded-copy authentication/placement, direct Zoho inbox placement, and temporary-user cleanup are verified. Direct Zoho authentication headers were not independently inspected. No further sender configuration change or provider migration is indicated by these successful inbox tests. An actual password submission for a real account was intentionally not performed.

## References

- [Firebase authentication email custom domains](https://firebase.google.com/docs/auth/email-custom-domain)
- [Identity Platform email configuration](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config)
- [Zoho message headers and Show Original](https://www.zoho.com/mail/help/mail-options.html)
- [Firebase Admin SDK custom email delivery](https://firebase.google.com/docs/auth/admin/email-action-links)
