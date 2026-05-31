"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNudgeTargetUids = getNudgeTargetUids;
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function getNudgeTargetUids({ coveredCounts, members, requiredTapIns, todayCoveredUids, viewerUid, }) {
    return members
        .map(member => asOptionalString(member.data.uid) ?? member.id)
        .filter(targetUid => Boolean(targetUid &&
        targetUid !== viewerUid &&
        !todayCoveredUids.has(targetUid) &&
        (coveredCounts.get(targetUid) ?? 0) < requiredTapIns));
}
