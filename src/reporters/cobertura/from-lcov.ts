/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { ReporterContext } from '../../@types/reporters.js';
import type { FileCoverage } from '../../@types/tree.js';
import { basename } from 'node:path';
import { paths } from '../../utils/paths.js';
import { xml } from '../../utils/xml.js';
import { lcov } from '../shared/lcov/index.js';
import { metrics } from '../shared/metrics.js';
import { packages } from '../shared/packages.js';

const aggregateFilesLines = (files: FileCoverage[]) =>
  metrics.aggregateLines(files);

const aggregateFilesBranches = (files: FileCoverage[]) =>
  metrics.aggregateBy(files, (lcovFile) => lcovFile.branches);

const sortedLineHits = (lcovFile: FileCoverage): Array<[number, number]> =>
  Array.from(lcovFile.lineHits.entries()).sort(
    (left, right) => left[0] - right[0]
  );

export const buildFromLcov = (context: ReporterContext): string | undefined => {
  const lcovOutput = lcov.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return undefined;

  const model = lcov.parse(lcovOutput, context.cwd);
  if (model.length === 0) return undefined;

  const rootLines = metrics.aggregateLines(model);
  const rootBranches = metrics.aggregateBy(
    model,
    (lcovFile) => lcovFile.branches
  );
  const builder = xml.create();

  builder.openTag('coverage', {
    'lines-valid': metrics.total(rootLines),
    'lines-covered': metrics.covered(rootLines),
    'line-rate': metrics.rate(rootLines) ?? 1,
    'branches-valid': metrics.total(rootBranches),
    'branches-covered': metrics.covered(rootBranches),
    'branch-rate': metrics.rate(rootBranches) ?? 1,
    timestamp: Date.now(),
    complexity: 0,
    version: '0.1',
  });

  builder.openTag('sources');
  builder.inlineTag('source', undefined, context.cwd);
  builder.closeTag('sources');
  builder.openTag('packages');

  for (const group of packages.groupBy(
    model,
    (lcovFile) => lcovFile.file,
    context.cwd
  )) {
    const groupLines = aggregateFilesLines(group.files);
    const groupBranches = aggregateFilesBranches(group.files);

    builder.openTag('package', {
      name: group.packageName,
      'line-rate': metrics.rate(groupLines) ?? 1,
      'branch-rate': metrics.rate(groupBranches) ?? 1,
    });

    builder.openTag('classes');

    for (const lcovFile of group.files) {
      const fileLines = metrics.fromLineHits(lcovFile.lineHits);

      builder.openTag('class', {
        name: basename(lcovFile.file),
        filename: paths.toPosix(paths.relativize(lcovFile.file, context.cwd)),
        'line-rate': metrics.rate(fileLines) ?? 1,
        'branch-rate': metrics.rate(lcovFile.branches) ?? 1,
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
