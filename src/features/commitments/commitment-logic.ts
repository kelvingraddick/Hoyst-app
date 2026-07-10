import type {
  CheckInCoverageStatus,
  CheckInStatus,
  CircleSummary,
  CommitmentQuantityConfig,
  CommitmentType,
} from '../../types/models';

type CommitmentLike = Pick<
  CircleSummary,
  | 'commitmentType'
  | 'maximumValue'
  | 'minimumValue'
  | 'stepValue'
  | 'targetValue'
  | 'unitLabel'
>;

type CheckInLike = {
  coverageStatus?: unknown;
  status?: unknown;
};

function asNonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function asStepValue() {
  return 1;
}

function asUnitLabel(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 32)
    : 'Tap In';
}

export function getCommitmentType(
  circle: Partial<CommitmentLike> | undefined,
): CommitmentType {
  const value = circle?.commitmentType;

  if (value === 'limit' || value === 'avoid' || value === 'build') {
    return value;
  }

  return 'build';
}

export function getQuantityConfig(
  circle: Partial<CommitmentLike> | undefined,
): CommitmentQuantityConfig {
  const commitmentType = getCommitmentType(circle);
  const stepValue = asStepValue();
  const unitLabel = asUnitLabel(circle?.unitLabel);

  if (commitmentType === 'avoid') {
    return {stepValue: 1, targetValue: 1, unitLabel};
  }

  if (commitmentType === 'limit') {
    const maximumValue = asNonNegativeNumber(
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
    targetValue: asNonNegativeNumber(circle?.targetValue, 1),
    unitLabel,
  };
}

export function isSingleTapInCommitment(
  circle: Partial<CommitmentLike> | undefined,
) {
  const quantityConfig = getQuantityConfig(circle);

  return (
    getCommitmentType(circle) === 'build' &&
    (quantityConfig.targetValue ?? 1) <= 1 &&
    quantityConfig.stepValue === 1
  );
}

export function getCoverageStatusForValue({
  circle,
  currentValue,
}: {
  circle: Partial<CommitmentLike> | undefined;
  currentValue: number;
}): CheckInCoverageStatus {
  const commitmentType = getCommitmentType(circle);
  const quantityConfig = getQuantityConfig(circle);
  const value = asNonNegativeNumber(currentValue, 0);

  if (commitmentType === 'avoid' || isSingleTapInCommitment(circle)) {
    return 'covered';
  }

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
): Exclude<CheckInStatus, 'rest'> {
  if (coverageStatus === 'skipped') {
    return 'skip';
  }

  if (coverageStatus === 'covered') {
    return 'done';
  }

  return coverageStatus;
}

export function isCoveredCheckInData(checkIn: CheckInLike | undefined) {
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

export function formatQuantityValue(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(1))}`;
}

export function formatQuantityUnit(value: number, unitLabel: string) {
  const cleanUnit = unitLabel.trim() || 'unit';

  if (value === 1 || cleanUnit.endsWith('s')) {
    return cleanUnit;
  }

  return `${cleanUnit}s`;
}

export function formatQuantityLabel(value: number, unitLabel: string) {
  return `${formatQuantityValue(value)} ${formatQuantityUnit(
    value,
    unitLabel,
  )}`;
}
