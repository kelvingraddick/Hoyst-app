"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberTapInNotificationTargets = getMemberTapInNotificationTargets;
exports.getCircleCompleteNotificationTargets = getCircleCompleteNotificationTargets;
function getMemberTapInNotificationTargets({ actorUid, activeMemberUids, }) {
    return activeMemberUids.filter(uid => uid && uid !== actorUid);
}
function getCircleCompleteNotificationTargets({ activeMemberUids, remainingTapIns, }) {
    if (remainingTapIns > 0) {
        return [];
    }
    return activeMemberUids.filter(Boolean);
}
