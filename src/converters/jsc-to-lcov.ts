import type { ResolvedFileFilter } from '../@types/file-filter.js';
import { jscToAggregation } from './jsc-to-aggregation/index.js';
import { lcovSerialize } from './shared/lcov-serialize.js';

export const jscToLcov = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): string => {
  const { aggregations } = jscToAggregation.run(tempDir, cwd, preRemapFilter);

  if (aggregations.size === 0) return '';
  return lcovSerialize.serialize(aggregations, cwd);
};
