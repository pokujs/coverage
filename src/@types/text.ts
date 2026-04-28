import type { BranchArmPosition } from './branch-discovery.js';
import type { ColorName } from './terminal.js';

export type Metric = {
  total: number | null;
  hit: number | null;
};

export type { ColorName };

export type UncoveredRange = {
  start: number;
  end: number;
};

export type UncoveredEntry =
  | { kind: 'range'; range: UncoveredRange }
  | { kind: 'branch'; position: BranchArmPosition }
  | { kind: 'function'; position: BranchArmPosition };

export type TruncatedUncovered = {
  visible: UncoveredEntry[];
  truncated: boolean;
};

export type RowMetrics = {
  statements: Metric;
  branches: Metric;
  functions: Metric;
  lines: Metric;
  uncoveredRanges: UncoveredRange[];
  uncoveredBranchPositions: readonly BranchArmPosition[];
  uncoveredFunctionPositions: readonly BranchArmPosition[];
};

export type Row = {
  name: string;
  metrics: RowMetrics | null;
  absolutePath?: string;
};
