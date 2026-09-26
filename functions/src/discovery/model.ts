/** Shared pure discovery rules. No feed text, notes or Tap In media enter this projection. */
type Data = Record<string, any>;
export function millis(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis();
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
export function searchWords(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ];
}
export function searchTokens(circle: Data): string[] {
  const words = searchWords(
    [circle.title, circle.category, circle.commitment]
      .filter(value => typeof value === 'string')
      .join(' '),
  );
  return [
    ...new Set(
      words.flatMap(word =>
        Array.from({length: Math.min(word.length, 40)}, (_, index) =>
          word.slice(0, index + 1),
        ),
      ),
    ),
  ].sort();
}
export function matchesWords(tokens: string[], words: string[]) {
  return words.every(word => tokens.includes(word));
}
export function isPublicActive(circle?: Data): boolean {
  return Boolean(
    circle &&
      circle.privacy === 'public' &&
      circle.circleMode !== 'personal' &&
      circle.lifecycleStatus !== 'archived',
  );
}
export function activityEpoch(circle: Data) {
  return millis(circle.publicActivityEpoch ?? circle.createdAt);
}
export function isSuccessfulDone(checkIn?: Data): boolean {
  return Boolean(
    checkIn?.deletionReason !== 'account' &&
      checkIn?.status === 'done' &&
      (checkIn.coverageStatus === undefined ||
        checkIn.coverageStatus === 'covered'),
  );
}
export function canPublishNewTapIn({
  circle,
  before,
  nextStatus,
  activatedAt,
  now,
}: {
  circle?: Data;
  before?: Data;
  nextStatus: string;
  activatedAt: unknown;
  now: number;
}): boolean {
  const activation = millis(activatedAt);
  return (
    isPublicActive(circle) &&
    activation > 0 &&
    now >= activation &&
    nextStatus === 'done' &&
    !isSuccessfulDone(before)
  );
}
export function validCandidate({
  candidate,
  circle,
  checkIn,
  member,
  profile,
}: {
  candidate: Data;
  circle?: Data;
  checkIn?: Data;
  member?: Data;
  profile?: Data;
}): boolean {
  const marker = checkIn?.publicTapIn;
  return Boolean(
    isPublicActive(circle) &&
      isSuccessfulDone(checkIn) &&
      member?.status === 'active' &&
      profile &&
      marker &&
      marker.eventId === candidate.eventId &&
      millis(marker.occurredAt) === millis(candidate.occurredAt) &&
      marker.epoch === activityEpoch(circle!) &&
      millis(member.joinedAt) <= millis(candidate.occurredAt),
  );
}
export function publicPreview(candidate: Data, profile: Data) {
  return {
    eventId: String(candidate.eventId),
    uid: String(candidate.uid),
    displayName:
      typeof profile.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim()
        : 'Hoyst Member',
    ...(typeof profile.avatarUrl === 'string' && profile.avatarUrl
      ? {avatarUrl: profile.avatarUrl}
      : {}),
    occurredAt: new Date(millis(candidate.occurredAt)).toISOString(),
  };
}
