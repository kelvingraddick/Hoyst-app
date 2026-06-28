"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNudgeTargetUids = getNudgeTargetUids;
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function getNudgeTargetUids({ coveredCounts, members, requiredTapIns, targetUid, todayCoveredUids, viewerUid, }) {
    const eligibleTargetUids = members
        .map(member => asOptionalString(member.data.uid) ?? member.id)
        .filter(candidateUid => Boolean(candidateUid &&
        candidateUid !== viewerUid &&
        !todayCoveredUids.has(candidateUid) &&
        (coveredCounts.get(candidateUid) ?? 0) < requiredTapIns));
    if (!targetUid) {
        return eligibleTargetUids;
    }
    return eligibleTargetUids.includes(targetUid) ? [targetUid] : [];
}
