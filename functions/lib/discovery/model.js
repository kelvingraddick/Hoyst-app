"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.millis = millis;
exports.searchWords = searchWords;
exports.searchTokens = searchTokens;
exports.matchesWords = matchesWords;
exports.isPublicActive = isPublicActive;
exports.activityEpoch = activityEpoch;
exports.isSuccessfulDone = isSuccessfulDone;
exports.canPublishNewTapIn = canPublishNewTapIn;
exports.validCandidate = validCandidate;
exports.publicPreview = publicPreview;
function millis(value) {
    if (value &&
        typeof value === 'object' &&
        'toMillis' in value &&
        typeof value.toMillis === 'function') {
        return value.toMillis();
    }
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function searchWords(value) {
    return [
        ...new Set(value
            .normalize('NFKD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .match(/[\p{L}\p{N}]+/gu) ?? []),
    ];
}
function searchTokens(circle) {
    const words = searchWords([circle.title, circle.category, circle.commitment]
        .filter(value => typeof value === 'string')
        .join(' '));
    return [
        ...new Set(words.flatMap(word => Array.from({ length: Math.min(word.length, 40) }, (_, index) => word.slice(0, index + 1)))),
    ].sort();
}
function matchesWords(tokens, words) {
    return words.every(word => tokens.includes(word));
}
function isPublicActive(circle) {
    return Boolean(circle &&
        circle.privacy === 'public' &&
        circle.circleMode !== 'personal' &&
        circle.lifecycleStatus !== 'archived');
}
function activityEpoch(circle) {
    return millis(circle.publicActivityEpoch ?? circle.createdAt);
}
function isSuccessfulDone(checkIn) {
    return Boolean(checkIn?.deletionReason !== 'account' &&
        checkIn?.status === 'done' &&
        (checkIn.coverageStatus === undefined ||
            checkIn.coverageStatus === 'covered'));
}
function canPublishNewTapIn({ circle, before, nextStatus, activatedAt, now, }) {
    const activation = millis(activatedAt);
    return (isPublicActive(circle) &&
        activation > 0 &&
        now >= activation &&
        nextStatus === 'done' &&
        !isSuccessfulDone(before));
}
function validCandidate({ candidate, circle, checkIn, member, profile, }) {
    const marker = checkIn?.publicTapIn;
    return Boolean(isPublicActive(circle) &&
        isSuccessfulDone(checkIn) &&
        member?.status === 'active' &&
        profile &&
        marker &&
        marker.eventId === candidate.eventId &&
        millis(marker.occurredAt) === millis(candidate.occurredAt) &&
        marker.epoch === activityEpoch(circle) &&
        millis(member.joinedAt) <= millis(candidate.occurredAt));
}
function publicPreview(candidate, profile) {
    return {
        eventId: String(candidate.eventId),
        uid: String(candidate.uid),
        displayName: typeof profile.displayName === 'string' && profile.displayName.trim()
            ? profile.displayName.trim()
            : 'Hoyst Member',
        ...(typeof profile.avatarUrl === 'string' && profile.avatarUrl
            ? { avatarUrl: profile.avatarUrl }
            : {}),
        occurredAt: new Date(millis(candidate.occurredAt)).toISOString(),
    };
}
