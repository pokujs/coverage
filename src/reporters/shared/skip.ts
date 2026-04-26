import type { RowMetrics } from '../../@types/text.js';
import { computePercentage } from './metrics.js';

const FULL_COVERAGE_PERCENTAGE = 100;

export const shouldHideFileRow = (
  metrics: RowMetrics,
  skipFull: boolean,
  skipEmpty: boolean
): boolean => {
  const percentages = [
    computePercentage(metrics.statements),
    computePercentage(metrics.branches),
    computePercentage(metrics.functions),
    computePercentage(metrics.lines),
  ];

  if (skipEmpty && percentages.every((percentage) => percentage === null))
    return true;

  if (skipFull) {
    const concretePercentages = percentages.filter(
      (percentage): percentage is number => percentage !== null
    );

    if (
      concretePercentages.length > 0 &&
      concretePercentages.every(
        (percentage) => percentage >= FULL_COVERAGE_PERCENTAGE
      )
    )
      return true;
  }

  return false;
};
