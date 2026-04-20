import type {
  CoverageSummaryEntry,
  CoverageSummaryMap,
} from '../../../../src/@types/istanbul.js';
import type {
  CoverageSnapshot,
  FileSnapshot,
  MetricsBundle,
  SnapshotMetric,
} from '../../../../src/@types/tests.ts';
import { coverageSnapshot } from './snapshot.ts';

const METRICS: readonly SnapshotMetric[] = [
  'statements',
  'branches',
  'functions',
  'lines',
];

const buildBundle = (entry: CoverageSummaryEntry): MetricsBundle => {
  const bundle: MetricsBundle = Object.create(null);

  for (const metric of METRICS) {
    const source = entry[metric];
    if (!source) continue;

    bundle[metric] = coverageSnapshot.buildMetricDetail(
      source.total,
      source.covered
    );
  }

  return bundle;
};

const parse = (content: string): CoverageSnapshot => {
  const raw = JSON.parse(content) as CoverageSummaryMap;
  const totalsEntry = raw.total;
  const totals = totalsEntry ? buildBundle(totalsEntry) : undefined;
  const files: Record<string, FileSnapshot> = Object.create(null);

  for (const [path, entry] of Object.entries(raw)) {
    if (path === 'total') continue;

    files[path] = buildBundle(entry);
  }

  return {
    reporter: 'json-summary',
    totals,
    files: coverageSnapshot.sortFileEntries(files),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const jsonSummaryShared = {
  parse,
  formatParsed,
} as const;
