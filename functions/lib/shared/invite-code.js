"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInviteCode = createInviteCode;
exports.normalizeInviteCode = normalizeInviteCode;
exports.getCircleInviteUrl = getCircleInviteUrl;
exports.requiresMatchingCircleInvite = requiresMatchingCircleInvite;
exports.buildCircleInvitePreview = buildCircleInvitePreview;
const node_crypto_1 = require("node:crypto");
const inviteCodePattern = /^[a-z0-9]{6,32}$/;
function asNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function asNonNegativeInteger(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : fallback;
}
function createInviteCode() {
    return (0, node_crypto_1.randomBytes)(8).toString('hex');
}
function normalizeInviteCode(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return inviteCodePattern.test(normalized) ? normalized : undefined;
}
function getCircleInviteUrl(inviteCode) {
    return `https://hoyst.app/join/${inviteCode}`;
}
function requiresMatchingCircleInvite(circle) {
    return circle?.privacy === 'private' || circle?.joinMode === 'invite_only';
}
function buildCircleInvitePreview(circleId, circle) {
    if (!circle ||
        circle.circleMode === 'personal' ||
        circle.lifecycleStatus === 'archived') {
        return undefined;
    }
    const title = asNonEmptyString(circle.title);
    const commitment = asNonEmptyString(circle.commitment);
    if (!title || !commitment) {
        return undefined;
    }
    const memberCount = asNonNegativeInteger(circle.memberCount, 0);
    const maxSize = Math.max(1, asNonNegativeInteger(circle.maxSize, Math.max(memberCount, 1)));
    const joinMode = circle.joinMode === 'open' ||
        circle.joinMode === 'request_to_join' ||
        circle.joinMode === 'invite_only'
        ? circle.joinMode
        : 'request_to_join';
    const cadenceLabel = circle.commitmentCadence === 'monthly'
        ? 'Monthly'
        : circle.commitmentCadence === 'weekly'
            ? 'Weekly'
            : 'Daily';
    return {
        cadenceLabel,
        circleId,
        commitment,
        isFull: memberCount >= maxSize,
        joinMode,
        maxSize,
        memberCount,
        title,
    };
}
