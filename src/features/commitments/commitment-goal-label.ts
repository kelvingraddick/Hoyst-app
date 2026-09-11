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
    | 'targetValue'
    | 'maximumValue'
    | 'minimumValue'
    | 'unitLabel'
  >,
): CommitmentGoalPresentation | undefined {
  const type = getCommitmentType(circle);
  if (type === 'avoid' || isSingleTapInCommitment(circle)) {
    return undefined;
  }
  const config = getQuantityConfig(circle);
  if (type === 'limit') {
    const maximum = formatCommitmentQuantity(
      config.maximumValue ?? 1,
      config.unitLabel,
    );
    return typeof config.minimumValue === 'number'
      ? {
          label: 'Allowed range',
          value: `${formatQuantityValue(config.minimumValue)} to ${maximum}`,
        }
      : {label: 'Maximum', value: maximum};
  }
  return {
    label: 'Goal',
    value: formatCommitmentQuantity(config.targetValue ?? 1, config.unitLabel),
  };
}
