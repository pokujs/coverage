/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { FileCoverage } from '../../@types/istanbul.js';
import type { ReporterContext } from '../../@types/reporters.js';
import { basename } from 'node:path';
import { converters } from '../../converters/index.js';
import { relativize, toPosix } from '../../utils/paths.js';
import { xml } from '../../utils/xml.js';
import {
  branchCoverageByLine,
  fileBranchesMetric,
  fileStatementsMetric,
  lineCoverage,
  prepareCoverageMap,
} from '../shared/file-coverage.js';
import {
  aggregateMetric,
  metricCovered,
  metricRate,
  metricTotal,
} from '../shared/metrics.js';
import { groupByPackage } from '../shared/packages.js';

const aggregateFilesStatements = (files: readonly FileCoverage[]) =>
  aggregateMetric(files, fileStatementsMetric);

const aggregateFilesBranches = (files: readonly FileCoverage[]) =>
  aggregateMetric(files, fileBranchesMetric);

const formatConditionCoverage = (covered: number, total: number): string => {
  const percentage = Math.round((covered / total) * 100);
  return `${percentage}% (${covered}/${total})`;
};

export const buildFromCoverageMap = (
  context: ReporterContext
): string | undefined => {
  const coverageMap = converters.v8ToIstanbul(
    context.tempDir,
    context.cwd,
    context.preRemapFilter
  );

  prepareCoverageMap(coverageMap, context);

  const files = Object.values(coverageMap);
  if (files.length === 0) return undefined;

  const rootStatements = aggregateFilesStatements(files);
  const rootBranches = aggregateFilesBranches(files);
  const builder = xml.create();

  builder.openTag('coverage', {
    'lines-valid': metricTotal(rootStatements),
    'lines-covered': metricCovered(rootStatements),
    'line-rate': metricRate(rootStatements) ?? 1,
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
    files,
    (fileCoverage) => fileCoverage.path,
    context.cwd
  )) {
    const groupStatements = aggregateFilesStatements(group.files);
    const groupBranches = aggregateFilesBranches(group.files);

    builder.openTag('package', {
      name: group.packageName,
      'line-rate': metricRate(groupStatements) ?? 1,
      'branch-rate': metricRate(groupBranches) ?? 1,
    });

    builder.openTag('classes');

    for (const fileCoverage of group.files) {
      const fileStatements = fileStatementsMetric(fileCoverage);
      const fileBranches = fileBranchesMetric(fileCoverage);
      const branchByLine = branchCoverageByLine(fileCoverage);

      builder.openTag('class', {
        name: basename(fileCoverage.path),
        filename: toPosix(relativize(fileCoverage.path, context.cwd)),
        'line-rate': metricRate(fileStatements) ?? 1,
        'branch-rate': metricRate(fileBranches) ?? 1,
      });

      builder.openTag('methods');

      const functionKeys = Object.keys(fileCoverage.fnMap);

      for (const functionKey of functionKeys) {
        const functionEntry = fileCoverage.fnMap[functionKey];
        const functionHitCount = fileCoverage.f[functionKey] ?? 0;

        builder.openTag('method', {
          name: functionEntry.name,
          hits: functionHitCount,
          signature: '()V',
        });

        builder.openTag('lines');
        builder.inlineTag('line', {
          number: functionEntry.decl.start.line,
          hits: functionHitCount,
        });

        builder.closeTag('lines');
        builder.closeTag('method');
      }

      builder.closeTag('methods');
      builder.openTag('lines');

      const sortedLineNumbers = Array.from(
        lineCoverage(fileCoverage).entries()
      ).sort((left, right) => left[0] - right[0]);

      for (const [lineNumber, lineHitCount] of sortedLineNumbers) {
        const branchInfo = branchByLine.get(lineNumber);

        if (branchInfo !== undefined && branchInfo.total > 0) {
          builder.inlineTag('line', {
            number: lineNumber,
            hits: lineHitCount,
            branch: 'true',
            'condition-coverage': formatConditionCoverage(
              branchInfo.covered,
              branchInfo.total
            ),
          });
        } else {
          builder.inlineTag('line', {
            number: lineNumber,
            hits: lineHitCount,
            branch: 'false',
          });
        }
      }

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
