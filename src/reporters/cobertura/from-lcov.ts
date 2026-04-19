/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { ReporterContext } from '../../@types/reporters.js';
import type { FileCoverage } from '../../@types/tree.js';
import { basename } from 'node:path';
import { relativize, toPosix } from '../../utils/paths.js';
import { xml } from '../../utils/xml.js';
import { lcovonly } from '../lcovonly/index.js';
import {
  aggregateLines,
  aggregateMetric,
  linesMetric,
  metricCovered,
  metricRate,
  metricTotal,
} from '../shared/metrics.js';
import { groupByPackage } from '../shared/packages.js';

const aggregateFilesLines = (files: FileCoverage[]) => aggregateLines(files);

const aggregateFilesBranches = (files: FileCoverage[]) =>
  aggregateMetric(files, (lcovFile) => lcovFile.branches);

const sortedLineHits = (lcovFile: FileCoverage): Array<[number, number]> =>
  Array.from(lcovFile.lineHits.entries()).sort(
    (left, right) => left[0] - right[0]
  );

export const buildFromLcov = (context: ReporterContext): string | undefined => {
  const lcovOutput = lcovonly.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return undefined;

  const model = lcovonly.parse(lcovOutput, context.cwd);
  if (model.length === 0) return undefined;

  const rootLines = aggregateLines(model);
  const rootBranches = aggregateMetric(model, (lcovFile) => lcovFile.branches);
  const builder = xml.create();

  builder.openTag('coverage', {
    'lines-valid': metricTotal(rootLines),
    'lines-covered': metricCovered(rootLines),
    'line-rate': metricRate(rootLines) ?? 1,
    'branches-valid': metricTotal(rootBranches),
    'branches-covered': metricCovered(rootBranches),
    'branch-rate': metricRate(rootBranches) ?? 1,
    timestamp: Date.now(),
    complexity: 0,
    version: '0.1',
  });

  builder.openTag('sources');
  builder.inlineTag('source', undefined, context.cwd);
  builder.closeTag('sources');
  builder.openTag('packages');

  for (const group of groupByPackage(
    model,
    (lcovFile) => lcovFile.file,
    context.cwd
  )) {
    const groupLines = aggregateFilesLines(group.files);
    const groupBranches = aggregateFilesBranches(group.files);

    builder.openTag('package', {
      name: group.packageName,
      'line-rate': metricRate(groupLines) ?? 1,
      'branch-rate': metricRate(groupBranches) ?? 1,
    });

    builder.openTag('classes');

    for (const lcovFile of group.files) {
      const fileLines = linesMetric(lcovFile.lineHits);

      builder.openTag('class', {
        name: basename(lcovFile.file),
        filename: toPosix(relativize(lcovFile.file, context.cwd)),
        'line-rate': metricRate(fileLines) ?? 1,
        'branch-rate': metricRate(lcovFile.branches) ?? 1,
      });

      builder.openTag('methods');
      builder.closeTag('methods');
      builder.openTag('lines');

      for (const [lineNumber, hitCount] of sortedLineHits(lcovFile))
        builder.inlineTag('line', {
          number: lineNumber,
          hits: hitCount,
          branch: 'false',
        });

      builder.closeTag('lines');
      builder.closeTag('class');
    }

    builder.closeTag('classes');
    builder.closeTag('package');
  }

  builder.closeTag('packages');
  builder.closeTag('coverage');

  return builder.toString();
};
