import type { CoverageOptions } from '../@types/coverage.js';

const normalize = (raw: Record<string, unknown>): CoverageOptions => {
  const mapped: CoverageOptions = { ...raw };

  if (mapped.checkCoverage === false) mapped.checkCoverage = undefined;

  return mapped;
};

export const configNormalize = { normalize } as const;
