import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type { CoverageMap } from '../../@types/istanbul.js';
import { aggregationToIstanbul } from '../aggregation-to-istanbul/index.js';
import { v8ToAggregation } from '../v8-to-aggregation/index.js';

export const v8ToIstanbul = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): CoverageMap => {
  const { aggregations, sources } = v8ToAggregation.run(
    tempDir,
    cwd,
    preRemapFilter
  );

  if (aggregations.size === 0) return Object.create(null);
  return aggregationToIstanbul.convert(aggregations, sources);
};
