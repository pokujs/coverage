/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type {
  FileSummary,
  MetricSummary,
  Reporter,
} from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { FileCoverage } from '../../@types/tree.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { relativize, toPosix } from '../../utils/paths.js';
import { lcovonly } from '../lcovonly/index.js';
import { applyIstanbulBranches } from '../shared/file-coverage.js';
import {
  aggregateLines,
  aggregateMetric,
  linesMetric,
  pctValue,
} from '../shared/metrics.js';

const metricSummary = (metric: Metric): MetricSummary => {
  const percentage = pctValue(metric);

  return {
    total: metric.total ?? 0,
    covered: metric.hit ?? 0,
    skipped: 0,
    pct: percentage === null ? 100 : Math.round(percentage * 100) / 100,
  };
};

const summarizeFile = (file: FileCoverage): FileSummary => {
  const lines = linesMetric(file.lineHits);

  return {
    statements: metricSummary(lines),
    branches: metricSummary(file.branches),
    functions: metricSummary(file.functions),
    lines: metricSummary(lines),
  };
};

const report: Reporter = (context) => {
  const lcovOutput = lcovonly.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcovonly.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  applyIstanbulBranches(
    model,
    context.produceCoverageMap(),
    context.produceBranchDiscoveries()
  );

  const aggregatedLines = aggregateLines(model);
  const aggregatedBranches = aggregateMetric(model, (file) => file.branches);
  const aggregatedFunctions = aggregateMetric(model, (file) => file.functions);

  const payload: Record<string, FileSummary> = {
    total: {
      statements: metricSummary(aggregatedLines),
      branches: metricSummary(aggregatedBranches),
      functions: metricSummary(aggregatedFunctions),
      lines: metricSummary(aggregatedLines),
    },
  };

  for (const file of model)
    payload[toPosix(relativize(file.file, context.cwd))] = summarizeFile(file);

  mkdirSync(context.reportsDir, { recursive: true });
  writeFileSync(
    join(context.reportsDir, 'coverage-summary.json'),
    JSON.stringify(payload),
    'utf8'
  );
};

export const jsonSummary = { report } as const;
