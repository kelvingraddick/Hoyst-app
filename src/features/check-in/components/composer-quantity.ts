import type {CircleDetailModel} from '../../../types/models';
import {
  formatQuantityLabel,
  formatQuantityValue,
  getCommitmentType,
  getCoverageStatusForValue,
  getQuantityConfig,
} from '../../commitments/commitment-logic';

/** Presentation only: coverage and quantity normalization stay in commitment-logic. */
export function getComposerQuantity(circle: CircleDetailModel, value: number) {
  const config = getQuantityConfig(circle);
  const isLimit = getCommitmentType(circle) === 'limit';
  const coverage = getCoverageStatusForValue({circle, currentValue: value});
  const maximum = config.maximumValue ?? 1;
  const minimum = config.minimumValue;
  const target = config.targetValue ?? 1;
  const goal = isLimit
    ? typeof minimum === 'number'
      ? `Allowed range: ${formatQuantityValue(
          minimum,
        )} to ${formatQuantityLabel(maximum, config.unitLabel)}`
      : `Daily maximum: ${formatQuantityLabel(maximum, config.unitLabel)}`
    : `Goal: ${formatQuantityLabel(target, config.unitLabel)}`;
  const status = isLimit
    ? coverage === 'covered'
      ? typeof minimum === 'number'
        ? 'Within range'
        : 'Within limit'
      : typeof minimum === 'number' && value < minimum
      ? 'Below range'
      : typeof minimum === 'number'
      ? 'Above range'
      : 'Above limit'
    : coverage === 'covered'
    ? 'Goal covered'
    : `${formatQuantityLabel(
        Math.max(0, target - value),
        config.unitLabel,
      )} to go`;
  return {
    isLimit,
    goal,
    status,
    coverage,
    unit: config.unitLabel,
    progress: isLimit
      ? 0
      : target > 0
      ? Math.min(1, Math.max(0, value / target))
      : coverage === 'covered'
      ? 1
      : 0,
  };
}
