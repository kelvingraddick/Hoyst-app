function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function neutralizeCircleSlotAggregateForArchive(
  data: Record<string, unknown> | undefined,
  archiveDateKey: string,
) {
  const completedMemberUids = asStringArray(data?.completedMemberUids);
  const coveredMemberUids = asStringArray(data?.coveredMemberUids);
  const skippedMemberUids = asStringArray(data?.skippedMemberUids);
  const expiresDateKey =
    typeof data?.expiresDateKey === 'string' ? data.expiresDateKey : '';
  const expectedMemberUids =
    expiresDateKey && expiresDateKey < archiveDateKey
      ? asStringArray(data?.expectedMemberUids)
      : coveredMemberUids;

  return {
    completedMemberCount: completedMemberUids.length,
    completedMemberUids,
    coveredMemberCount: coveredMemberUids.length,
    coveredMemberUids,
    expectedMemberCount: expectedMemberUids.length,
    expectedMemberUids,
    skippedMemberCount: skippedMemberUids.length,
    skippedMemberUids,
  };
}
