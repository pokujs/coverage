import type { AstArmRange } from './branch-discovery.js';
import type { FileAggregation, SubRangeEntry } from './v8.js';

export type BlockTemplate = {
  nodeStart: number;
  nodeEnd: number;
  expectedArms: readonly AstArmRange[];
  inferMissingAsComplement: boolean;
};

export type PendingBlock = {
  template: BlockTemplate;
  claimed: (SubRangeEntry | null)[];
  firstClaimedOrder: number;
};

export type BranchArmEntry = {
  line: number;
  takenCount: number;
};

export type BranchBlockEntry = {
  line: number;
  startOffset: number;
  endOffset: number;
  order: number;
  arms: BranchArmEntry[];
};

export type BranchBlocksHandler = {
  build: (
    fileAggregation: FileAggregation,
    source: string,
    lineStartTable: number[]
  ) => void;
};
