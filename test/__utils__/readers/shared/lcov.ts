import type { LcovFile } from 'lcov-parse';
import type { ReporterName } from '../../../../src/@types/reporters.js';
import type {
  BranchHit,
  CoverageSnapshot,
  FileSnapshot,
  FunctionHit,
  MetricsBundle,
} from '../../../../src/@types/tests.ts';
import parse from 'lcov-parse';
import { coverageSnapshot } from './snapshot.ts';

const FIXTURE_PATH_PATTERN =
  /^.*\/test\/__fixtures__\/e2e\/[^/]+\/[^/]+\/[^/]+\//;

const normalizeFilePath = (filePath: string, fixtureRoot: string): string => {
  const prefix = `${fixtureRoot}/`;

  if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);

  return filePath.replace(FIXTURE_PATH_PATTERN, '');
};

const parseContent = (content: string): Promise<LcovFile[]> =>
  new Promise((resolve, reject) => {
    parse.source(content, (error, data) => {
      if (error !== null) return reject(new Error(error));
      if (data === undefined)
        return reject(new Error('lcov-parse returned no data'));

      resolve(data);
    });
  });

const buildFileSnapshot = (fileCoverage: LcovFile): FileSnapshot => {
  const { lines, branches, functions } = fileCoverage;

  const metrics: MetricsBundle = {
    lines: coverageSnapshot.buildMetricDetail(lines.found, lines.hit),
    branches: coverageSnapshot.buildMetricDetail(branches.found, branches.hit),
    functions: coverageSnapshot.buildMetricDetail(
      functions.found,
      functions.hit
    ),
  };

  const coveredLines = lines.details
    .filter((detail) => detail.hit > 0)
    .map((detail) => detail.line);
  const uncoveredLines = lines.details
    .filter((detail) => detail.hit === 0)
    .map((detail) => detail.line);

  const lineHits: Record<number, number> = Object.create(null);
  for (const detail of lines.details) lineHits[detail.line] = detail.hit;

  const branchHits: BranchHit[] = branches.details.map((detail) => ({
    line: detail.line,
    block: detail.block,
    branch: detail.branch,
    hit: detail.taken > 0 ? 1 : 0,
    taken: detail.taken,
  }));

  const functionHits: FunctionHit[] = functions.details.map((detail) => ({
    name: detail.name,
    line: detail.line,
    hit: detail.hit,
  }));

  return {
    ...metrics,
    uncoveredLines: coverageSnapshot.compressRanges(uncoveredLines),
    coveredLines: coverageSnapshot.compressRanges(coveredLines),
    lineHits,
    branchHits,
    functionHits,
  };
};

const accumulateTotals = (parsed: readonly LcovFile[]): MetricsBundle => {
  let linesTotal = 0;
  let linesCovered = 0;
  let branchesTotal = 0;
  let branchesCovered = 0;
  let functionsTotal = 0;
  let functionsCovered = 0;

  for (const fileCoverage of parsed) {
    linesTotal += fileCoverage.lines.found;
    linesCovered += fileCoverage.lines.hit;
    branchesTotal += fileCoverage.branches.found;
    branchesCovered += fileCoverage.branches.hit;
    functionsTotal += fileCoverage.functions.found;
    functionsCovered += fileCoverage.functions.hit;
  }

  return {
    lines: coverageSnapshot.buildMetricDetail(linesTotal, linesCovered),
    branches: coverageSnapshot.buildMetricDetail(
      branchesTotal,
      branchesCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(
      functionsTotal,
      functionsCovered
    ),
  };
};

const build = (
  parsed: readonly LcovFile[],
  reporter: ReporterName,
  fixtureRoot: string
): CoverageSnapshot => {
  const files: Record<string, FileSnapshot> = Object.create(null);

  for (const fileCoverage of parsed) {
    const normalizedPath = normalizeFilePath(fileCoverage.file, fixtureRoot);
    files[normalizedPath] = buildFileSnapshot(fileCoverage);
  }

  return {
    reporter,
    totals: accumulateTotals(parsed),
    files: coverageSnapshot.sortFileEntries(files),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const lcovShared = {
  parse: parseContent,
  build,
  formatParsed,
} as const;
