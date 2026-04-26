import type { BranchArmPosition } from './branch-discovery.js';
import type { Metric } from './text.js';

export type FileCoverage = {
  file: string;
  lineHits: Map<number, number>;
  functions: Metric;
  branches: Metric;
  uncoveredBranchPositions: readonly BranchArmPosition[];
  uncoveredFunctionPositions: readonly BranchArmPosition[];
};

export type CoverageModel = FileCoverage[];

export type TreeNode = {
  segment: string;
  isFile: boolean;
  children: TreeNode[];
  file?: FileCoverage;
};
