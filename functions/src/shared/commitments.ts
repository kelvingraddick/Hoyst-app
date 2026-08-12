export type CommitmentPace = 'daily' | 'weekly' | 'monthly';
/** @deprecated Retained for the legacy `commitmentCadence` wire contract. */
export type CommitmentCadence = CommitmentPace;
export type CommitmentType = 'build' | 'limit' | 'avoid';
export type CheckInStatus = 'done' | 'skip' | 'partial' | 'failed';
export type CheckInCoverageStatus =
  | 'covered'
  | 'skipped'
  | 'partial'
  | 'failed';

type CommitmentInput = {
  commitmentCadence?: unknown;
  commitmentFrequency?: {
    opportunitiesPerPeriod?: unknown;
    tapInsPerWeek?: unknown;
  };
  commitmentType?: unknown;
  maximumValue?: unknown;
  minimumValue?: unknown;
  stepValue?: unknown;
  targetValue?: unknown;
  unitLabel?: unknown;
};

type CheckInInput = {
  coverageStatus?: unknown;
  status?: unknown;
};

export type CommitmentQuantityConfig = {
  maximumValue?: number;
  minimumValue?: number;
  stepValue: number;
  targetValue?: number;
  unitLabel: string;
};

export function clampOpportunitiesPerPeriod(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(31, Math.max(1, Math.round(value)))
    : fallback;
}

function clampPositiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function clampStepValue() {
  return 1;
}

function getUnitLabel(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 32)
    : 'Tap In';
}

export function getCommitmentType(
  circle: CommitmentInput | undefined,
): CommitmentType {
  const value = circle?.commitmentType;

  if (value === 'limit' || value === 'avoid' || value === 'build') {
    return value;
  }

  return 'build';
}

export function getQuantityConfig(
  circle: CommitmentInput | undefined,
): CommitmentQuantityConfig {
  const commitmentType = getCommitmentType(circle);
  const stepValue = clampStepValue();
  const unitLabel = getUnitLabel(circle?.unitLabel);

  if (commitmentType === 'avoid') {
    return {stepValue: 1, targetValue: 1, unitLabel};
  }

  if (commitmentType === 'limit') {
    const maximumValue = clampPositiveNumber(
      circle?.maximumValue ?? circle?.targetValue,
      1,
    );
    const minimumValue =
      typeof circle?.minimumValue === 'number' &&
      Number.isFinite(circle.minimumValue)
        ? Math.max(0, Math.round(Math.min(circle.minimumValue, maximumValue)))
        : undefined;

    return {
      maximumValue,
      ...(typeof minimumValue === 'number' ? {minimumValue} : {}),
      stepValue,
      unitLabel,
    };
  }

  return {
    stepValue,
    targetValue: clampPositiveNumber(circle?.targetValue, 1),
    unitLabel,
  };
}

export function isSingleTapInCommitment(circle: CommitmentInput | undefined) {
  const commitmentType = getCommitmentType(circle);
  const quantityConfig = getQuantityConfig(circle);

  return (
    commitmentType === 'build' &&
    (quantityConfig.targetValue ?? 1) <= 1 &&
    quantityConfig.stepValue === 1
  );
}

export function getCoverageStatusForTapIn({
  circle,
  currentValue,
  status,
}: {
  circle: CommitmentInput | undefined;
  currentValue?: unknown;
  status: 'done' | 'skip';
}): CheckInCoverageStatus {
  if (status === 'skip') {
    return 'skipped';
  }

  const commitmentType = getCommitmentType(circle);
  const quantityConfig = getQuantityConfig(circle);

  if (commitmentType === 'avoid' || isSingleTapInCommitment(circle)) {
    return 'covered';
  }

  const value = clampPositiveNumber(currentValue, 0);

  if (commitmentType === 'limit') {
    const maximumValue = quantityConfig.maximumValue ?? 1;
    const minimumValue = quantityConfig.minimumValue;

    if (
      (typeof minimumValue === 'number' && value < minimumValue) ||
      value > maximumValue
    ) {
      return 'failed';
    }

    return 'covered';
  }

  return value >= (quantityConfig.targetValue ?? 1) ? 'covered' : 'partial';
}

export function getCheckInStatusForCoverage(
  coverageStatus: CheckInCoverageStatus,
): CheckInStatus {
  if (coverageStatus === 'skipped') {
    return 'skip';
  }

  if (coverageStatus === 'covered') {
    return 'done';
  }

  return coverageStatus;
}

export function isCoveredCheckInData(checkIn: CheckInInput | undefined) {
  if (!checkIn) {
    return false;
  }

  if (checkIn.status === 'skip') {
    return true;
  }

  if (checkIn.status !== 'done') {
    return false;
  }

  return (
    checkIn.coverageStatus === undefined || checkIn.coverageStatus === 'covered'
  );
}

export function getTapInsPerWeek(circle: CommitmentInput | undefined) {
  const value = circle?.commitmentFrequency?.tapInsPerWeek;

  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(7, Math.max(1, Math.round(value)))
    : 7;
}

export function getCommitmentPace(
  circle: CommitmentInput | undefined,
): CommitmentPace {
  const value = circle?.commitmentCadence;

  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }

  return getTapInsPerWeek(circle) >= 7 ? 'daily' : 'weekly';
}

export function getRequiredTapIns(circle: CommitmentInput | undefined) {
  const pace = getCommitmentPace(circle);

  if (pace === 'daily') {
    return 1;
  }

  if (pace === 'monthly') {
    return clampOpportunitiesPerPeriod(
      circle?.commitmentFrequency?.opportunitiesPerPeriod,
      getTapInsPerWeek(circle),
    );
  }

  return getTapInsPerWeek(circle);
}

export function getStoredCommitmentFrequency(
  pace: CommitmentPace,
  frequency: {tapInsPerWeek?: unknown} | undefined,
) {
  if (pace === 'daily') {
    return {tapInsPerWeek: 7};
  }

  const value = frequency?.tapInsPerWeek;
  const opportunitiesPerPeriod =
    pace === 'monthly'
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

export function getInputCommitmentPace(
  pace: unknown,
  frequency: {tapInsPerWeek?: unknown} | undefined,
): CommitmentPace {
  if (pace === 'daily' || pace === 'weekly' || pace === 'monthly') {
    return pace;
  }

  return getTapInsPerWeek({commitmentFrequency: frequency}) >= 7
    ? 'daily'
    : 'weekly';
}

/** @deprecated Use getCommitmentPace after reading the legacy wire field. */
export const getCommitmentCadence = getCommitmentPace;

/** @deprecated Use getInputCommitmentPace for legacy callable input. */
export const getInputCommitmentCadence = getInputCommitmentPace;
