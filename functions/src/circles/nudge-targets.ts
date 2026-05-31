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
  todayCoveredUids,
  viewerUid,
}: {
  coveredCounts: ReadonlyMap<string, number>;
  members: NudgeMemberCandidate[];
  requiredTapIns: number;
  todayCoveredUids: ReadonlySet<string>;
  viewerUid: string;
}) {
  return members
    .map(member => asOptionalString(member.data.uid) ?? member.id)
    .filter(targetUid =>
      Boolean(
        targetUid &&
          targetUid !== viewerUid &&
          !todayCoveredUids.has(targetUid) &&
          (coveredCounts.get(targetUid) ?? 0) < requiredTapIns,
      ),
    );
}
