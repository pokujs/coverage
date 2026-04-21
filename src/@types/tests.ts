import type { Reporter, Runtime } from './reporters.js';

export type SnapshotExtension = 'json' | 'xml' | 'html' | 'txt';

export type FixtureRun = {
  exitCode: number;
  stdout: string;
  stderr: string;
  fixtureRoot: string;
};

export type TestCase = {
  reporter: Reporter;
  runtime: Runtime;
  name: string;
  extension?: SnapshotExtension;
};

export type RuntimeSpec = {
  command: string;
  args: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
};

export type SnapshotMetric = 'statements' | 'branches' | 'functions' | 'lines';

export type MetricDetail = {
  total: number;
  covered: number;
  missed: number;
  pct: string;
};

export type MetricsBundle = Partial<Record<SnapshotMetric, MetricDetail>>;

export type BranchHit = {
  line: number;
  block?: number;
  branch?: number;
  hit: number;
  taken?: number;
};

export type FunctionRange = {
  startOffset: number;
  endOffset: number;
  count: string;
};

export type FunctionHit = {
  name: string;
  line?: number;
  hit?: number;
  ranges?: readonly FunctionRange[];
};

export type FileSnapshot = MetricsBundle & {
  uncoveredLines?: string;
  coveredLines?: string;
  lineHits?: Record<number, number>;
  branchHits?: readonly BranchHit[];
  functionHits?: readonly FunctionHit[];
};

export type CoverageSnapshot = {
  reporter: Reporter;
  totals?: MetricsBundle;
  files?: Record<string, FileSnapshot>;
};

export type LineClassification = {
  covered: readonly number[];
  uncovered: readonly number[];
};
