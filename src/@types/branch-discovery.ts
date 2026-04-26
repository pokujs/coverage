import type { ResolvedScriptSource, V8Range } from './v8.js';

export type BranchArmPosition = {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  covered: boolean;
};

export type DiscoveredBranch = {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  arms: readonly BranchArmPosition[];
};

export type AstArmRange = {
  armStart: number;
  armEnd: number;
};

export type AstBranchEntry = {
  nodeStart: number;
  nodeEnd: number;
  armStarts: readonly number[];
  armEnds: readonly number[];
};

export type AppendDiscoveryInputs = {
  discoveredByPath: Map<string, DiscoveredBranch[]>;
  originalPath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  arms: readonly BranchArmPosition[];
};

export type RangeProbe = (originalByteOffset: number) => number;

export type ScriptCoverageData = {
  resolved: ResolvedScriptSource;
  perProcessRanges: V8Range[][];
};
