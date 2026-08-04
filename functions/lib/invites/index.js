"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitePage = exports.rotateCircleInvite = exports.resolveCircleInvite = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const circle_lifecycle_1 = require("../shared/circle-lifecycle");
const invite_code_1 = require("../shared/invite-code");
const resolveInviteSchema = zod_1.z.object({
    inviteCode: zod_1.z.string().trim(),
});
const rotateInviteSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
const testFlightUrl = 'https://testflight.apple.com/join/uzrHGy3t';
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function getJoinLabel(preview) {
    if (preview.isFull) {
        return 'Circle full';
    }
    if (preview.joinMode === 'request_to_join') {
        return 'Approval required';
    }
    if (preview.joinMode === 'invite_only') {
        return 'Invite only';
    }
    return 'Open to join';
}
async function findCircleInvite(inviteCode) {
    const snapshots = await firebase_1.db
        .collection('circles')
        .where('inviteCode', '==', inviteCode)
        .limit(2)
        .get();
    if (snapshots.size !== 1) {
        if (snapshots.size > 1) {
            console.error('circle_invite_lookup_ambiguous', {
                matchingCircleCount: snapshots.size,
            });
        }
        return undefined;
    }
    const snapshot = snapshots.docs[0];
    return (0, invite_code_1.buildCircleInvitePreview)(snapshot.id, snapshot.data());
}
async function createUniqueInviteCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const inviteCode = (0, invite_code_1.createInviteCode)();
        const existing = await firebase_1.db
            .collection('circles')
            .where('inviteCode', '==', inviteCode)
            .limit(1)
            .get();
        if (existing.empty) {
            return inviteCode;
        }
    }
    throw new https_1.HttpsError('internal', 'Could not create a unique invite link. Try again.');
}
function parseInviteCodeFromPath(path) {
    const match = path.match(/(?:^|\/)join\/([^/?#]+)/i);
    if (!match?.[1]) {
        return undefined;
    }
    try {
        return (0, invite_code_1.normalizeInviteCode)(decodeURIComponent(match[1]));
    }
    catch {
        return undefined;
    }
}
function renderUnavailablePage() {
    return renderPage({
        description: 'This Circle invitation is no longer available. Ask the Circle owner for a new link.',
        statusCode: 404,
        title: 'Invite no longer available',
    });
}
function renderPage({ description, inviteCode, preview, statusCode, title, }) {
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);
    const escapedInviteCode = inviteCode ? escapeHtml(inviteCode) : undefined;
    const openAppUrl = escapedInviteCode
        ? `hoyst://join/${escapedInviteCode}`
        : undefined;
    const joinLabel = preview ? escapeHtml(getJoinLabel(preview)) : undefined;
    const memberLabel = preview
        ? `${preview.memberCount} of ${preview.maxSize} members`
        : undefined;
    const actionMarkup = statusCode === 200 && openAppUrl
        ? `
        <a class="button button-primary" href="${openAppUrl}">Open Hoyst</a>
        <a class="button button-secondary" href="${testFlightUrl}">Install with TestFlight</a>
        <p class="install-note">New here? Install Hoyst, return to this page, then tap <strong>Open Hoyst</strong>.</p>
      `
        : `
        <a class="button button-secondary" href="${testFlightUrl}">Get Hoyst on TestFlight</a>
      `;
    const previewMarkup = preview
        ? `
      <section class="invite-card" aria-label="Circle invitation">
        <div class="eyebrow">You’re invited to a Circle</div>
        <h1>${escapeHtml(preview.title)}</h1>
        <p class="commitment">${escapeHtml(preview.commitment)}</p>
        <div class="meta">
          <span>${escapeHtml(preview.cadenceLabel)}</span>
          <span>${escapeHtml(memberLabel ?? '')}</span>
          <span>${joinLabel}</span>
        </div>
        <div class="actions">${actionMarkup}</div>
      </section>
    `
        : `
      <section class="invite-card unavailable" aria-label="Unavailable invitation">
        <div class="eyebrow">Hoyst Circle invitation</div>
        <h1>${escapedTitle}</h1>
        <p class="commitment">${escapedDescription}</p>
        <div class="actions">${actionMarkup}</div>
      </section>
    `;
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <meta name="theme-color" content="#090B12">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Hoyst">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDescription}">
    <meta property="og:image" content="https://hoyst.app/assets/hoyst-icon.png">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${escapedDescription}">
    <title>${escapedTitle} | Hoyst</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #090B12;
        color: #fff;
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 28px 18px;
        background:
          radial-gradient(circle at 18% 12%, rgba(122, 85, 255, .28), transparent 34%),
          radial-gradient(circle at 82% 24%, rgba(24, 185, 255, .20), transparent 32%),
          radial-gradient(circle at 56% 86%, rgba(16, 185, 103, .15), transparent 35%),
          #090B12;
      }
      main { width: min(100%, 620px); }
      .brand {
        width: 132px;
        display: block;
        margin: 0 auto 30px;
      }
      .invite-card {
        padding: clamp(26px, 6vw, 44px);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 30px;
        background: rgba(18, 20, 34, .76);
        box-shadow: 0 24px 80px rgba(0,0,0,.38);
        backdrop-filter: blur(22px);
      }
      .eyebrow {
        color: #9E87FF;
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .13em;
        text-transform: uppercase;
      }
      h1 {
        margin: 12px 0 12px;
        font-size: clamp(2rem, 8vw, 3.6rem);
        line-height: .98;
        letter-spacing: -.045em;
      }
      .commitment {
        margin: 0;
        color: #CBD2E3;
        font-size: 1.08rem;
        line-height: 1.55;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 24px;
      }
      .meta span {
        padding: 8px 12px;
        border-radius: 999px;
        color: #E8E5FF;
        background: rgba(122,85,255,.16);
        border: 1px solid rgba(158,135,255,.26);
        font-size: .83rem;
        font-weight: 750;
      }
      .actions {
        display: grid;
        gap: 12px;
        margin-top: 30px;
      }
      .button {
        min-height: 54px;
        display: grid;
        place-items: center;
        padding: 14px 20px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 800;
      }
      .button-primary {
        color: #fff;
        background: linear-gradient(135deg, #5A1CFF, #7A55FF);
      }
      .button-secondary {
        color: #fff;
        border: 1px solid rgba(255,255,255,.22);
        background: rgba(255,255,255,.07);
      }
      .install-note {
        margin: 4px 4px 0;
        text-align: center;
        color: #9FA8BD;
        font-size: .86rem;
        line-height: 1.45;
      }
      footer {
        margin-top: 22px;
        text-align: center;
        color: #737D94;
        font-size: .8rem;
      }
    </style>
  </head>
  <body>
    <main>
      <img class="brand" src="/assets/hoyst-logo.png" alt="Hoyst">
      ${previewMarkup}
      <footer>Consistency feels lighter with the right support.</footer>
    </main>
  </body>
</html>`;
}
exports.resolveCircleInvite = (0, https_1.onCall)(async (request) => {
    const input = resolveInviteSchema.parse(request.data);
    const inviteCode = (0, invite_code_1.normalizeInviteCode)(input.inviteCode);
    if (!inviteCode) {
        throw new https_1.HttpsError('not-found', 'Invite no longer available.');
    }
    const preview = await findCircleInvite(inviteCode);
    if (!preview) {
        throw new https_1.HttpsError('not-found', 'Invite no longer available.');
    }
    return preview;
});
exports.rotateCircleInvite = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    const input = rotateInviteSchema.parse(request.data);
    const inviteCode = await createUniqueInviteCode();
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
        ]);
        const circle = circleSnapshot.data();
        const member = memberSnapshot.data();
        if (!circleSnapshot.exists || !circle || circle.circleMode === 'personal') {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        (0, circle_lifecycle_1.ensureActiveCircle)(circle, 'resetting its invite link');
        if (circle.ownerId !== uid ||
            member?.role !== 'owner' ||
            member.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Only the Circle owner can reset its invite link.');
        }
        transaction.update(circleRef, {
            inviteCode,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return {
        inviteCode,
        inviteUrl: (0, invite_code_1.getCircleInviteUrl)(inviteCode),
    };
});
exports.invitePage = (0, https_1.onRequest)(async (request, response) => {
    response.set({
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
    });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.status(405).send(renderUnavailablePage());
        return;
    }
    const inviteCode = parseInviteCodeFromPath(request.path);
    if (!inviteCode) {
        response.status(404).send(renderUnavailablePage());
        return;
    }
    const preview = await findCircleInvite(inviteCode);
    if (!preview) {
        response.status(404).send(renderUnavailablePage());
        return;
    }
    response.status(200).send(renderPage({
        description: `${preview.commitment} · ${preview.cadenceLabel}`,
        inviteCode,
        preview,
        statusCode: 200,
        title: `Join ${preview.title} on Hoyst`,
    }));
});
