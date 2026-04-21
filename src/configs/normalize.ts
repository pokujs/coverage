import type { CheckCoverageMetric } from '../@types/check-coverage.js';
import type { CoverageOptions } from '../@types/coverage.js';

const kebabMap: Record<string, string> = {
  'reports-dir': 'reportsDirectory',
  'report-dir': 'reportsDirectory',
  'temp-directory': 'tempDirectory',
  'check-coverage': 'checkCoverage',
  'per-file': 'perFile',
  'skip-full': 'skipFull',
  'exclude-after-remap': 'excludeAfterRemap',
};

const thresholdMetrics: readonly CheckCoverageMetric[] = [
  'statements',
  'branches',
  'functions',
  'lines',
];

const clearThresholds = (mapped: Record<string, unknown>): void => {
  for (const metric of thresholdMetrics) mapped[metric] = undefined;
  mapped.perFile = undefined;
};

const normalize = (raw: Record<string, unknown>): CoverageOptions => {
  const mapped: Record<string, unknown> = Object.create(null);

  for (const [key, value] of Object.entries(raw))
    mapped[kebabMap[key] ?? key] = value;

  if (mapped['100'] === true) {
    mapped.checkCoverage = 100;
    clearThresholds(mapped);

    return mapped;
  }

  if (mapped.checkCoverage === false) {
    mapped.checkCoverage = undefined;
    clearThresholds(mapped);
  }

  return mapped;
};

export const configNormalize = { normalize } as const;
