import type {
  CoverageMap,
  FileCoverage,
} from '../../../../src/@types/istanbul.js';
import type {
  BranchHit,
  CoverageSnapshot,
  FileSnapshot,
  FunctionHit,
  MetricsBundle,
} from '../../../../src/@types/tests.ts';
import { coverageSnapshot } from './snapshot.ts';

const buildFileSnapshot = (entry: FileCoverage): FileSnapshot => {
  const statementIds = Object.keys(entry.s);
  const statementsTotal = statementIds.length;
  const lineHitCounts = new Map<number, number>();
  let statementsCovered = 0;

  for (const statementId of statementIds) {
    const location = entry.statementMap[statementId];
    const hits = entry.s[statementId];
    const line = location.start.line;
    const existing = lineHitCounts.get(line) ?? 0;

    lineHitCounts.set(line, Math.max(existing, hits));

    if (hits > 0) statementsCovered += 1;
  }

  const linesTotal = lineHitCounts.size;
  const coveredLines: number[] = [];
  const uncoveredLines: number[] = [];
  const lineHits: Record<number, number> = Object.create(null);
  let linesCovered = 0;

  const sortedLines = [...lineHitCounts.keys()].sort(
    (left, right) => left - right
  );

  for (const line of sortedLines) {
    const hits = lineHitCounts.get(line) ?? 0;

    lineHits[line] = hits;

    if (hits > 0) {
      linesCovered += 1;
      coveredLines.push(line);
    } else {
      uncoveredLines.push(line);
    }
  }

  const branchIds = Object.keys(entry.b);
  let branchesTotal = 0;
  let branchesCovered = 0;
  const branchHits: BranchHit[] = [];

  for (const branchId of branchIds) {
    const branchHitsList = entry.b[branchId];
    const branchDefinition = entry.branchMap[branchId];

    branchesTotal += branchHitsList.length;

    branchHitsList.forEach((hit, branchIndex) => {
      if (hit > 0) branchesCovered += 1;

      branchHits.push({
        line: branchDefinition.line,
        block: Number(branchId),
        branch: branchIndex,
        hit,
      });
    });
  }

  const functionIds = Object.keys(entry.f);
  const functionsTotal = functionIds.length;
  let functionsCovered = 0;

  const functionHits: FunctionHit[] = functionIds.map((functionId) => {
    const hits = entry.f[functionId];
    if (hits > 0) functionsCovered += 1;

    const declaration = entry.fnMap[functionId];

    return {
      name: declaration.name,
      line: declaration.line,
      hit: hits,
    };
  });

  const metrics: MetricsBundle = {
    statements: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
    branches: coverageSnapshot.buildMetricDetail(
      branchesTotal,
      branchesCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(
      functionsTotal,
      functionsCovered
    ),
    lines: coverageSnapshot.buildMetricDetail(linesTotal, linesCovered),
  };

  return {
    ...metrics,
    uncoveredLines: coverageSnapshot.compressRanges(uncoveredLines),
    coveredLines: coverageSnapshot.compressRanges(coveredLines),
    lineHits,
    branchHits,
    functionHits,
  };
};

const accumulateTotals = (
  files: Record<string, FileSnapshot>
): MetricsBundle => {
  let statementsTotal = 0;
  let statementsCovered = 0;
  let branchesTotal = 0;
  let branchesCovered = 0;
  let functionsTotal = 0;
  let functionsCovered = 0;
  let linesTotal = 0;
  let linesCovered = 0;

  for (const file of Object.values(files)) {
    if (file.statements) {
      statementsTotal += file.statements.total;
      statementsCovered += file.statements.covered;
    }

    if (file.branches) {
      branchesTotal += file.branches.total;
      branchesCovered += file.branches.covered;
    }

    if (file.functions) {
      functionsTotal += file.functions.total;
      functionsCovered += file.functions.covered;
    }

    if (file.lines) {
      linesTotal += file.lines.total;
      linesCovered += file.lines.covered;
    }
  }

  return {
    statements: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
    branches: coverageSnapshot.buildMetricDetail(
      branchesTotal,
      branchesCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(
      functionsTotal,
      functionsCovered
    ),
    lines: coverageSnapshot.buildMetricDetail(linesTotal, linesCovered),
  };
};

const FIXTURE_ROOT_TOKEN = '<fixtureRoot>';

const stripFixtureRoot = (filePath: string): string => {
  const prefix = `${FIXTURE_ROOT_TOKEN}/`;

  if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
  return filePath;
};

const parse = (content: string): CoverageSnapshot => {
  const raw = JSON.parse(content) as CoverageMap;
  const files: Record<string, FileSnapshot> = Object.create(null);

  for (const [path, entry] of Object.entries(raw)) {
    const normalizedPath = stripFixtureRoot(path);

    files[normalizedPath] = buildFileSnapshot(entry);
  }

  const sortedFiles = coverageSnapshot.sortFileEntries(files);

  return {
    reporter: 'json',
    totals: accumulateTotals(sortedFiles),
    files: sortedFiles,
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const jsonShared = {
  parse,
  formatParsed,
} as const;
