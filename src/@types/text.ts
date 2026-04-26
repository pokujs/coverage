import type { ANSI } from '../reporters/shared/color.js';
import type { BranchArmPosition } from './branch-discovery.js';

export type Metric = {
  total: number | null;
  hit: number | null;
};

export type ColorName = keyof typeof ANSI;

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

export type Alignment = 'left' | 'right';

export type Column = {
  header: string;
  align: Alignment;
};

export type RenderCell = {
  text: string;
  color: ColorName | null;
  display?: string;
};
