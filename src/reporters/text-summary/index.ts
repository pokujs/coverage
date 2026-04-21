/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report, Runtime } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { WatermarkMetric } from '../../@types/watermarks.js';
import { lcovonly } from '../lcovonly/index.js';
import { colorForPct, colorize } from '../shared/color.js';
import { applyIstanbulBranches } from '../shared/file-coverage.js';
import {
  aggregateLines,
  aggregateMetric,
  resolveDisplayPct,
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
  const percentage = resolveDisplayPct(metric, runtime, key);
  const pctDisplay = percentage === null ? '-' : `${percentage.toFixed(2)}%`;
  const covered = metric.hit ?? 0;
  const total = metric.total ?? 0;

  return `${padKey(key)} : ${pctDisplay} ( ${covered}/${total} )`;
};

const report: Report = (context) => {
  const lcovOutput = lcovonly.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcovonly.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  applyIstanbulBranches(
    model,
    context.produceCoverageMap(),
    context.produceBranchDiscoveries()
  );

  const statementsAndLines = aggregateLines(model);
  const branches = aggregateMetric(model, (file) => file.branches);
  const functions = aggregateMetric(model, (file) => file.functions);

  const rows: Array<{ key: WatermarkMetric; metric: Metric }> = [
    { key: 'statements', metric: statementsAndLines },
    { key: 'branches', metric: branches },
    { key: 'functions', metric: functions },
    { key: 'lines', metric: statementsAndLines },
  ];

  console.log('');
  console.log(HEADER);

  for (const row of rows) {
    const line = formatLine(row.key, row.metric, context.runtime);
    const color = colorForPct(
      context.watermarks,
      row.key,
      resolveDisplayPct(row.metric, context.runtime, row.key)
    );

    console.log(colorize(line, color));
  }

  console.log(FOOTER);
};

export const textSummary = { report } as const;
