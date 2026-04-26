import type { RowMetrics } from '../../@types/text.js';
import { metrics } from './metrics.js';

const FULL_COVERAGE_PERCENTAGE = 100;

const shouldHideFileRow = (
  rowMetrics: RowMetrics,
  skipFull: boolean,
  skipEmpty: boolean
): boolean => {
  const percentages = [
    metrics.computePercentage(rowMetrics.statements),
    metrics.computePercentage(rowMetrics.branches),
    metrics.computePercentage(rowMetrics.functions),
    metrics.computePercentage(rowMetrics.lines),
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

export const skip = { shouldHideFileRow } as const;
