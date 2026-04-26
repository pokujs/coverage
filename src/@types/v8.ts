import type { RangeTree } from '../utils/v8-merge/range-tree.js';
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

export type V8Payload = {
  result: V8ScriptCoverage[];
};

export type V8NormalizedRange = {
  startOffset: number;
  endOffset: number;
  count: string;
};

export type V8NormalizedFunction = {
  functionName: string;
  ranges: V8NormalizedRange[];
  isBlockCoverage?: boolean;
};

export type V8NormalizedScriptCoverage = {
  url: string;
  functions: V8NormalizedFunction[];
};

export type V8NormalizedPayload = {
  result: V8NormalizedScriptCoverage[];
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
  column: number;
  name: string;
  startOffset: number;
  endOffset: number;
  outerCount: number;
  isBlockCoverage: boolean;
  isModuleFunction: boolean;
  subRanges: Map<string, SubRangeEntry>;
};

export type FileAggregation = {
  lineHits: Map<number, number>;
  functions: Map<string, FunctionEntry>;
  blocks: BranchBlockEntry[];
};

export type SourceMapCacheEntry = {
  lineLengths?: number[];
  data?: unknown;
  url?: string;
};

export type SourceMapPayload = {
  sources?: unknown;
  sourcesContent?: unknown;
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
  transpiledLineStarts: number[];
};

export type SourceCacheResolveInputs = {
  script: V8ScriptCoverage;
  sourceMapCache: SourceMapCache;
  cwd: string;
};

export type PerFileCollection = {
  source: string;
  scriptFunctionsFromAllJsons: V8Function[][];
};

export type ParentChildRef = {
  parentIndex: number;
  tree: RangeTree;
};

export type StartEvent = {
  offset: number;
  trees: ParentChildRef[];
};

export type OpenRange = {
  start: number;
  end: number;
};
