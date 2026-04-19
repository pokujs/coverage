import type { ReporterName, Runtime } from './reporters.js';

export type SnapshotExtension = 'json' | 'xml' | 'html' | 'txt';

export type FixtureRun = {
  exitCode: number;
  stdout: string;
  stderr: string;
  fixtureRoot: string;
};

export type TestCase = {
  reporter: ReporterName;
  runtime: Runtime;
  name: string;
  extension?: SnapshotExtension;
};

export type RuntimeSpec = {
  command: string;
  args: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
};

export type HtmlSnapshotMetric =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines';

export type HtmlSnapshotSummary = Record<HtmlSnapshotMetric, string>;

export type HtmlSnapshotFileMetrics = HtmlSnapshotSummary & {
  uncoveredLines: string;
};

export type HtmlSnapshot = {
  summary: HtmlSnapshotSummary;
  files: Record<string, HtmlSnapshotFileMetrics>;
};

export type HtmlSpaMetricDetail = {
  total: number;
  covered: number;
  missed: number;
  skipped: number;
  pct: number;
  classForPercent: string;
};

export type HtmlSpaNodeMetrics = Record<
  HtmlSnapshotMetric,
  HtmlSpaMetricDetail
>;

export type HtmlSpaSnapshotNode = {
  file: string;
  isEmpty: boolean;
  metrics: HtmlSpaNodeMetrics;
  children?: readonly HtmlSpaSnapshotNode[];
};
