import type { ReporterContext } from '../../../../@types/reporters.js';
import { lcovSerialize } from '../../../../converters/shared/lcov-serialize.js';
import { allFiles } from '../../all-files.js';
import { filter } from '../filter.js';

const produce = (context: ReporterContext): string => {
  const coverageMap = context.produceCoverageMap();
  if (coverageMap === null) return '';

  const filtered = filter(
    lcovSerialize.fromCoverageMap(coverageMap, context.cwd),
    context.testFiles,
    context.cwd,
    context.fileFilter
  );

  if (context.options.all !== true) return filtered;
  return allFiles.injectLcov(
    filtered,
    allFiles.discover(context),
    context.cwd,
    'bun'
  );
};

export const bun = { produce } as const;
