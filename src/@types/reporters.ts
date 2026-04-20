import type { PluginContext } from 'poku/plugins';
import type { DiscoveredBranch } from './branch-discovery.js';
import type { CoverageOptions } from './coverage.js';
import type { ResolvedFileFilter } from './file-filter.js';
import type { CoverageMap } from './istanbul.js';
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
  | 'jsc'
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
