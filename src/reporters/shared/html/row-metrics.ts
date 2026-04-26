import type { RowMetrics } from '../../../@types/text.js';
import type { FileCoverage, TreeNode } from '../../../@types/tree.js';
import { metrics } from '../metrics.js';
import { tree } from '../tree.js';

export const emptyRowMetrics = (): RowMetrics => ({
  statements: metrics.empty(),
  branches: metrics.empty(),
  functions: metrics.empty(),
  lines: metrics.empty(),
  uncoveredRanges: [],
  uncoveredBranchPositions: [],
  uncoveredFunctionPositions: [],
});

export const metricsForFile = (fileCoverage: FileCoverage): RowMetrics => {
  const lines = metrics.fromLineHits(fileCoverage.lineHits);

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
  const files = tree.collectFiles(node);
  if (files.length === 0) return emptyRowMetrics();

  const lines = metrics.aggregateLines(files);

  return {
    statements: lines,
    branches: metrics.aggregateBy(
      files,
      (fileCoverage) => fileCoverage.branches
    ),
    functions: metrics.aggregateBy(
      files,
      (fileCoverage) => fileCoverage.functions
    ),
    lines,
    uncoveredRanges: [],
    uncoveredBranchPositions: [],
    uncoveredFunctionPositions: [],
  };
};
