import type { ResolvedFileFilter } from '../@types/file-filter.js';
import type { CoverageMap } from '../@types/istanbul.js';
import { aggregationToIstanbul } from './aggregation-to-istanbul/index.js';
import { jscToAggregation } from './jsc-to-aggregation/index.js';

const convert = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): CoverageMap => {
  const { aggregations, sources } = jscToAggregation.run(
    tempDir,
    cwd,
    preRemapFilter
  );

  if (aggregations.size === 0) return Object.create(null);
  return aggregationToIstanbul.convert(aggregations, sources);
};

export const jscToIstanbul = { convert } as const;
