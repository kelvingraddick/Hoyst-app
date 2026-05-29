export function getCompanionTapInNotificationTargets({
  actorUid,
  activeMemberUids,
}: {
  actorUid: string;
  activeMemberUids: string[];
}) {
  return activeMemberUids.filter(uid => uid && uid !== actorUid);
}

export function getCircleCompleteNotificationTargets({
  activeMemberUids,
  remainingTapIns,
}: {
  activeMemberUids: string[];
  remainingTapIns: number;
}) {
  if (remainingTapIns > 0) {
    return [];
  }

  return activeMemberUids.filter(Boolean);
}
