import type { CoverageMap, FileCoverage } from '../../@types/istanbul.js';
import { relativize, toPosix } from '../../utils/paths.js';

const serializeFileRecord = (
  filePath: string,
  fileCoverage: FileCoverage,
  cwd: string
): string => {
  const record: string[] = [];

  record.push('TN:');
  record.push(`SF:${toPosix(relativize(filePath, cwd))}`);

  const functionKeys = Object.keys(fileCoverage.fnMap);
  const userFunctions = functionKeys
    .map((functionKey) => {
      const entry = fileCoverage.fnMap[functionKey];
      const hits = fileCoverage.f[functionKey] ?? 0;
      return { entry, hits };
    })
    .sort((left, right) => left.entry.line - right.entry.line);

  for (const userFunction of userFunctions)
    record.push(`FN:${userFunction.entry.line},${userFunction.entry.name}`);

  record.push(`FNF:${userFunctions.length}`);
  record.push(
    `FNH:${userFunctions.filter((userFunction) => userFunction.hits > 0).length}`
  );

  for (const userFunction of userFunctions)
    record.push(`FNDA:${userFunction.hits},${userFunction.entry.name}`);

  const linesByNumber = new Map<number, number>();

  for (const statementKey of Object.keys(fileCoverage.statementMap)) {
    const entry = fileCoverage.statementMap[statementKey];
    const hits = fileCoverage.s[statementKey] ?? 0;
    const lineNumber = entry.start.line;
    const previous = linesByNumber.get(lineNumber);

    if (previous === undefined || previous < hits)
      linesByNumber.set(lineNumber, hits);
  }

  const sortedLines = Array.from(linesByNumber.entries()).sort(
    (left, right) => left[0] - right[0]
  );

  for (const [lineNumber, hits] of sortedLines)
    record.push(`DA:${lineNumber},${hits}`);

  record.push(`LF:${sortedLines.length}`);
  record.push(`LH:${sortedLines.filter(([, hits]) => hits > 0).length}`);

  const branchKeys = Object.keys(fileCoverage.branchMap);
  let branchesFound = 0;
  let branchesHit = 0;

  for (let blockId = 0; blockId < branchKeys.length; blockId++) {
    const branchKey = branchKeys[blockId];
    const armCounts = fileCoverage.b[branchKey] ?? [];
    const entry = fileCoverage.branchMap[branchKey];

    for (let armIndex = 0; armIndex < entry.locations.length; armIndex++) {
      const armCount = armCounts[armIndex] ?? 0;
      const armLine = entry.locations[armIndex].start.line;

      record.push(`BRDA:${armLine},${blockId},${armIndex},${armCount}`);
      branchesFound++;
      if (armCount > 0) branchesHit++;
    }
  }

  record.push(`BRF:${branchesFound}`);
  record.push(`BRH:${branchesHit}`);
  record.push('end_of_record');

  return record.join('\n');
};

const fromCoverageMap = (coverageMap: CoverageMap, cwd: string): string => {
  const filePaths = Object.keys(coverageMap).sort();
  if (filePaths.length === 0) return '';

  const chunks: string[] = [];

  for (const filePath of filePaths) {
    const fileCoverage = coverageMap[filePath];
    if (Object.keys(fileCoverage.statementMap).length === 0) continue;

    chunks.push(serializeFileRecord(filePath, fileCoverage, cwd));
  }

  return chunks.length === 0 ? '' : chunks.join('\n') + '\n';
};

export const lcovSerialize = { fromCoverageMap } as const;
