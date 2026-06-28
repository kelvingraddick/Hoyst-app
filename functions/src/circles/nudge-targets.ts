export type NudgeMemberCandidate = {
  data: Record<string, unknown>;
  id: string;
};

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function getNudgeTargetUids({
  coveredCounts,
  members,
  requiredTapIns,
  targetUid,
  todayCoveredUids,
  viewerUid,
}: {
  coveredCounts: ReadonlyMap<string, number>;
  members: NudgeMemberCandidate[];
  requiredTapIns: number;
  targetUid?: string;
  todayCoveredUids: ReadonlySet<string>;
  viewerUid: string;
}) {
  const eligibleTargetUids = members
    .map(member => asOptionalString(member.data.uid) ?? member.id)
    .filter(candidateUid =>
      Boolean(
        candidateUid &&
          candidateUid !== viewerUid &&
          !todayCoveredUids.has(candidateUid) &&
          (coveredCounts.get(candidateUid) ?? 0) < requiredTapIns,
      ),
    );

  if (!targetUid) {
    return eligibleTargetUids;
  }

  return eligibleTargetUids.includes(targetUid) ? [targetUid] : [];
}
