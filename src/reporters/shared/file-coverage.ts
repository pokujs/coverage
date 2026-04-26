import type { BranchArmPosition } from '../../@types/branch-discovery.js';
import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type { CoverageMap, FileCoverage } from '../../@types/istanbul.js';
import type { ReporterContext } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { CoverageModel } from '../../@types/tree.js';
import { readFileSync } from 'node:fs';
import { allFiles } from '../../all-files.js';
import { ignoreDirectives } from '../../converters/shared/ignore-directives.js';
import { fileFilter } from '../../file-filter.js';

const filterCoverageMap = (
  coverageMap: CoverageMap,
  testFiles: ReadonlySet<string>,
  resolvedFilter: ResolvedFileFilter,
  cwd: string
): void => {
  for (const testFile of testFiles) delete coverageMap[testFile];

  for (const absolutePath of Object.keys(coverageMap))
    if (!fileFilter.matches(resolvedFilter, absolutePath, cwd))
      delete coverageMap[absolutePath];
};

const prepareCoverageMap = (
  coverageMap: CoverageMap,
  context: ReporterContext
): void => {
  filterCoverageMap(
    coverageMap,
    context.testFiles,
    context.fileFilter,
    context.cwd
  );

  if (context.options.all === true)
    allFiles.injectCoverageMap(coverageMap, allFiles.discover(context));
};

const lineCoverage = (fileCoverage: FileCoverage): Map<number, number> => {
  const perLine = new Map<number, number>();

  for (const statementKey of Object.keys(fileCoverage.statementMap)) {
    const entry = fileCoverage.statementMap[statementKey];
    const lineNumber = entry.start.line;
    const hitCount = fileCoverage.s[statementKey] ?? 0;
    const previous = perLine.get(lineNumber);

    if (previous === undefined || previous < hitCount)
      perLine.set(lineNumber, hitCount);
  }

  return perLine;
};

const branchCoverageByLine = (
  fileCoverage: FileCoverage
): Map<number, { covered: number; total: number }> => {
  const perLine = new Map<number, { covered: number; total: number }>();

  for (const branchKey of Object.keys(fileCoverage.branchMap)) {
    const entry = fileCoverage.branchMap[branchKey];
    const counts = fileCoverage.b[branchKey] ?? [];
    const branchTotal = counts.length;
    const branchCovered = counts.filter((count) => count > 0).length;

    if (branchTotal === 0) continue;

    const lineNumber = entry.line;
    const existing = perLine.get(lineNumber);

    if (existing === undefined)
      perLine.set(lineNumber, { covered: branchCovered, total: branchTotal });
    else {
      existing.covered += branchCovered;
      existing.total += branchTotal;
    }
  }

  return perLine;
};

const statementsMetric = (fileCoverage: FileCoverage): Metric => {
  const statementKeys = Object.keys(fileCoverage.statementMap);

  const total = statementKeys.length;
  if (total === 0) return { total: null, hit: null };

  let hit = 0;

  for (const statementKey of statementKeys)
    if ((fileCoverage.s[statementKey] ?? 0) > 0) hit++;

  return { total, hit };
};

const functionsMetric = (fileCoverage: FileCoverage): Metric => {
  const functionKeys = Object.keys(fileCoverage.fnMap);

  const total = functionKeys.length;
  if (total === 0) return { total: null, hit: null };

  let hit = 0;

  for (const functionKey of functionKeys)
    if ((fileCoverage.f[functionKey] ?? 0) > 0) hit++;

  return { total, hit };
};

const branchesMetric = (fileCoverage: FileCoverage): Metric => {
  let total = 0;
  let hit = 0;

  for (const branchKey of Object.keys(fileCoverage.b)) {
    const counts = fileCoverage.b[branchKey];

    for (const count of counts) {
      total++;
      if (count > 0) hit++;
    }
  }

  if (total === 0) return { total: null, hit: null };
  return { total, hit };
};

const createIgnoredLinesLoader = (): ((
  filePath: string
) => ReadonlySet<number>) => {
  const cache = new Map<string, ReadonlySet<number>>();

  return (filePath: string): ReadonlySet<number> => {
    const cached = cache.get(filePath);
    if (cached !== undefined) return cached;

    try {
      const source = readFileSync(filePath, 'utf8');
      const parsed = ignoreDirectives.parseSource(source);

      cache.set(filePath, parsed);

      return parsed;
    } catch {
      const empty: ReadonlySet<number> = new Set();

      cache.set(filePath, empty);

      return empty;
    }
  };
};

const applyIstanbulBranches = (
  lcovModel: CoverageModel,
  coverageMap: CoverageMap | null
): void => {
  if (coverageMap === null) return;

  const getIgnoredLines = createIgnoredLinesLoader();

  for (const lcovFile of lcovModel) {
    const istanbulFile = coverageMap[lcovFile.file];
    if (istanbulFile === undefined) continue;

    const uncoveredArms: BranchArmPosition[] = [];
    const ignoredLines = getIgnoredLines(lcovFile.file);
    const metric = branchesMetric(istanbulFile);

    for (const branchKey of Object.keys(istanbulFile.branchMap)) {
      const branchEntry = istanbulFile.branchMap[branchKey];
      const armCounts = istanbulFile.b[branchKey] ?? [];

      for (
        let armIndex = 0;
        armIndex < branchEntry.locations.length;
        armIndex++
      ) {
        const armTaken = armCounts[armIndex] ?? 0;
        if (armTaken > 0) continue;

        const armLocation = branchEntry.locations[armIndex];
        if (ignoredLines.has(armLocation.start.line)) continue;

        uncoveredArms.push({
          line: armLocation.start.line,
          column: armLocation.start.column,
          endLine: armLocation.end.line,
          endColumn: armLocation.end.column,
          covered: false,
        });
      }
    }

    lcovFile.uncoveredBranchPositions = uncoveredArms;
    lcovFile.branches = metric;
  }
};

const applyIstanbulFunctions = (
  lcovModel: CoverageModel,
  coverageMap: CoverageMap | null
): void => {
  if (coverageMap === null) return;

  const getIgnoredLines = createIgnoredLinesLoader();

  for (const lcovFile of lcovModel) {
    const istanbulFile = coverageMap[lcovFile.file];
    if (istanbulFile === undefined) continue;

    const functionsTotal = lcovFile.functions.total ?? 0;
    const functionsHit = lcovFile.functions.hit ?? 0;

    if (functionsTotal === 0 || functionsHit >= functionsTotal) {
      lcovFile.uncoveredFunctionPositions = [];
      continue;
    }

    const uncoveredFunctions: BranchArmPosition[] = [];
    const ignoredLines = getIgnoredLines(lcovFile.file);

    for (const functionKey of Object.keys(istanbulFile.fnMap)) {
      const hits = istanbulFile.f[functionKey] ?? 0;
      if (hits > 0) continue;

      const declaration = istanbulFile.fnMap[functionKey].decl;
      if (ignoredLines.has(declaration.start.line)) continue;

      uncoveredFunctions.push({
        line: declaration.start.line,
        column: declaration.start.column,
        endLine: declaration.end.line,
        endColumn: declaration.end.column,
        covered: false,
      });
    }

    lcovFile.uncoveredFunctionPositions = uncoveredFunctions;
  }
};

export const fileCoverage = {
  filterCoverageMap,
  prepareCoverageMap,
  lineCoverage,
  branchCoverageByLine,
  statementsMetric,
  functionsMetric,
  branchesMetric,
  applyIstanbulBranches,
  applyIstanbulFunctions,
} as const;
