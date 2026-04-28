import type {
  CoverageFailure,
  CoverageMetric,
  CoverageThresholds,
} from './@types/check-coverage.js';
import type { ReporterContext } from './@types/reporters.js';
import type { Metric } from './@types/text.js';
import type { CoverageModel } from './@types/tree.js';
import type {
  FileTypeCoverage,
  TypeCoverageReport,
} from './@types/type-coverage.js';
import type { WatermarkMetric } from './@types/watermarks.js';
import { relative } from 'node:path';
import process from 'node:process';
import { fileCoverage } from './reporters/shared/file-coverage.js';
import { lcov } from './reporters/shared/lcov/index.js';
import { metrics } from './reporters/shared/metrics.js';
import { terminal } from './utils/terminal.js';
import { watermarks } from './watermarks.js';

const METRIC_ORDER: readonly CoverageMetric[] = [
  'statements',
  'branches',
  'functions',
  'lines',
  'typesReferenced',
  'typesTested',
];

const TYPE_METRICS: ReadonlySet<CoverageMetric> = new Set([
  'typesReferenced',
  'typesTested',
]);

const WATERMARK_METRIC: Record<CoverageMetric, WatermarkMetric> = {
  statements: 'statements',
  branches: 'branches',
  functions: 'functions',
  lines: 'lines',
  typesReferenced: 'used',
  typesTested: 'tested',
};

const METRIC_LABEL_WIDTH = 11;

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const executionMetric = (
  metric: CoverageMetric,
  files: CoverageModel
): Metric => {
  if (metric === 'statements' || metric === 'lines')
    return metrics.aggregateLines(files);

  if (metric === 'branches')
    return metrics.aggregateBy(files, (file) => file.branches);

  return metrics.aggregateBy(files, (file) => file.functions);
};

const aggregateTypeFiles = (
  files: readonly FileTypeCoverage[],
  pickHit: (file: FileTypeCoverage) => number
): Metric => {
  let total = 0;
  let hit = 0;

  for (const file of files) {
    total += file.total;
    hit += pickHit(file);
  }

  return { total, hit };
};

const typesMetric = (
  metric: CoverageMetric,
  files: readonly FileTypeCoverage[]
): Metric => {
  if (metric === 'typesReferenced')
    return aggregateTypeFiles(files, (file) => file.used);
  return aggregateTypeFiles(files, (file) => file.tested);
};

const collectFailures = (
  executionFiles: CoverageModel,
  typeReport: TypeCoverageReport | undefined,
  thresholds: Record<CoverageMetric, number>,
  perFile: boolean
): CoverageFailure[] => {
  const failures: CoverageFailure[] = [];
  const executionScopes: Array<{ scope: string; files: CoverageModel }> =
    perFile
      ? executionFiles.map((file) => ({ scope: file.file, files: [file] }))
      : [{ scope: 'total', files: executionFiles }];
  const typeFiles = typeReport ? [...typeReport.files.values()] : [];
  const typeScopes: Array<{
    scope: string;
    files: readonly FileTypeCoverage[];
  }> = perFile
    ? typeFiles.map((file) => ({ scope: file.absolutePath, files: [file] }))
    : [{ scope: 'total', files: typeFiles }];

  for (const metric of METRIC_ORDER) {
    const threshold = thresholds[metric];
    if (threshold <= 0) continue;

    if (TYPE_METRICS.has(metric)) {
      if (typeReport === undefined) continue;
      if (metric === 'typesTested' && !typeReport.testsConfigured) continue;

      for (const entry of typeScopes) {
        const computed = typesMetric(metric, entry.files);
        const actual = metrics.computePercentage(computed);

        if (actual === null) continue;
        if (actual < threshold)
          failures.push({ scope: entry.scope, metric, threshold, actual });
      }

      continue;
    }

    for (const entry of executionScopes) {
      const computed = executionMetric(metric, entry.files);
      const actual = metrics.computePercentage(computed);
      if (actual === null) continue;
      if (actual < threshold)
        failures.push({ scope: entry.scope, metric, threshold, actual });
    }
  }

  return failures;
};

const padMetricLabel = (metric: CoverageMetric): string =>
  metric.length < METRIC_LABEL_WIDTH
    ? metric + ' '.repeat(METRIC_LABEL_WIDTH - metric.length)
    : metric;

const formatFailureLine = (
  failure: CoverageFailure,
  context: ReporterContext
): string => {
  const label = padMetricLabel(failure.metric);
  const actualText = `${failure.actual!.toFixed(2)}%`;
  const thresholdText = `(threshold: ${failure.threshold}%)`;
  const colorName = watermarks.colorForPercent(
    context.watermarks,
    WATERMARK_METRIC[failure.metric],
    failure.actual
  );

  return `  ${label} ${terminal.colorize(actualText, colorName)} ${thresholdText}`;
};

const printFailures = (
  failures: CoverageFailure[],
  context: ReporterContext
): void => {
  console.error('');
  console.error(
    terminal.colorize('[@pokujs/coverage] coverage threshold not met:', 'red')
  );

  const grouped = new Map<string, CoverageFailure[]>();

  for (const failure of failures) {
    const existing = grouped.get(failure.scope);

    if (existing) existing.push(failure);
    else grouped.set(failure.scope, [failure]);
  }

  for (const [scope, entries] of grouped) {
    if (scope !== 'total') {
      const relativePath = relative(context.cwd, scope) || scope;

      console.error(`  ${relativePath}`);
    }

    for (const failure of entries)
      console.error(formatFailureLine(failure, context));
  }

  console.error('');
};

const run = (context: ReporterContext): void => {
  const flag = context.options.checkCoverage;
  if (flag === undefined) return;

  const isObject = typeof flag === 'object' && flag !== null;
  const defaultValue = typeof flag === 'number' ? clampPercentage(flag) : 0;

  const fromObject = (key: keyof CoverageThresholds): number | undefined => {
    if (!isObject) return undefined;

    const value = flag[key];

    return typeof value === 'number' ? value : undefined;
  };

  const thresholds: Record<CoverageMetric, number> = {
    statements: clampPercentage(fromObject('statements') ?? defaultValue),
    branches: clampPercentage(fromObject('branches') ?? defaultValue),
    functions: clampPercentage(fromObject('functions') ?? defaultValue),
    lines: clampPercentage(fromObject('lines') ?? defaultValue),
    typesReferenced: clampPercentage(
      fromObject('typesReferenced') ?? defaultValue
    ),
    typesTested: clampPercentage(fromObject('typesTested') ?? defaultValue),
  };

  const perFile = isObject ? flag.perFile === true : false;

  const hasExecutionThreshold =
    thresholds.statements > 0 ||
    thresholds.branches > 0 ||
    thresholds.functions > 0 ||
    thresholds.lines > 0;
  const hasTypeThreshold =
    thresholds.typesReferenced > 0 || thresholds.typesTested > 0;

  if (!hasExecutionThreshold && !hasTypeThreshold) return;

  let model: CoverageModel = [];

  if (hasExecutionThreshold) {
    const lcovOutput = lcov.runtimes[context.runtime].produce(context);
    if (lcovOutput.length === 0) return;

    model = lcov.parse(lcovOutput, context.cwd);
    if (model.length === 0) return;

    fileCoverage.applyIstanbulBranches(model, context.produceCoverageMap());
  }

  const failures = collectFailures(
    model,
    context.typeCoverageReport,
    thresholds,
    perFile
  );
  if (failures.length === 0) return;

  printFailures(failures, context);

  process.exitCode = 1;
};

export const checkCoverage = { run } as const;
