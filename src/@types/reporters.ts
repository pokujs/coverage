import type { PluginContext } from 'poku/plugins';
import type { DiscoveredBranch } from './branch-discovery.js';
import type { CoverageOptions } from './coverage.js';
import type { ResolvedFileFilter } from './file-filter.js';
import type { HtmlProjectedCoverage } from './html.js';
import type { CoverageMap } from './istanbul.js';
import type { CoverageModel } from './tree.js';
import type { Watermarks } from './watermarks.js';

export type Runtime = PluginContext['runtime'];

export type ReporterContext = {
  runtime: Runtime;
  tempDir: string;
  cwd: string;
  reportsDir: string;
  testFiles: ReadonlySet<string>;
  options: CoverageOptions;
  watermarks: Watermarks;
  fileFilter: ResolvedFileFilter;
  preRemapFilter: ResolvedFileFilter;
  userFilter: ResolvedFileFilter;
  produceCoverageMap: () => CoverageMap | null;
  produceBranchDiscoveries: () => ReadonlyMap<
    string,
    readonly DiscoveredBranch[]
  >;
};

export type Reporter = (context: ReporterContext) => void;

export type LcovRuntimeHandler = {
  produce: (context: ReporterContext) => string;
  run: Reporter;
};

export type LcovHandler = {
  report: Reporter;
};

export type LcovOnlyHandler = {
  parse: (content: string, cwd: string) => CoverageModel;
  filter: (
    lcov: string,
    testFiles: ReadonlySet<string>,
    cwd: string,
    resolvedFilter: ResolvedFileFilter
  ) => string;
  runtimes: Record<Runtime, LcovRuntimeHandler>;
  report: Reporter;
};

export type V8Handler = {
  runtimes: Record<Runtime, V8RuntimeHandler>;
  report: Reporter;
};

export type TextHandler = {
  report: Reporter;
};

export type HtmlRuntimeHandler = {
  project: (context: ReporterContext) => HtmlProjectedCoverage | null;
};

export type HtmlHandler = {
  runtimes: Record<Runtime, HtmlRuntimeHandler>;
  report: Reporter;
};

export type HtmlSpaHandler = {
  runtimes: Record<Runtime, HtmlRuntimeHandler>;
  report: Reporter;
};

export type TextSummaryHandler = {
  report: Reporter;
};

export type TeamcityHandler = {
  report: Reporter;
};

export type JsonSummaryHandler = {
  report: Reporter;
};

export type JsonHandler = {
  report: Reporter;
};

export type CoberturaHandler = {
  report: Reporter;
};

export type CloverHandler = {
  report: Reporter;
};

export type TextLcovHandler = {
  report: Reporter;
};

export type NoneHandler = {
  report: Reporter;
};

export type ReportersHandler = {
  default: ReporterName;
  normalize: (
    option: ReporterName | ReporterName[] | undefined,
    runtime: Runtime
  ) => ReporterName[];
  run: (reporterList: ReporterName[], context: ReporterContext) => void;
};

export type V8RuntimeHandler = {
  run: Reporter;
};

export type PackageGroup<Entry> = {
  relativeDir: string;
  packageName: string;
  files: Entry[];
};

export type KnownReporter =
  | 'lcov'
  | 'lcovonly'
  | 'text-lcov'
  | 'v8'
  | 'text'
  | 'text-summary'
  | 'teamcity'
  | 'json'
  | 'json-summary'
  | 'cobertura'
  | 'clover'
  | 'html'
  | 'html-spa'
  | 'none';

export type ReporterName = KnownReporter | (string & NonNullable<unknown>);

export type MetricSummary = {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
};

export type FileSummary = {
  statements: MetricSummary;
  branches: MetricSummary;
  functions: MetricSummary;
  lines: MetricSummary;
};
