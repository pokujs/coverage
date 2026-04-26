/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report, Runtime } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { WatermarkMetric } from '../../@types/watermarks.js';
import { terminal } from '../../utils/terminal.js';
import { watermarks } from '../../watermarks.js';
import { applyIstanbulBranches } from '../shared/file-coverage.js';
import { lcov } from '../shared/lcov/index.js';
import {
  aggregateLines,
  aggregateMetric,
  resolveDisplayPercentage,
} from '../shared/metrics.js';

const KEY_WIDTH = 12;
const HEADER =
  '=============================== Coverage summary ===============================';
const FOOTER =
  '================================================================================';

const padKey = (key: string): string => {
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  return capitalized.length < KEY_WIDTH
    ? capitalized + ' '.repeat(KEY_WIDTH - capitalized.length)
    : capitalized;
};

const formatLine = (
  key: WatermarkMetric,
  metric: Metric,
  runtime: Runtime
): string => {
  const percentage = resolveDisplayPercentage(metric, runtime, key);
  const percentageDisplay =
    percentage === null ? '-' : `${percentage.toFixed(2)}%`;
  const covered = metric.hit ?? 0;
  const total = metric.total ?? 0;

  return `${padKey(key)} : ${percentageDisplay} ( ${covered}/${total} )`;
};

const report: Report = (context) => {
  const lcovOutput = lcov.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcov.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  applyIstanbulBranches(model, context.produceCoverageMap());

  const statementsAndLines = aggregateLines(model);
  const branches = aggregateMetric(model, (file) => file.branches);
  const functions = aggregateMetric(model, (file) => file.functions);

  const rows: Array<{ key: WatermarkMetric; metric: Metric }> = [
    { key: 'statements', metric: statementsAndLines },
    { key: 'branches', metric: branches },
    { key: 'functions', metric: functions },
    { key: 'lines', metric: statementsAndLines },
  ];

  console.log(HEADER);

  for (const row of rows) {
    const line = formatLine(row.key, row.metric, context.runtime);
    const color = watermarks.colorForPercent(
      context.watermarks,
      row.key,
      resolveDisplayPercentage(row.metric, context.runtime, row.key)
    );

    console.log(terminal.colorize(line, color));
  }

  console.log(FOOTER);
};

export const textSummary = { report } as const;
