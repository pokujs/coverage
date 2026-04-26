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
import { fileCoverage } from '../shared/file-coverage.js';
import { metrics } from '../shared/metrics.js';
import { packages } from '../shared/packages.js';

const aggregateFilesStatements = (files: readonly FileCoverage[]) =>
  metrics.aggregateBy(files, fileCoverage.statementsMetric);

const aggregateFilesBranches = (files: readonly FileCoverage[]) =>
  metrics.aggregateBy(files, fileCoverage.branchesMetric);

const formatConditionCoverage = (covered: number, total: number): string => {
  const percentage = Math.round((covered / total) * 100);
  return `${percentage}% (${covered}/${total})`;
};

export const buildFromCoverageMap = (
  context: ReporterContext
): string | undefined => {
  const coverageMap = converters.v8ToIstanbul.convert(
    context.tempDir,
    context.cwd,
    context.preRemapFilter
  );

  fileCoverage.prepareCoverageMap(coverageMap, context);

  const files = Object.values(coverageMap);
  if (files.length === 0) return undefined;

  const rootStatements = aggregateFilesStatements(files);
  const rootBranches = aggregateFilesBranches(files);
  const builder = xml.create();

  builder.openTag('coverage', {
    'lines-valid': metrics.total(rootStatements),
    'lines-covered': metrics.covered(rootStatements),
    'line-rate': metrics.rate(rootStatements) ?? 1,
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
    files,
    (coverageEntry) => coverageEntry.path,
    context.cwd
  )) {
    const groupStatements = aggregateFilesStatements(group.files);
    const groupBranches = aggregateFilesBranches(group.files);

    builder.openTag('package', {
      name: group.packageName,
      'line-rate': metrics.rate(groupStatements) ?? 1,
      'branch-rate': metrics.rate(groupBranches) ?? 1,
    });

    builder.openTag('classes');

    for (const coverageEntry of group.files) {
      const fileStatements = fileCoverage.statementsMetric(coverageEntry);
      const fileBranches = fileCoverage.branchesMetric(coverageEntry);
      const branchByLine = fileCoverage.branchCoverageByLine(coverageEntry);

      builder.openTag('class', {
        name: basename(coverageEntry.path),
        filename: paths.toPosix(
          paths.relativize(coverageEntry.path, context.cwd)
        ),
        'line-rate': metrics.rate(fileStatements) ?? 1,
        'branch-rate': metrics.rate(fileBranches) ?? 1,
      });

      builder.openTag('methods');

      const functionKeys = Object.keys(coverageEntry.fnMap);

      for (const functionKey of functionKeys) {
        const functionEntry = coverageEntry.fnMap[functionKey];
        const functionHitCount = coverageEntry.f[functionKey] ?? 0;

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
        fileCoverage.lineCoverage(coverageEntry).entries()
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
