/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { ReporterContext } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { FileCoverage } from '../../@types/tree.js';
import { basename } from 'node:path';
import { paths } from '../../utils/paths.js';
import { xml } from '../../utils/xml.js';
import { lcov } from '../shared/lcov/index.js';
import {
  aggregateLines,
  aggregateMetric,
  linesMetric,
} from '../shared/metrics.js';
import { groupByPackage } from '../shared/packages.js';
import { baseMetrics, rootMetrics } from './attrs.js';

const aggregateFilesBranches = (files: FileCoverage[]): Metric =>
  aggregateMetric(files, (lcovFile) => lcovFile.branches);

const aggregateFilesFunctions = (files: FileCoverage[]): Metric =>
  aggregateMetric(files, (lcovFile) => lcovFile.functions);

const sortedLineHits = (lcovFile: FileCoverage): Array<[number, number]> =>
  Array.from(lcovFile.lineHits.entries()).sort(
    (left, right) => left[0] - right[0]
  );

export const buildFromLcov = (context: ReporterContext): string | undefined => {
  const lcovOutput = lcov.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return undefined;

  const model = lcov.parse(lcovOutput, context.cwd);
  if (model.length === 0) return undefined;

  const rootLines = aggregateLines(model);
  const rootBranches = aggregateFilesBranches(model);
  const rootFunctions = aggregateFilesFunctions(model);

  const groups = groupByPackage(
    model,
    (lcovFile) => lcovFile.file,
    context.cwd
  );

  const timestamp = Date.now();
  const builder = xml.create();

  builder.openTag('coverage', {
    generated: timestamp,
    clover: '3.2.0',
  });

  builder.openTag('project', {
    timestamp,
    name: 'All files',
  });

  builder.inlineTag(
    'metrics',
    rootMetrics(
      rootLines,
      rootBranches,
      rootFunctions,
      groups.length,
      model.length
    )
  );

  for (const group of groups) {
    const groupLines = aggregateLines(group.files);
    const groupBranches = aggregateFilesBranches(group.files);
    const groupFunctions = aggregateFilesFunctions(group.files);

    builder.openTag('package', { name: group.packageName });
    builder.inlineTag(
      'metrics',
      baseMetrics(groupLines, groupBranches, groupFunctions)
    );

    for (const lcovFile of group.files) {
      const fileLines = linesMetric(lcovFile.lineHits);

      builder.openTag('file', {
        name: basename(lcovFile.file),
        path: paths.toPosix(paths.relativize(lcovFile.file, context.cwd)),
      });

      builder.inlineTag(
        'metrics',
        baseMetrics(fileLines, lcovFile.branches, lcovFile.functions)
      );

      for (const [lineNumber, hitCount] of sortedLineHits(lcovFile))
        builder.inlineTag('line', {
          num: lineNumber,
          count: hitCount,
          type: 'stmt',
        });

      builder.closeTag('file');
    }

    builder.closeTag('package');
  }

  builder.closeTag('project');
  builder.closeTag('coverage');

  return builder.toString();
};
