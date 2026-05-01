import type { CoverageThresholds } from '../@types/check-coverage.js';
import type { CoverageOptions } from '../@types/coverage.js';
import type {
  ResolvedCoverageOptions,
  VitestThresholds,
} from '../@types/vitest.js';

const mapThresholds = (
  thresholds: ResolvedCoverageOptions['thresholds']
): CoverageThresholds | number | undefined => {
  if (thresholds === undefined) return undefined;

  const known: VitestThresholds = thresholds;
  if (known[100] === true) return 100;

  const mapped: CoverageThresholds = Object.create(null);
  let hasAny = false;

  if (typeof known.statements === 'number') {
    mapped.statements = known.statements;
    hasAny = true;
  }

  if (typeof known.functions === 'number') {
    mapped.functions = known.functions;
    hasAny = true;
  }

  if (typeof known.branches === 'number') {
    mapped.branches = known.branches;
    hasAny = true;
  }

  if (typeof known.lines === 'number') {
    mapped.lines = known.lines;
    hasAny = true;
  }

  if (typeof known.perFile === 'boolean') {
    mapped.perFile = known.perFile;
    hasAny = true;
  }

  return hasAny ? mapped : undefined;
};

const extract = (source: ResolvedCoverageOptions): CoverageOptions => {
  const mapped: CoverageOptions = Object.create(null);

  if (source.include !== undefined) mapped.include = source.include;
  if (source.exclude !== undefined) mapped.exclude = source.exclude;
  if (source.reportsDirectory !== undefined)
    mapped.reportsDirectory = source.reportsDirectory;
  if (source.skipFull !== undefined) mapped.skipFull = source.skipFull;
  if (source.watermarks !== undefined) mapped.watermarks = source.watermarks;
  if (source.excludeAfterRemap !== undefined)
    mapped.excludeAfterRemap = source.excludeAfterRemap;
  if (source.clean !== undefined) mapped.clean = source.clean;

  if (Array.isArray(source.reporter)) {
    mapped.reporter = source.reporter.map((entry) =>
      typeof entry === 'string' ? entry : entry[0]
    );
  } else if (typeof source.reporter === 'string') {
    mapped.reporter = source.reporter;
  }

  const thresholds = mapThresholds(source.thresholds);

  if (thresholds !== undefined) mapped.checkCoverage = thresholds;

  return mapped;
};

export const vitestrc = { extract } as const;
