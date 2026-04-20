import type { CoverageMap } from '../../@types/istanbul.js';
import type { FileAggregation } from '../../@types/v8.js';
import { build } from './build.js';

const convert = (
  aggregations: Map<string, FileAggregation>,
  sources: Map<string, string>
): CoverageMap => {
  const result: CoverageMap = Object.create(null);

  for (const [filePath, aggregation] of aggregations) {
    const sourceText = sources.get(filePath);
    if (sourceText === undefined) continue;

    result[filePath] = build.fromAggregation(filePath, aggregation, sourceText);
  }

  return result;
};

export const aggregationToIstanbul = { convert } as const;
