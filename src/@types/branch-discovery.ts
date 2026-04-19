import type { Node } from 'acorn';

export type BranchArmPosition = {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  covered: boolean;
};

export type DiscoveredBranch = {
  line: number;
  arms: readonly BranchArmPosition[];
};

export type AstArmRange = {
  armStart: number;
  armEnd: number;
};

export type AstBranchEntry = {
  nodeStart: number;
  armStarts: readonly number[];
  armEnds: readonly number[];
};

export type AstWalkHandler = {
  isBranchNode: (candidate: Node) => boolean;
  isOptionalChaining: (candidate: Node) => boolean;
  isNodeLike: (candidate: unknown) => candidate is Node;
  forEachNode: (root: Node, visitor: (current: Node) => void) => void;
};
