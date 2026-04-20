import type {
  BranchArmEntry,
  BranchBlockEntry,
} from '../../@types/branch-blocks.js';
import type { TraceMap } from '../../@types/source-map.js';
import type {
  FileAggregation,
  FunctionEntry,
  SubRangeEntry,
} from '../../@types/v8.js';

const MAX_WRAPPED_COLUMN = 4096;

const remapLine = (
  traceMapInstance: TraceMap,
  wrappedLine: number
): number | undefined => {
  if (wrappedLine < 1) return undefined;

  const lastOnLine = traceMapInstance.originalPositionFor({
    line: wrappedLine,
    column: MAX_WRAPPED_COLUMN,
  });
  if (lastOnLine.line !== null) return lastOnLine.line;

  const firstOnLine = traceMapInstance.originalPositionFor({
    line: wrappedLine,
    column: 0,
    bias: -1,
  });
  if (firstOnLine.line !== null) return firstOnLine.line;

  return undefined;
};

const rebaseLineHits = (
  wrappedHits: ReadonlyMap<number, number>,
  traceMapInstance: TraceMap
): Map<number, number> => {
  const diskHits = new Map<number, number>();

  for (const [wrappedLine, hits] of wrappedHits) {
    const diskLine = remapLine(traceMapInstance, wrappedLine);
    if (diskLine === undefined) continue;

    const existing = diskHits.get(diskLine);
    if (existing === undefined || hits > existing) diskHits.set(diskLine, hits);
  }

  return diskHits;
};

const rebaseSubRanges = (
  subRanges: ReadonlyMap<string, SubRangeEntry>,
  traceMapInstance: TraceMap
): Map<string, SubRangeEntry> => {
  const rebased = new Map<string, SubRangeEntry>();

  for (const [key, subRange] of subRanges) {
    const diskLine = remapLine(traceMapInstance, subRange.line);
    if (diskLine === undefined) continue;

    rebased.set(key, { ...subRange, line: diskLine });
  }

  return rebased;
};

const rebaseArms = (
  arms: readonly BranchArmEntry[],
  traceMapInstance: TraceMap
): BranchArmEntry[] => {
  const rebased: BranchArmEntry[] = [];

  for (const arm of arms) {
    const diskLine = remapLine(traceMapInstance, arm.line);
    if (diskLine === undefined) continue;

    rebased.push({ ...arm, line: diskLine });
  }

  return rebased;
};

const rebaseBlocks = (
  blocks: readonly BranchBlockEntry[],
  traceMapInstance: TraceMap
): BranchBlockEntry[] => {
  const rebased: BranchBlockEntry[] = [];

  for (const block of blocks) {
    const diskLine = remapLine(traceMapInstance, block.line);
    if (diskLine === undefined) continue;

    const diskArms = rebaseArms(block.arms, traceMapInstance);
    if (diskArms.length !== block.arms.length) continue;

    rebased.push({ ...block, line: diskLine, arms: diskArms });
  }

  return rebased;
};

const rebaseFunction = (
  functionEntry: FunctionEntry,
  traceMapInstance: TraceMap
): FunctionEntry | undefined => {
  if (functionEntry.isModuleFunction) {
    return {
      ...functionEntry,
      line: 1,
      subRanges: rebaseSubRanges(functionEntry.subRanges, traceMapInstance),
      blocks: rebaseBlocks(functionEntry.blocks, traceMapInstance),
    };
  }

  const diskLine = remapLine(traceMapInstance, functionEntry.line);
  if (diskLine === undefined) return undefined;

  return {
    ...functionEntry,
    line: diskLine,
    subRanges: rebaseSubRanges(functionEntry.subRanges, traceMapInstance),
    blocks: rebaseBlocks(functionEntry.blocks, traceMapInstance),
  };
};

const toDisk = (
  wrappedAggregation: FileAggregation,
  traceMapInstance: TraceMap
): FileAggregation => {
  const diskAggregation: FileAggregation = {
    lineHits: rebaseLineHits(wrappedAggregation.lineHits, traceMapInstance),
    functions: new Map(),
  };

  for (const [key, functionEntry] of wrappedAggregation.functions) {
    const diskFunction = rebaseFunction(functionEntry, traceMapInstance);
    if (diskFunction === undefined) continue;

    diskAggregation.functions.set(key, diskFunction);
  }

  return diskAggregation;
};

export const aggregationRebase = {
  toDisk,
} as const;
