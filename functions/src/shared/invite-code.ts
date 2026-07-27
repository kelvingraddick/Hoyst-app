import {randomBytes} from 'node:crypto';

export type CircleInviteJoinMode = 'invite_only' | 'open' | 'request_to_join';

export type CircleInvitePreview = {
  cadenceLabel: string;
  circleId: string;
  commitment: string;
  isFull: boolean;
  joinMode: CircleInviteJoinMode;
  maxSize: number;
  memberCount: number;
  title: string;
};

type PlainData = Record<string, unknown>;

const inviteCodePattern = /^[a-z0-9]{6,32}$/;

function asNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

export function createInviteCode() {
  return randomBytes(8).toString('hex');
}

export function normalizeInviteCode(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return inviteCodePattern.test(normalized) ? normalized : undefined;
}

export function getCircleInviteUrl(inviteCode: string) {
  return `https://hoyst.app/join/${inviteCode}`;
}

export function requiresMatchingCircleInvite(circle: PlainData | undefined) {
  return circle?.privacy === 'private' || circle?.joinMode === 'invite_only';
}

export function buildCircleInvitePreview(
  circleId: string,
  circle: PlainData | undefined,
): CircleInvitePreview | undefined {
  if (!circle || circle.circleMode === 'personal') {
    return undefined;
  }

  const title = asNonEmptyString(circle.title);
  const commitment = asNonEmptyString(circle.commitment);

  if (!title || !commitment) {
    return undefined;
  }

  const memberCount = asNonNegativeInteger(circle.memberCount, 0);
  const maxSize = Math.max(
    1,
    asNonNegativeInteger(circle.maxSize, Math.max(memberCount, 1)),
  );
  const joinMode: CircleInviteJoinMode =
    circle.joinMode === 'open' ||
    circle.joinMode === 'request_to_join' ||
    circle.joinMode === 'invite_only'
      ? circle.joinMode
      : 'request_to_join';
  const cadenceLabel =
    circle.commitmentCadence === 'monthly'
      ? 'Monthly'
      : circle.commitmentCadence === 'weekly'
      ? 'Weekly'
      : 'Daily';

  return {
    cadenceLabel,
    circleId,
    commitment,
    isFull: memberCount >= maxSize,
    joinMode,
    maxSize,
    memberCount,
    title,
  };
}
