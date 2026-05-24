export type CommitmentCadence = 'daily' | 'weekly';

type CommitmentInput = {
  commitmentCadence?: unknown;
  commitmentFrequency?: {
    tapInsPerWeek?: unknown;
  };
};

export function getTapInsPerWeek(circle: CommitmentInput | undefined) {
  const value = circle?.commitmentFrequency?.tapInsPerWeek;

  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(7, Math.max(1, Math.round(value)))
    : 7;
}

export function getCommitmentCadence(
  circle: CommitmentInput | undefined,
): CommitmentCadence {
  const value = circle?.commitmentCadence;

  if (value === 'daily' || value === 'weekly') {
    return value;
  }

  return getTapInsPerWeek(circle) >= 7 ? 'daily' : 'weekly';
}

export function getRequiredTapIns(circle: CommitmentInput | undefined) {
  return getCommitmentCadence(circle) === 'daily' ? 1 : getTapInsPerWeek(circle);
}

export function getStoredCommitmentFrequency(
  cadence: CommitmentCadence,
  frequency: {tapInsPerWeek?: unknown} | undefined,
) {
  if (cadence === 'daily') {
    return {tapInsPerWeek: 7};
  }

  const value = frequency?.tapInsPerWeek;

  return {
    tapInsPerWeek:
      typeof value === 'number' && Number.isFinite(value)
        ? Math.min(7, Math.max(1, Math.round(value)))
        : 7,
  };
}

export function getInputCommitmentCadence(
  cadence: unknown,
  frequency: {tapInsPerWeek?: unknown} | undefined,
): CommitmentCadence {
  if (cadence === 'daily' || cadence === 'weekly') {
    return cadence;
  }

  return getTapInsPerWeek({commitmentFrequency: frequency}) >= 7
    ? 'daily'
    : 'weekly';
}
