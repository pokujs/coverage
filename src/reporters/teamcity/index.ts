/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import { lcovonly } from '../lcovonly/index.js';
import { applyIstanbulBranches } from '../shared/file-coverage.js';
import { aggregateLines, aggregateMetric } from '../shared/metrics.js';

const BLOCK_NAME = 'Code Coverage Summary';

const lineForKey = (value: number, teamcityVar: string): string =>
  `##teamcity[buildStatisticValue key='${teamcityVar}' value='${value}']`;

const coveredValue = (metric: Metric): number => metric.hit ?? 0;
const totalValue = (metric: Metric): number => metric.total ?? 0;

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

  const lines: string[] = [
    '',
    `##teamcity[blockOpened name='${BLOCK_NAME}']`,
    lineForKey(coveredValue(statementsAndLines), 'CodeCoverageAbsBCovered'),
    lineForKey(totalValue(statementsAndLines), 'CodeCoverageAbsBTotal'),
    lineForKey(coveredValue(branches), 'CodeCoverageAbsRCovered'),
    lineForKey(totalValue(branches), 'CodeCoverageAbsRTotal'),
    lineForKey(coveredValue(functions), 'CodeCoverageAbsMCovered'),
    lineForKey(totalValue(functions), 'CodeCoverageAbsMTotal'),
    lineForKey(coveredValue(statementsAndLines), 'CodeCoverageAbsLCovered'),
    lineForKey(totalValue(statementsAndLines), 'CodeCoverageAbsLTotal'),
    `##teamcity[blockClosed name='${BLOCK_NAME}']`,
  ];

  console.log(lines.join('\n'));
};

export const teamcity = { report } as const;
