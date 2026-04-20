/*
 * Adapted from v8-to-istanbul's `v8-to-istanbul.js`.
 * Original: https://github.com/istanbuljs/v8-to-istanbul
 * Copyright 2017, Contributors
 * ISC License
 */

import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type {
  BranchCounts,
  BranchMap,
  BranchMapEntry,
  CovBranch,
  CoverageMap,
  CovFunction,
  CovLine,
  CovSource,
  FileCoverage,
  FnMap,
  FnMapEntry,
  FunctionCounts,
  Range,
  StatementCounts,
  StatementMap,
  StatementMapEntry,
} from '../../@types/istanbul.js';
import type { SourceMapInput } from '../../@types/source-map.js';
import type {
  ResolvedScriptSource,
  V8Function,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { readFileSync } from 'node:fs';
import { traceMap } from '../../utils/source-map/index.js';
import { istanbulEntries } from '../shared/istanbul-entries.js';
import { passesPreRemapFilter } from '../shared/pre-remap-filter.js';
import { sourceMapRemap } from '../shared/remap.js';
import { sourceCache } from '../shared/source-cache.js';
import { findV8JsonFiles, parseV8Json } from '../shared/v8-discovery.js';
import { sliceRange } from './range.js';

const cloneCovSource = (baseSource: CovSource): CovSource => ({
  lines: baseSource.lines.map((covLine): CovLine => ({ ...covLine, count: 0 })),
  eof: baseSource.eof,
  shebangLength: baseSource.shebangLength,
  wrapperLength: baseSource.wrapperLength,
});

const comparePositions = (
  leftLine: number,
  leftColumn: number,
  rightLine: number,
  rightColumn: number
): number => {
  if (leftLine !== rightLine) return leftLine - rightLine;
  return leftColumn - rightColumn;
};

const applyScript = (
  covSource: CovSource,
  branches: CovBranch[],
  functions: CovFunction[],
  script: V8Function[]
): void => {
  for (const block of script) {
    for (let rangeIndex = 0; rangeIndex < block.ranges.length; rangeIndex++) {
      const range = block.ranges[rangeIndex];
      const rangeStart = range.startOffset;
      const rangeEnd = range.endOffset;

      if (rangeEnd <= rangeStart) continue;

      const affectedLines = sliceRange(covSource.lines, rangeStart, rangeEnd);
      if (affectedLines.length === 0) continue;

      const firstLine = affectedLines[0];
      const lastLine = affectedLines.at(-1)!;

      if (block.isBlockCoverage) {
        const isModuleScopeRange =
          block.functionName === '' &&
          rangeStart === 0 &&
          rangeEnd >= covSource.eof;

        if (!firstLine.ignore && !isModuleScopeRange) {
          branches.push(
            istanbulEntries.createCovBranch(
              firstLine.line,
              rangeStart - firstLine.startColumn,
              lastLine.line,
              rangeEnd - lastLine.startColumn,
              range.count
            )
          );
        }

        if (block.functionName && rangeIndex === 0) {
          functions.push(
            istanbulEntries.createCovFunction(
              block.functionName,
              firstLine.line,
              rangeStart - firstLine.startColumn,
              lastLine.line,
              rangeEnd - lastLine.startColumn,
              range.count
            )
          );
        }
      } else if (block.functionName) {
        functions.push(
          istanbulEntries.createCovFunction(
            block.functionName,
            firstLine.line,
            rangeStart - firstLine.startColumn,
            lastLine.line,
            rangeEnd - lastLine.startColumn,
            range.count
          )
        );
      }

      for (const covLine of affectedLines) {
        if (
          rangeStart <= covLine.startColumn &&
          rangeEnd >= covLine.endColumn &&
          !covLine.ignore
        )
          covLine.count = range.count;
      }
    }
  }
};

const buildFileCoverage = (
  filePath: string,
  covSource: CovSource,
  branches: CovBranch[],
  functions: CovFunction[]
): FileCoverage => {
  const statementMap: StatementMap = Object.create(null);
  const s: StatementCounts = Object.create(null);

  covSource.lines.forEach((covLine, lineIndex) => {
    const key = String(lineIndex);
    statementMap[key] = istanbulEntries.covLineToStatementMapEntry(covLine);
    s[key] = covLine.ignore ? 1 : covLine.count;
  });

  const sortedFunctions = [...functions].sort((left, right) =>
    comparePositions(
      left.startLine,
      left.startColumn,
      right.startLine,
      right.startColumn
    )
  );

  const fnMap: FnMap = Object.create(null);
  const f: FunctionCounts = Object.create(null);

  sortedFunctions.forEach((covFunction, functionIndex) => {
    const key = String(functionIndex);
    fnMap[key] = istanbulEntries.covFunctionToFnMapEntry(covFunction);
    f[key] = covFunction.count;
  });

  const sortedBranches = [...branches].sort((left, right) =>
    comparePositions(
      left.startLine,
      left.startColumn,
      right.startLine,
      right.startColumn
    )
  );
  const branchMap: BranchMap = Object.create(null);
  const b: BranchCounts = Object.create(null);

  sortedBranches.forEach((covBranch, branchIndex) => {
    const key = String(branchIndex);
    branchMap[key] = istanbulEntries.covBranchToBranchMapEntry(covBranch);
    b[key] = [covBranch.count];
  });

  return {
    path: filePath,
    statementMap,
    s,
    fnMap,
    f,
    branchMap,
    b,
  };
};

const rangeKey = (range: Range): string =>
  `${range.start.line}:${range.start.column}-${range.end.line}:${range.end.column}`;

const indexByRange = <MetaEntry>(
  map: Record<string, MetaEntry>,
  locate: (entry: MetaEntry) => Range
): Map<string, string> => {
  const byRange = new Map<string, string>();
  for (const entryKey of Object.keys(map))
    byRange.set(rangeKey(locate(map[entryKey])), entryKey);
  return byRange;
};

const nextNumericKey = (map: Record<string, unknown>): string => {
  let nextIndex = 0;
  for (const entryKey of Object.keys(map)) {
    const parsed = Number.parseInt(entryKey, 10);
    if (!Number.isNaN(parsed) && parsed >= nextIndex) nextIndex = parsed + 1;
  }
  return String(nextIndex);
};

const mergeCountsByPosition = <MetaEntry>(
  targetMap: Record<string, MetaEntry>,
  targetCounts: Record<string, number>,
  incomingMap: Record<string, MetaEntry>,
  incomingCounts: Record<string, number>,
  locate: (entry: MetaEntry) => Range
): void => {
  const targetIndex = indexByRange(targetMap, locate);

  for (const incomingKey of Object.keys(incomingCounts)) {
    const incomingEntry = incomingMap[incomingKey];
    if (incomingEntry === undefined) continue;

    const positionKey = rangeKey(locate(incomingEntry));
    let targetKey = targetIndex.get(positionKey);

    if (targetKey === undefined) {
      targetKey = nextNumericKey(targetMap);
      targetMap[targetKey] = incomingEntry;
      targetIndex.set(positionKey, targetKey);
    }

    targetCounts[targetKey] =
      (targetCounts[targetKey] ?? 0) + (incomingCounts[incomingKey] ?? 0);
  }
};

const mergeBranchesByPosition = (
  target: FileCoverage,
  incoming: FileCoverage
): void => {
  const targetIndex = indexByRange(
    target.branchMap,
    (entry: BranchMapEntry) => entry.loc
  );

  for (const incomingKey of Object.keys(incoming.b)) {
    const incomingEntry = incoming.branchMap[incomingKey];
    if (incomingEntry === undefined) continue;

    const positionKey = rangeKey(incomingEntry.loc);
    const arriving = incoming.b[incomingKey];

    let targetKey = targetIndex.get(positionKey);
    if (targetKey === undefined) {
      targetKey = nextNumericKey(target.branchMap);

      target.branchMap[targetKey] = incomingEntry;
      target.b[targetKey] = [...arriving];

      targetIndex.set(positionKey, targetKey);
      continue;
    }

    const existing = target.b[targetKey];
    if (existing === undefined) {
      target.b[targetKey] = [...arriving];
      continue;
    }

    const maxLength = Math.max(existing.length, arriving.length);

    for (let slotIndex = 0; slotIndex < maxLength; slotIndex++)
      existing[slotIndex] =
        (existing[slotIndex] ?? 0) + (arriving[slotIndex] ?? 0);
  }
};

const mergeFileCoverage = (
  target: FileCoverage,
  incoming: FileCoverage
): void => {
  mergeCountsByPosition(
    target.statementMap,
    target.s,
    incoming.statementMap,
    incoming.s,
    (entry: StatementMapEntry) => entry
  );

  mergeCountsByPosition(
    target.fnMap,
    target.f,
    incoming.fnMap,
    incoming.f,
    (entry: FnMapEntry) => entry.decl
  );

  mergeBranchesByPosition(target, incoming);
};

const buildBaseSource = (
  baseSourceCache: Map<string, CovSource>,
  filePath: string,
  sourceText: string
): CovSource => {
  let baseSource = baseSourceCache.get(filePath);
  if (baseSource !== undefined) return baseSource;
  baseSource = istanbulEntries.createCovSource(sourceText, 0);
  baseSourceCache.set(filePath, baseSource);
  return baseSource;
};

const scriptToFileCoverage = (
  script: V8ScriptCoverage,
  filePath: string,
  baseSource: CovSource
): FileCoverage => {
  const covSource = cloneCovSource(baseSource);
  const branches: CovBranch[] = [];
  const functions: CovFunction[] = [];

  applyScript(covSource, branches, functions, script.functions);

  return buildFileCoverage(filePath, covSource, branches, functions);
};

const mergeOrAssign = (
  result: CoverageMap,
  filePath: string,
  fileCoverage: FileCoverage
): void => {
  const existing = result[filePath];
  if (existing === undefined) {
    result[filePath] = fileCoverage;
    return;
  }

  mergeFileCoverage(existing, fileCoverage);
};

const processDirectScript = (
  result: CoverageMap,
  baseSourceCache: Map<string, CovSource>,
  resolved: ResolvedScriptSource,
  script: V8ScriptCoverage
): void => {
  if (resolved.filePath === '') return;

  const baseSource = buildBaseSource(
    baseSourceCache,
    resolved.filePath,
    resolved.source
  );

  const fileCoverage = scriptToFileCoverage(
    script,
    resolved.filePath,
    baseSource
  );

  mergeOrAssign(result, resolved.filePath, fileCoverage);
};

const processRemappedScript = (
  result: CoverageMap,
  baseSourceCache: Map<string, CovSource>,
  resolved: ResolvedScriptSource,
  script: V8ScriptCoverage,
  cwd: string
): void => {
  const traceMapInstance = traceMap.create(
    resolved.sourceMapData as SourceMapInput,
    resolved.sourceMapUrl
  );

  const projected = sourceMapRemap.project({
    script,
    transpiledSource: resolved.source,
    traceMapInstance,
    cwd,
  });

  for (const entry of projected) {
    const baseSource = buildBaseSource(
      baseSourceCache,
      entry.originalPath,
      entry.originalSource
    );

    const fileCoverage = scriptToFileCoverage(
      entry.syntheticScript,
      entry.originalPath,
      baseSource
    );

    mergeOrAssign(result, entry.originalPath, fileCoverage);
  }
};

export const v8ToIstanbul = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): CoverageMap => {
  const result: CoverageMap = Object.create(null);
  const baseSourceCache = new Map<string, CovSource>();

  const jsonFiles = findV8JsonFiles(tempDir);
  if (jsonFiles.length === 0) return result;

  for (const jsonPath of jsonFiles) {
    let jsonContent: string;

    try {
      jsonContent = readFileSync(jsonPath, 'utf8');
    } catch {
      continue;
    }

    const document = parseV8Json(jsonContent);

    for (const script of document.scripts) {
      const resolved = sourceCache.resolve({
        script,
        sourceMapCache: document.sourceMapCache,
        cwd,
      });

      if (resolved === undefined) continue;

      if (!passesPreRemapFilter(script, resolved, preRemapFilter, cwd))
        continue;

      if (resolved.sourceMapData !== undefined) {
        processRemappedScript(result, baseSourceCache, resolved, script, cwd);
      } else {
        processDirectScript(result, baseSourceCache, resolved, script);
      }
    }
  }

  return result;
};
