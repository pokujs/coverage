import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type { CoverageMap } from '../../@types/istanbul.js';
import type { Runtime } from '../../@types/reporters.js';
import { aggregationToIstanbul } from '../aggregation-to-istanbul/index.js';
import { v8ToAggregation } from '../v8-to-aggregation/index.js';

const convert = (
  tempDir: string,
  cwd: string,
  runtime: Runtime,
  preRemapFilter: ResolvedFileFilter
): CoverageMap => {
  const { aggregations, sources } = v8ToAggregation.run(
    tempDir,
    cwd,
    runtime,
    preRemapFilter
  );

  if (aggregations.size === 0) return Object.create(null);
  return aggregationToIstanbul.convert(aggregations, sources);
};

export const v8ToIstanbul = { convert } as const;
