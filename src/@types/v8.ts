import type { BranchBlockEntry } from './branch-blocks.js';

export type V8Range = {
  startOffset: number;
  endOffset: number;
  count: number;
};

export type V8Function = {
  functionName: string;
  ranges: V8Range[];
  isBlockCoverage: boolean;
};

export type V8ScriptCoverage = {
  scriptId: string;
  url: string;
  functions: V8Function[];
};

export type SubRangeEntry = {
  line: number;
  startOffset: number;
  endOffset: number;
  takenCount: number;
  indexInFunction: number;
};

export type FunctionEntry = {
  line: number;
  name: string;
  startOffset: number;
  endOffset: number;
  outerCount: number;
  isBlockCoverage: boolean;
  subRanges: Map<string, SubRangeEntry>;
  blocks: BranchBlockEntry[];
};

export type FileAggregation = {
  lineHits: Map<number, number>;
  functions: Map<string, FunctionEntry>;
};

export type SourceMapCacheEntry = {
  lineLengths?: number[];
  data?: unknown;
  url?: string;
};

export type SourceMapCache = Record<string, SourceMapCacheEntry>;

export type V8CoverageDocument = {
  scripts: V8ScriptCoverage[];
  sourceMapCache: SourceMapCache;
};

export type ResolvedScriptSource = {
  filePath: string;
  source: string;
  sourceMapData: unknown;
  sourceMapUrl: string;
};

export type SourceCacheResolveInputs = {
  script: V8ScriptCoverage;
  sourceMapCache: SourceMapCache;
  cwd: string;
};

export type SourceCacheHandler = {
  resolve: (
    inputs: SourceCacheResolveInputs
  ) => ResolvedScriptSource | undefined;
};

export type ArmCoverageHandler = {
  isArmCovered: (
    armStart: number,
    armEnd: number,
    allScriptRanges: readonly V8Range[]
  ) => boolean;
};
