import type {
  FileCoverage as IstanbulFileCoverage,
  Position,
} from './istanbul.js';
import type { Runtime } from './reporters.js';
import type { RowMetrics } from './text.js';
import type { CoverageModel } from './tree.js';
import type { WatermarkLevel, Watermarks } from './watermarks.js';

export type HtmlCovered = 'yes' | 'no' | 'neutral';

export type HtmlAnnotatedLine = {
  lineNumber: number;
  hits: string;
  covered: HtmlCovered;
  annotatedHtml: string;
};

export type HtmlAnnotationResult = {
  lines: readonly HtmlAnnotatedLine[];
  maxLines: number;
};

export type HtmlAnnotatorHandler = {
  annotate: (
    fileCoverage: IstanbulFileCoverage,
    sourceText: string
  ) => HtmlAnnotationResult;
};

export type HtmlWatermarkClasses = {
  statements: WatermarkLevel | 'empty';
  branches: WatermarkLevel | 'empty';
  functions: WatermarkLevel | 'empty';
  lines: WatermarkLevel | 'empty';
};

export type HtmlSummaryChild = {
  displayName: string;
  relativeLinkPath: string;
  metrics: RowMetrics;
  watermarkClasses: HtmlWatermarkClasses;
  isEmpty: boolean;
  isDirectory: boolean;
};

export type HtmlInsertionText = {
  insertAt: (
    column: number,
    insertedText: string,
    insertBefore: boolean,
    consumeBlanks?: boolean
  ) => HtmlInsertionText;
  wrap: (
    startColumn: number,
    startText: string,
    endColumn: number,
    endText: string,
    consumeBlanks?: boolean
  ) => HtmlInsertionText;
  wrapLine: (startText: string, endText: string) => void;
  originalLength: () => number;
  toString: () => string;
};

export type HtmlInsertionTextHandler = {
  create: (text: string, consumeBlanks: boolean) => HtmlInsertionText;
};

export type HtmlInsertionOffset = {
  position: number;
  length: number;
};

export type HtmlBreadcrumbEntry = {
  label: string;
  pagePath: string;
};

export type HtmlProjectedCoverage = {
  model: CoverageModel;
  byPath: Map<string, IstanbulFileCoverage | null>;
};

export type HtmlWalkInput = {
  reportsDir: string;
  title: string;
  resolvedWatermarks: Watermarks;
  istanbulByPath: Map<string, IstanbulFileCoverage | null>;
  skipFull: boolean;
  skipEmpty: boolean;
  datetime: string;
  runtime: Runtime;
};

export type HtmlDetailEmissionInput = {
  reportsDir: string;
  title: string;
  rootLabel: string;
  resolvedWatermarks: Watermarks;
  istanbulByPath: Map<string, IstanbulFileCoverage | null>;
  skipFull: boolean;
  skipEmpty: boolean;
  datetime: string;
  backBreadcrumb?: boolean;
  runtime: Runtime;
};

export type HtmlSpaMetricData = {
  total: number;
  covered: number;
  missed: number;
  skipped: number;
  pct: number;
  classForPercent: WatermarkLevel | 'empty';
};

export type HtmlSpaNode = {
  file: string;
  isEmpty: boolean;
  metrics: {
    statements: HtmlSpaMetricData;
    branches: HtmlSpaMetricData;
    functions: HtmlSpaMetricData;
    lines: HtmlSpaMetricData;
  };
  children?: readonly HtmlSpaNode[];
};

export type HtmlSpaMetricName = 'lines' | 'branches' | 'functions';

export type HtmlSpaShellInput = {
  data: HtmlSpaNode;
  datetime: string;
  metricsToShow: readonly HtmlSpaMetricName[];
};

export type HtmlSpaDataInput = {
  resolvedWatermarks: Watermarks;
  skipFull: boolean;
  skipEmpty: boolean;
};

export type HtmlStructuredLine = {
  line: number;
  covered: HtmlCovered;
  hits: number;
  text: HtmlInsertionText;
};

export type HtmlBranchLocation = {
  start: Partial<Position>;
  end: Partial<Position>;
};

export type HtmlSummaryPageInput = {
  title: string;
  pagePath: string;
  breadcrumb: readonly HtmlBreadcrumbEntry[];
  currentLabel: string;
  metrics: RowMetrics;
  children: readonly HtmlSummaryChild[];
  resolvedWatermarks: Watermarks;
  datetime: string;
  runtime: Runtime;
};

export type HtmlDetailPageInput = {
  title: string;
  pagePath: string;
  breadcrumb: readonly HtmlBreadcrumbEntry[];
  currentLabel: string;
  metrics: RowMetrics;
  fileCoverage: IstanbulFileCoverage;
  resolvedWatermarks: Watermarks;
  datetime: string;
  backBreadcrumb?: boolean;
  runtime: Runtime;
};

export type HtmlLineOnlyDetailPageInput = {
  title: string;
  pagePath: string;
  breadcrumb: readonly HtmlBreadcrumbEntry[];
  currentLabel: string;
  metrics: RowMetrics;
  filePath: string;
  lineHits: ReadonlyMap<number, number>;
  resolvedWatermarks: Watermarks;
  datetime: string;
  backBreadcrumb?: boolean;
  runtime: Runtime;
};

export type HtmlPageTemplateInput = {
  title: string;
  pagePath: string;
  breadcrumb: readonly HtmlBreadcrumbEntry[];
  currentLabel: string;
  metrics: RowMetrics;
  reportClass: WatermarkLevel | 'empty';
  datetime: string;
  backBreadcrumb?: boolean;
  runtime: Runtime;
};
