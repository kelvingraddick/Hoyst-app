import type {CircleSummary} from '../../types/models';
import {
  formatQuantityLabel,
  formatQuantityValue,
  getCommitmentType,
  getQuantityConfig,
  isSingleTapInCommitment,
} from './commitment-logic';

export type CommitmentGoalPresentation = {
  label: 'Allowed range' | 'Goal' | 'Maximum';
  value: string;
};

// Custom phrases such as "Hours of sleep" are already display labels.
export function formatCommitmentQuantity(value: number, unitLabel: string) {
  return unitLabel.trim().includes(' ') && unitLabel !== 'Tap In'
    ? `${formatQuantityValue(value)} ${unitLabel}`
    : formatQuantityLabel(value, unitLabel);
}

/** Shared presentation copy beneath a commitment description, not saved progress. */
export function getCommitmentGoalLabel(
  circle: Pick<
    CircleSummary,
    | 'commitmentType'
    | 'commitmentCadence'
    | 'commitmentFrequency'
    | 'targetValue'
    | 'maximumValue'
    | 'minimumValue'
    | 'unitLabel'
  >,
) {
  const presentation = getCommitmentGoalPresentation(circle);
  return presentation
    ? `${presentation.label}: ${presentation.value}`
    : undefined;
}

export function getCommitmentGoalPresentation(
  circle: Pick<
    CircleSummary,
    | 'commitmentType'
    | 'commitmentCadence'
    | 'commitmentFrequency'
    | 'targetValue'
    | 'maximumValue'
    | 'minimumValue'
    | 'unitLabel'
  >,
): CommitmentGoalPresentation | undefined {
  const type = getCommitmentType(circle);
  const config = getQuantityConfig(circle);
  const cadenceCount =
    circle.commitmentCadence === 'monthly'
      ? circle.commitmentFrequency?.opportunitiesPerPeriod ??
        circle.commitmentFrequency?.tapInsPerWeek
      : circle.commitmentCadence === 'weekly'
      ? circle.commitmentFrequency?.tapInsPerWeek
      : undefined;
  const hasCadenceGoal =
    typeof cadenceCount === 'number' &&
    Number.isFinite(cadenceCount) &&
    cadenceCount > 0;
  const cadenceGoal = hasCadenceGoal
    ? `${formatQuantityValue(Math.round(cadenceCount))} ${
        Math.round(cadenceCount) === 1 ? 'Tap In' : 'Tap Ins'
      } per ${circle.commitmentCadence === 'monthly' ? 'month' : 'week'}`
    : undefined;

  if (type === 'avoid' || isSingleTapInCommitment(circle)) {
    return cadenceGoal ? {label: 'Goal', value: cadenceGoal} : undefined;
  }

  let quantityPresentation: CommitmentGoalPresentation;
  if (type === 'limit') {
    const maximum = formatCommitmentQuantity(
      config.maximumValue ?? 1,
      config.unitLabel,
    );
    quantityPresentation =
      typeof config.minimumValue === 'number'
        ? {
            label: 'Allowed range',
            value: `${formatQuantityValue(config.minimumValue)} to ${maximum}`,
          }
        : {label: 'Maximum', value: maximum};
  } else {
    quantityPresentation = {
      label: 'Goal',
      value: formatCommitmentQuantity(
        config.targetValue ?? 1,
        config.unitLabel,
      ),
    };
  }

  if (!cadenceGoal) {
    return quantityPresentation;
  }

  return {
    label: 'Goal',
    value: `${cadenceGoal} · ${
      quantityPresentation.label === 'Goal'
        ? quantityPresentation.value
        : `${quantityPresentation.label} ${quantityPresentation.value}`
    } per Tap In`,
  };
}
