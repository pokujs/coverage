import type { CoverageOptions } from '../@types/coverage.js';

const normalize = (raw: Record<string, unknown>): CoverageOptions => {
  const mapped: Record<string, unknown> = { ...raw };

  if (mapped.checkCoverage === false) mapped.checkCoverage = undefined;
  else if (mapped.checkCoverage === true) mapped.checkCoverage = 0;

  return mapped as CoverageOptions;
};

export const configNormalize = { normalize } as const;
