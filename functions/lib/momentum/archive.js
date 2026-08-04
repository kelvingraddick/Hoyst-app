"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.neutralizeCircleSlotAggregateForArchive = neutralizeCircleSlotAggregateForArchive;
function asStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function neutralizeCircleSlotAggregateForArchive(data, archiveDateKey) {
    const completedMemberUids = asStringArray(data?.completedMemberUids);
    const coveredMemberUids = asStringArray(data?.coveredMemberUids);
    const skippedMemberUids = asStringArray(data?.skippedMemberUids);
    const expiresDateKey = typeof data?.expiresDateKey === 'string' ? data.expiresDateKey : '';
    const expectedMemberUids = expiresDateKey && expiresDateKey < archiveDateKey
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
