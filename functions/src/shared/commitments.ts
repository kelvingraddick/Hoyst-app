export type CommitmentCadence = 'daily' | 'weekly' | 'monthly';

type CommitmentInput = {
  commitmentCadence?: unknown;
  commitmentFrequency?: {
    opportunitiesPerPeriod?: unknown;
    tapInsPerWeek?: unknown;
  };
};

export function clampOpportunitiesPerPeriod(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(31, Math.max(1, Math.round(value)))
    : fallback;
}

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

  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }

  return getTapInsPerWeek(circle) >= 7 ? 'daily' : 'weekly';
}

export function getRequiredTapIns(circle: CommitmentInput | undefined) {
  const cadence = getCommitmentCadence(circle);

  if (cadence === 'daily') {
    return 1;
  }

  if (cadence === 'monthly') {
    return clampOpportunitiesPerPeriod(
      circle?.commitmentFrequency?.opportunitiesPerPeriod,
      getTapInsPerWeek(circle),
    );
  }

  return getTapInsPerWeek(circle);
}

export function getStoredCommitmentFrequency(
  cadence: CommitmentCadence,
  frequency: {tapInsPerWeek?: unknown} | undefined,
) {
  if (cadence === 'daily') {
    return {tapInsPerWeek: 7};
  }

  const value = frequency?.tapInsPerWeek;
  const opportunitiesPerPeriod =
    cadence === 'monthly'
      ? clampOpportunitiesPerPeriod(
          (frequency as {opportunitiesPerPeriod?: unknown} | undefined)
            ?.opportunitiesPerPeriod,
          typeof value === 'number' && Number.isFinite(value)
            ? Math.min(7, Math.max(1, Math.round(value)))
            : 4,
        )
      : undefined;

  return {
    ...(opportunitiesPerPeriod ? {opportunitiesPerPeriod} : {}),
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
  if (cadence === 'daily' || cadence === 'weekly' || cadence === 'monthly') {
    return cadence;
  }

  return getTapInsPerWeek({commitmentFrequency: frequency}) >= 7
    ? 'daily'
    : 'weekly';
}
