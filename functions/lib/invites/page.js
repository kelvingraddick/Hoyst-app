"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInvitePage = renderInvitePage;
const commitment_appearance_1 = require("../shared/commitment-appearance");
const page_1 = require("../website/page");
const testFlightUrl = 'https://testflight.apple.com/join/uzrHGy3t';
function renderInvitePage({ description, inviteCode, preview, statusCode, title, }) {
    const available = statusCode === 200 && preview && inviteCode;
    const appearance = preview
        ? (0, commitment_appearance_1.resolveAppearance)(preview.category, preview.appearance)
        : undefined;
    const status = preview?.isFull
        ? 'Circle full'
        : preview?.joinMode === 'request_to_join'
            ? 'Approval required'
            : preview?.joinMode === 'invite_only'
                ? 'Invite only'
                : 'Open to join';
    const guidance = preview?.isFull
        ? 'This Circle is full. Existing members can still open it in Hoyst.'
        : preview?.joinMode === 'request_to_join'
            ? 'Request to join in Hoyst. The Circle owner will review your request.'
            : preview?.joinMode === 'invite_only'
                ? 'This link is your invitation. Finish joining your Circle in Hoyst.'
                : 'A shared goal. A little support. Your next step starts here.';
    const cadence = preview?.commitmentCadence === 'weekly' && preview.commitmentFrequency
        ? `${preview.commitmentFrequency.tapInsPerWeek} Tap Ins per week`
        : preview?.commitmentCadence === 'monthly' && preview.commitmentFrequency
            ? `${preview.commitmentFrequency.opportunitiesPerPeriod ??
                preview.commitmentFrequency.tapInsPerWeek} Tap Ins per month`
            : preview?.cadenceLabel || '';
    const detail = preview
        ? `
    <span class="category-label" style="color:${appearance.foreground};background:${appearance.background}">${(0, page_1.escapeHtml)(appearance.emoji)} ${(0, page_1.escapeHtml)(preview.category)}</span>
    <h1>${(0, page_1.escapeHtml)(preview.title)}</h1>
    ${preview.commitment.trim().toLowerCase() !==
            preview.title.trim().toLowerCase()
            ? `<p class="invite-description">${(0, page_1.escapeHtml)(preview.commitment)}</p>`
            : ''}
    <div class="invite-meta"><span>${(0, page_1.escapeHtml)(cadence)}</span><span>${preview.memberCount} of ${preview.maxSize} members</span><span>${status}</span></div>
    <p class="invite-status">${guidance}</p>`
        : `<p class="eyebrow">Hoyst Circle invitation</p><h1>${(0, page_1.escapeHtml)(title)}</h1><p class="invite-description">${(0, page_1.escapeHtml)(description)}</p>`;
    return (0, page_1.websitePage)({
        title,
        description,
        analytics: true,
        content: `
    <main id="main" tabindex="-1" class="invite-main"><section class="invite-panel" aria-label="${preview ? 'Circle invitation' : 'Unavailable invitation'}">
      <div class="invite-welcome"><img src="/assets/hoy-green.webp" width="384" height="384" alt="Hoy, Hoyst’s friendly green companion"><p class="speech">${available ? 'You’re<br>invited.' : 'Another Circle<br>is out there.'}</p></div>
      <div class="invite-copy">${detail}<div class="invite-actions">
        ${available
            ? `<a class="button" data-beta-action="open_app" href="hoyst://join/${(0, page_1.escapeHtml)(inviteCode)}">Open Hoyst</a><a class="button button-outline" data-beta-action="testflight" href="${testFlightUrl}">Install with TestFlight</a><p class="install-note">New here? Install Hoyst, return to this page, then tap <strong>Open Hoyst</strong>.</p>`
            : `<a class="button" data-beta-action="testflight" href="${testFlightUrl}">Try Hoyst on iPhone</a><a class="button button-outline" href="/">Learn about Hoyst</a>`}
        <p class="install-note">Free iPhone beta. United States. Ages 18+.<br>Need help? <a href="mailto:development@wavelinkllc.com">Email Hoyst</a> or <a data-beta-action="support" data-channel="instagram" href="https://www.instagram.com/kg.codes/">message @kg.codes</a>.</p>
      </div></div></section></main>`,
    });
}
