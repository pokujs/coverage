/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { FileCoverage } from '../../@types/istanbul.js';
import type { ReporterContext } from '../../@types/reporters.js';
import { basename } from 'node:path';
import { converters } from '../../converters/index.js';
import { paths } from '../../utils/paths.js';
import { xml } from '../../utils/xml.js';
import {
  branchCoverageByLine,
  fileBranchesMetric,
  fileFunctionsMetric,
  fileStatementsMetric,
  lineCoverage,
  prepareCoverageMap,
} from '../shared/file-coverage.js';
import { aggregateMetric } from '../shared/metrics.js';
import { groupByPackage } from '../shared/packages.js';
import { baseMetrics, rootMetrics } from './attrs.js';

const aggregateFilesStatements = (files: readonly FileCoverage[]) =>
  aggregateMetric(files, fileStatementsMetric);

const aggregateFilesBranches = (files: readonly FileCoverage[]) =>
  aggregateMetric(files, fileBranchesMetric);

const aggregateFilesFunctions = (files: readonly FileCoverage[]) =>
  aggregateMetric(files, fileFunctionsMetric);

export const buildFromCoverageMap = (
  context: ReporterContext
): string | undefined => {
  const coverageMap = converters.v8ToIstanbul.convert(
    context.tempDir,
    context.cwd,
    context.preRemapFilter
  );

  prepareCoverageMap(coverageMap, context);

  const files = Object.values(coverageMap);
  if (files.length === 0) return undefined;

  const rootStatements = aggregateFilesStatements(files);
  const rootBranches = aggregateFilesBranches(files);
  const rootFunctions = aggregateFilesFunctions(files);

  const groups = groupByPackage(
    files,
    (fileCoverage) => fileCoverage.path,
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
      rootStatements,
      rootBranches,
      rootFunctions,
      groups.length,
      files.length
    )
  );

  for (const group of groups) {
    const groupStatements = aggregateFilesStatements(group.files);
    const groupBranches = aggregateFilesBranches(group.files);
    const groupFunctions = aggregateFilesFunctions(group.files);

    builder.openTag('package', { name: group.packageName });
    builder.inlineTag(
      'metrics',
      baseMetrics(groupStatements, groupBranches, groupFunctions)
    );

    for (const fileCoverage of group.files) {
      const fileStatements = fileStatementsMetric(fileCoverage);
      const fileBranches = fileBranchesMetric(fileCoverage);
      const fileFunctions = fileFunctionsMetric(fileCoverage);
      const branchByLine = branchCoverageByLine(fileCoverage);

      builder.openTag('file', {
        name: basename(fileCoverage.path),
        path: paths.toPosix(paths.relativize(fileCoverage.path, context.cwd)),
      });

      builder.inlineTag(
        'metrics',
        baseMetrics(fileStatements, fileBranches, fileFunctions)
      );

      const sortedLineNumbers = Array.from(
        lineCoverage(fileCoverage).entries()
      ).sort((left, right) => left[0] - right[0]);

      for (const [lineNumber, lineHitCount] of sortedLineNumbers) {
        const branchInfo = branchByLine.get(lineNumber);

        if (branchInfo !== undefined && branchInfo.total > 0) {
          builder.inlineTag('line', {
            num: lineNumber,
            count: lineHitCount,
            type: 'cond',
            truecount: branchInfo.covered,
            falsecount: branchInfo.total - branchInfo.covered,
          });
        } else {
          builder.inlineTag('line', {
            num: lineNumber,
            count: lineHitCount,
            type: 'stmt',
          });
        }
      }

      builder.closeTag('file');
    }

    builder.closeTag('package');
  }

  builder.closeTag('project');
  builder.closeTag('coverage');

  return builder.toString();
};
