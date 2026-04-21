import type {
  CheckCoverageFailure,
  CheckCoverageMetric,
} from './@types/check-coverage.js';
import type { ReporterContext } from './@types/reporters.js';
import type { Metric } from './@types/text.js';
import type { CoverageModel } from './@types/tree.js';
import { relative } from 'node:path';
import process from 'node:process';
import { lcovonly } from './reporters/lcovonly/index.js';
import { colorForPct, colorize } from './reporters/shared/color.js';
import { applyIstanbulBranches } from './reporters/shared/file-coverage.js';
import {
  aggregateLines,
  aggregateMetric,
  pctValue,
} from './reporters/shared/metrics.js';

const METRIC_ORDER: readonly CheckCoverageMetric[] = [
  'statements',
  'branches',
  'functions',
  'lines',
];

const METRIC_LABEL_WIDTH = 11;

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const metricForName = (
  metric: CheckCoverageMetric,
  files: CoverageModel
): Metric => {
  if (metric === 'statements' || metric === 'lines')
    return aggregateLines(files);

  if (metric === 'branches')
    return aggregateMetric(files, (file) => file.branches);

  return aggregateMetric(files, (file) => file.functions);
};

const collectFailures = (
  files: CoverageModel,
  thresholds: Record<CheckCoverageMetric, number>,
  perFile: boolean
): CheckCoverageFailure[] => {
  const failures: CheckCoverageFailure[] = [];
  const scopes: Array<{ scope: string; files: CoverageModel }> = perFile
    ? files.map((file) => ({ scope: file.file, files: [file] }))
    : [{ scope: 'total', files }];

  for (const metric of METRIC_ORDER) {
    const threshold = thresholds[metric];
    if (threshold <= 0) continue;

    for (const entry of scopes) {
      const computed = metricForName(metric, entry.files);
      const actual = pctValue(computed);

      if (actual === null) continue;

      if (actual < threshold)
        failures.push({ scope: entry.scope, metric, threshold, actual });
    }
  }

  return failures;
};

const padMetricLabel = (metric: CheckCoverageMetric): string =>
  metric.length < METRIC_LABEL_WIDTH
    ? metric + ' '.repeat(METRIC_LABEL_WIDTH - metric.length)
    : metric;

const formatFailureLine = (
  failure: CheckCoverageFailure,
  context: ReporterContext
): string => {
  const label = padMetricLabel(failure.metric);
  const actualText = `${failure.actual!.toFixed(2)}%`;
  const thresholdText = `(threshold: ${failure.threshold}%)`;
  const colorName = colorForPct(
    context.watermarks,
    failure.metric,
    failure.actual
  );

  return `  ${label} ${colorize(actualText, colorName)} ${thresholdText}`;
};

const printFailures = (
  failures: CheckCoverageFailure[],
  context: ReporterContext
): void => {
  console.error('');
  console.error(
    colorize('[@pokujs/coverage] coverage threshold not met:', 'red')
  );

  const grouped = new Map<string, CheckCoverageFailure[]>();

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
  if (flag === undefined || flag === false) return;

  const defaultValue = typeof flag === 'number' ? clampPercentage(flag) : 0;

  const thresholds: Record<CheckCoverageMetric, number> = {
    statements: clampPercentage(context.options.statements ?? defaultValue),
    branches: clampPercentage(context.options.branches ?? defaultValue),
    functions: clampPercentage(context.options.functions ?? defaultValue),
    lines: clampPercentage(context.options.lines ?? defaultValue),
  };

  const hasThreshold =
    thresholds.statements > 0 ||
    thresholds.branches > 0 ||
    thresholds.functions > 0 ||
    thresholds.lines > 0;

  if (!hasThreshold) return;

  const lcovOutput = lcovonly.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcovonly.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  applyIstanbulBranches(
    model,
    context.produceCoverageMap(),
    context.produceBranchDiscoveries()
  );

  const failures = collectFailures(
    model,
    thresholds,
    context.options.perFile === true
  );
  if (failures.length === 0) return;

  printFailures(failures, context);

  process.exitCode = 1;
};

export const checkCoverage = { run } as const;
