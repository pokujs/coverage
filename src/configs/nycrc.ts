import type { CheckCoverageThresholds } from '../@types/check-coverage.js';
import type { CoverageOptions } from '../@types/coverage.js';
import type { NycrcMap, NycrcRaw } from '../@types/nycrc.js';

const aliasMap: Record<keyof NycrcMap, keyof CoverageOptions | null> = {
  'reports-dir': 'reportsDirectory',
  'report-dir': 'reportsDirectory',
  'temp-directory': 'tempDirectory',
  'check-coverage': 'checkCoverage',
  'per-file': null,
  'skip-full': 'skipFull',
  'exclude-after-remap': 'excludeAfterRemap',
  '100': 'checkCoverage',
  statements: null,
  branches: null,
  functions: null,
  lines: null,
} as const;

const thresholdKeys = ['statements', 'branches', 'functions', 'lines'] as const;

const collectThresholds = (
  source: NycrcRaw
): CheckCoverageThresholds | undefined => {
  const thresholds: CheckCoverageThresholds = {};
  let hasAny = false;

  for (const key of thresholdKeys) {
    const value = source[key];

    if (typeof value === 'number') {
      thresholds[key] = value;
      hasAny = true;
    }
  }

  if (typeof source['per-file'] === 'boolean') {
    thresholds.perFile = source['per-file'];
    hasAny = true;
  }

  return hasAny ? thresholds : undefined;
};

const normalizeCheckCoverage = (value: unknown): number | undefined => {
  if (value === false || value === undefined) return undefined;
  if (value === true) return 0;
  if (typeof value === 'number') return value;
  return undefined;
};

const extract = (source: NycrcRaw): CoverageOptions => {
  const mapped: CoverageOptions = Object.create(null);

  for (const [key, value] of Object.entries(source)) {
    if (key === '100') continue;
    if (key === 'check-coverage') continue;
    if (thresholdKeys.includes(key as (typeof thresholdKeys)[number])) continue;
    if (key === 'per-file') continue;

    const destination =
      (aliasMap as Record<string, keyof CoverageOptions | null | undefined>)[
        key
      ] ?? key;
    if (destination === null) continue;

    (mapped as Record<string, unknown>)[destination] = value;
  }

  if (source['100'] === true) {
    mapped.checkCoverage = 100;
    return mapped;
  }

  const baseCheckCoverage = normalizeCheckCoverage(source['check-coverage']);
  if (baseCheckCoverage !== undefined) mapped.checkCoverage = baseCheckCoverage;

  const thresholds = collectThresholds(source);

  if (thresholds === undefined) return mapped;

  if (typeof mapped.checkCoverage === 'number') {
    const numericDefault = mapped.checkCoverage;

    for (const key of thresholdKeys) {
      if (thresholds[key] === undefined) thresholds[key] = numericDefault;
    }
  }

  mapped.checkCoverage = thresholds;

  return mapped;
};

export const nycrc = { extract } as const;
