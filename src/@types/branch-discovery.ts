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
