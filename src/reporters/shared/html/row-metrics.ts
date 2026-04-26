import type { RowMetrics } from '../../../@types/text.js';
import type { FileCoverage, TreeNode } from '../../../@types/tree.js';
import {
  aggregateLines,
  aggregateMetric,
  emptyMetric,
  linesMetric,
} from '../metrics.js';
import { collectFileCoverages } from '../tree.js';

export const emptyRowMetrics = (): RowMetrics => ({
  statements: emptyMetric(),
  branches: emptyMetric(),
  functions: emptyMetric(),
  lines: emptyMetric(),
  uncoveredRanges: [],
  uncoveredBranchPositions: [],
  uncoveredFunctionPositions: [],
});

export const metricsForFile = (fileCoverage: FileCoverage): RowMetrics => {
  const lines = linesMetric(fileCoverage.lineHits);

  return {
    statements: lines,
    branches: fileCoverage.branches,
    functions: fileCoverage.functions,
    lines,
    uncoveredRanges: [],
    uncoveredBranchPositions: [],
    uncoveredFunctionPositions: [],
  };
};

export const metricsForSubtree = (node: TreeNode): RowMetrics => {
  const files = collectFileCoverages(node);
  if (files.length === 0) return emptyRowMetrics();

  const lines = aggregateLines(files);

  return {
    statements: lines,
    branches: aggregateMetric(files, (fileCoverage) => fileCoverage.branches),
    functions: aggregateMetric(files, (fileCoverage) => fileCoverage.functions),
    lines,
    uncoveredRanges: [],
    uncoveredBranchPositions: [],
    uncoveredFunctionPositions: [],
  };
};
