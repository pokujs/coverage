/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type {
  FileSummary,
  MetricSummary,
  Report,
} from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { FileCoverage } from '../../@types/tree.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../../utils/paths.js';
import { fileCoverage } from '../shared/file-coverage.js';
import { lcov } from '../shared/lcov/index.js';
import { metrics } from '../shared/metrics.js';

const metricSummary = (metric: Metric): MetricSummary => {
  const percentage = metrics.computePercentage(metric);

  return {
    total: metric.total ?? 0,
    covered: metric.hit ?? 0,
    skipped: 0,
    pct: percentage === null ? 100 : Math.round(percentage * 100) / 100,
  };
};

const summarizeFile = (file: FileCoverage): FileSummary => {
  const lines = metrics.fromLineHits(file.lineHits);

  return {
    statements: metricSummary(lines),
    branches: metricSummary(file.branches),
    functions: metricSummary(file.functions),
    lines: metricSummary(lines),
  };
};

const report: Report = (context) => {
  const lcovOutput = lcov.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcov.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  fileCoverage.applyIstanbulBranches(model, context.produceCoverageMap());

  const aggregatedLines = metrics.aggregateLines(model);
  const aggregatedBranches = metrics.aggregateBy(
    model,
    (file) => file.branches
  );
  const aggregatedFunctions = metrics.aggregateBy(
    model,
    (file) => file.functions
  );

  const payload: Record<string, FileSummary> = {
    total: {
      statements: metricSummary(aggregatedLines),
      branches: metricSummary(aggregatedBranches),
      functions: metricSummary(aggregatedFunctions),
      lines: metricSummary(aggregatedLines),
    },
  };

  for (const file of model)
    payload[paths.toPosix(paths.relativize(file.file, context.cwd))] =
      summarizeFile(file);

  mkdirSync(context.reportsDir, { recursive: true });
  writeFileSync(
    join(context.reportsDir, 'coverage-summary.json'),
    JSON.stringify(payload),
    'utf8'
  );
};

export const jsonSummary = { report } as const;
