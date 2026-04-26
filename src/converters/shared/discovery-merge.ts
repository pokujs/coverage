import type { DiscoveredBranch } from '../../@types/branch-discovery.js';
import type {
  BranchMapEntry,
  CoverageMap,
  FileCoverage,
} from '../../@types/istanbul.js';
import { readFileSync } from 'node:fs';
import { ignoreDirectives } from './ignore-directives.js';

const discoveryNodeKey = (discovery: DiscoveredBranch): string =>
  `${discovery.line}:${discovery.column}-${discovery.endLine}:${discovery.endColumn}`;

const nextBranchKey = (istanbulFile: FileCoverage): string => {
  const numericKeys = Object.keys(istanbulFile.branchMap)
    .map((key) => Number.parseInt(key, 10))
    .filter((parsed) => Number.isFinite(parsed));

  const highest = numericKeys.length === 0 ? -1 : Math.max(...numericKeys);
  return String(highest + 1);
};

const buildBranchEntry = (discovery: DiscoveredBranch): BranchMapEntry => {
  const loc = {
    start: { line: discovery.line, column: discovery.column },
    end: { line: discovery.endLine, column: discovery.endColumn },
  };

  const locations = discovery.arms.map((arm) => ({
    start: { line: arm.line, column: arm.column - 1 },
    end: { line: arm.endLine, column: arm.endColumn - 1 },
  }));

  return {
    type: 'branch',
    line: discovery.line,
    loc,
    locations,
  };
};

const buildBranchCounts = (discovery: DiscoveredBranch): number[] =>
  discovery.arms.map((arm) => (arm.covered ? 1 : 0));

const loadIgnoredLines = (filePath: string): ReadonlySet<number> => {
  try {
    return ignoreDirectives.parseSource(readFileSync(filePath, 'utf8'));
  } catch {
    return new Set();
  }
};

const discoveryIsIgnored = (
  discovery: DiscoveredBranch,
  ignoredLines: ReadonlySet<number>
): boolean => {
  if (ignoredLines.size === 0) return false;
  if (ignoredLines.has(discovery.line)) return true;

  for (const arm of discovery.arms) if (ignoredLines.has(arm.line)) return true;

  return false;
};

const istanbulNodeKeysFor = (istanbulFile: FileCoverage): Set<string> => {
  const keys = new Set<string>();

  for (const branchKey of Object.keys(istanbulFile.branchMap)) {
    const entry = istanbulFile.branchMap[branchKey];
    keys.add(
      `${entry.loc.start.line}:${entry.loc.start.column}-${entry.loc.end.line}:${entry.loc.end.column}`
    );
  }

  return keys;
};

const apply = (
  coverageMap: CoverageMap,
  discoveries: ReadonlyMap<string, readonly DiscoveredBranch[]>
): void => {
  for (const [filePath, fileDiscoveries] of discoveries) {
    const istanbulFile = coverageMap[filePath];
    if (istanbulFile === undefined) continue;
    if (fileDiscoveries.length === 0) continue;

    const existingKeys = istanbulNodeKeysFor(istanbulFile);
    const ignoredLines = loadIgnoredLines(filePath);

    for (const discovery of fileDiscoveries) {
      if (existingKeys.has(discoveryNodeKey(discovery))) continue;
      if (discoveryIsIgnored(discovery, ignoredLines)) continue;

      const branchKey = nextBranchKey(istanbulFile);
      istanbulFile.branchMap[branchKey] = buildBranchEntry(discovery);
      istanbulFile.b[branchKey] = buildBranchCounts(discovery);
      existingKeys.add(discoveryNodeKey(discovery));
    }
  }
};

export const discoveryMerge = { apply } as const;
