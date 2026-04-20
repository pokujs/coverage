/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { TraceMap } from './source-map.js';

export type Position = {
  line: number;
  column: number;
};

export type Range = {
  start: Position;
  end: Position;
};

export type StatementMapEntry = Range;

export type FnMapEntry = {
  name: string;
  decl: Range;
  loc: Range;
  line: number;
};

export type BranchMapEntry = {
  type: string;
  line: number;
  loc: Range;
  locations: Range[];
};

export type StatementMap = Record<string, StatementMapEntry>;
export type FnMap = Record<string, FnMapEntry>;
export type BranchMap = Record<string, BranchMapEntry>;

export type StatementCounts = Record<string, number>;
export type FunctionCounts = Record<string, number>;
export type BranchCounts = Record<string, number[]>;

export type FileCoverage = {
  path: string;
  all?: boolean;
  statementMap: StatementMap;
  s: StatementCounts;
  fnMap: FnMap;
  f: FunctionCounts;
  branchMap: BranchMap;
  b: BranchCounts;
};

export type StatementCoverageSlice = Pick<FileCoverage, 'statementMap' | 's'>;
export type FunctionCoverageSlice = Pick<FileCoverage, 'fnMap' | 'f'>;
export type BranchCoverageSlice = Pick<FileCoverage, 'branchMap' | 'b'>;

export type CoverageMap = Record<string, FileCoverage>;

export type CoverageSummaryMetric = {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
};

export type CoverageSummaryEntry = {
  statements: CoverageSummaryMetric;
  branches: CoverageSummaryMetric;
  functions: CoverageSummaryMetric;
  lines: CoverageSummaryMetric;
};

export type CoverageSummaryMap = Record<string, CoverageSummaryEntry>;

export type CovLine = {
  line: number;
  startColumn: number;
  endColumn: number;
  count: number;
  ignore: boolean;
};

export type CovBranch = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  count: number;
};

export type CovFunction = {
  name: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  count: number;
};

export type CovSource = {
  lines: CovLine[];
  eof: number;
  shebangLength: number;
  wrapperLength: number;
};

export type OffsetRemap = {
  source: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SourceMapLookup = TraceMap;

export type ScriptCoverageState = {
  path: string;
  covSource: CovSource;
  branches: CovBranch[];
  functions: CovFunction[];
};
