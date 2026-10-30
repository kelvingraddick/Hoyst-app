"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.websiteHeaders = void 0;
exports.escapeHtml = escapeHtml;
exports.websitePage = websitePage;
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function websitePage({ title, description, content, analytics = false, }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#FAFAF7"><meta name="referrer" content="strict-origin"><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Hoyst"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="https://hoyst.app/assets/hoyst-icon.png"><meta name="twitter:card" content="summary"><link rel="icon" href="/assets/hoyst-icon.png"><link rel="stylesheet" href="/site.css"><title>${escapeHtml(title)} | Hoyst</title></head><body class="invite-page"><a class="skip-link" href="#main">Skip to content</a><header class="site-header shell"><a class="brand" href="/" aria-label="Hoyst home"><img src="/assets/hoyst-logo-black.webp" width="380" height="160" alt="Hoyst"></a><a class="text-link" href="/#how-it-works">Meet Hoyst</a></header>${content}<footer class="site-footer shell"><span>Your goals deserve good company.</span><div class="footer-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a data-beta-action="support" href="mailto:development@wavelinkllc.com">Contact Hoyst</a>${analytics
        ? '<button type="button" data-analytics-toggle>Analytics preferences</button>'
        : ''}</div></footer>${analytics
        ? '<script src="/beta-config.js"></script><script src="/beta.js" defer></script>'
        : ''}</body></html>`;
}
exports.websiteHeaders = {
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self' https://us.i.posthog.com https://eu.i.posthog.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'strict-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
};
