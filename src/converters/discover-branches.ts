import type { Node, Program } from 'acorn';
import type {
  AstArmRange,
  AstBranchEntry,
  BranchArmPosition,
  DiscoveredBranch,
} from '../@types/branch-discovery.js';
import type { ResolvedFileFilter } from '../@types/file-filter.js';
import type { SourceMapInput, TraceMap } from '../@types/source-map.js';
import type { V8Range } from '../@types/v8.js';
import { readFileSync } from 'node:fs';
import { isAbsolute, sep } from 'node:path';
import { offsets } from '../utils/offsets.js';
import { isBannedPath } from '../utils/paths.js';
import { traceMap } from '../utils/source-map/index.js';
import { armCoverage } from './shared/arm-coverage.js';
import { astCache } from './shared/ast-cache.js';
import { astWalk } from './shared/ast-walk.js';
import { passesPreRemapFilter } from './shared/pre-remap-filter.js';
import { sourceCache } from './shared/source-cache.js';
import { findV8JsonFiles, parseV8Json } from './shared/v8-discovery.js';

const getChildNode = (parentNode: Node, propertyName: string): Node | null => {
  const value: unknown = Reflect.get(parentNode, propertyName);

  if (value === null || value === undefined) return null;
  return astWalk.isNodeLike(value) ? value : null;
};

const getChildNodes = (parentNode: Node, propertyName: string): Node[] => {
  const value: unknown = Reflect.get(parentNode, propertyName);

  if (!Array.isArray(value)) return [];
  return value.filter(astWalk.isNodeLike);
};

const computeArmRanges = (currentNode: Node): readonly AstArmRange[] => {
  if (currentNode.type === 'LogicalExpression') {
    const leftNode = getChildNode(currentNode, 'left');
    const rightNode = getChildNode(currentNode, 'right');

    if (leftNode === null || rightNode === null) return [];
    return [
      { armStart: leftNode.start, armEnd: leftNode.end },
      { armStart: rightNode.start, armEnd: rightNode.end },
    ];
  }

  if (currentNode.type === 'ConditionalExpression') {
    const consequentNode = getChildNode(currentNode, 'consequent');
    const alternateNode = getChildNode(currentNode, 'alternate');

    if (consequentNode === null || alternateNode === null) return [];
    return [
      { armStart: consequentNode.start, armEnd: consequentNode.end },
      { armStart: alternateNode.start, armEnd: alternateNode.end },
    ];
  }

  if (currentNode.type === 'AssignmentPattern') {
    const rightNode = getChildNode(currentNode, 'right');

    if (rightNode === null) return [];
    return [{ armStart: rightNode.start, armEnd: rightNode.end }];
  }

  if (currentNode.type === 'IfStatement') {
    const consequentNode = getChildNode(currentNode, 'consequent');
    if (consequentNode === null) return [];

    const alternateNode = getChildNode(currentNode, 'alternate');
    if (alternateNode !== null)
      return [
        { armStart: consequentNode.start, armEnd: consequentNode.end },
        { armStart: alternateNode.start, armEnd: alternateNode.end },
      ];
    return [{ armStart: consequentNode.start, armEnd: consequentNode.end }];
  }

  if (currentNode.type === 'SwitchStatement') {
    const cases = getChildNodes(currentNode, 'cases');
    if (cases.length === 0) return [];

    return cases.map((caseNode) => ({
      armStart: caseNode.start,
      armEnd: caseNode.end,
    }));
  }

  if (
    currentNode.type === 'MemberExpression' &&
    astWalk.isOptionalChaining(currentNode)
  ) {
    const objectNode = getChildNode(currentNode, 'object');
    const propertyNode = getChildNode(currentNode, 'property');

    if (objectNode === null || propertyNode === null) return [];
    return [
      { armStart: objectNode.start, armEnd: objectNode.end },
      { armStart: propertyNode.start, armEnd: propertyNode.end },
    ];
  }

  if (
    currentNode.type === 'CallExpression' &&
    astWalk.isOptionalChaining(currentNode)
  ) {
    const calleeNode = getChildNode(currentNode, 'callee');
    if (calleeNode === null) return [];

    return [
      { armStart: calleeNode.start, armEnd: calleeNode.end },
      { armStart: calleeNode.end, armEnd: currentNode.end },
    ];
  }

  return [];
};

const collectBranchEntries = (programTree: Program): AstBranchEntry[] => {
  const entries: AstBranchEntry[] = [];

  astWalk.forEachNode(programTree, (currentNode) => {
    if (!astWalk.isBranchNode(currentNode)) return;

    const armRanges = computeArmRanges(currentNode);
    if (armRanges.length === 0) return;

    entries.push({
      nodeStart: currentNode.start,
      armStarts: armRanges.map((range) => range.armStart),
      armEnds: armRanges.map((range) => range.armEnd),
    });
  });

  return entries;
};

const remapToOriginal = (
  byteIndex: number,
  transpiledLineStarts: number[],
  traceMapInstance: TraceMap,
  cwd: string
): { originalPath: string; line: number; column: number } | null => {
  const location = offsets.toLocation(byteIndex, transpiledLineStarts);
  const mapping = traceMapInstance.originalPositionFor(location);

  if (
    mapping.source === null ||
    mapping.line === null ||
    mapping.column === null
  )
    return null;

  if (!isAbsolute(mapping.source)) return null;

  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  if (!mapping.source.startsWith(cwdPrefix)) return null;
  if (isBannedPath(mapping.source)) return null;

  // mapping.column is 0-indexed per source-map spec; +1 for 1-indexed IDE URLs
  return {
    originalPath: mapping.source,
    line: mapping.line,
    column: mapping.column + 1,
  };
};

const appendDiscovery = (
  discoveredByPath: Map<string, DiscoveredBranch[]>,
  originalPath: string,
  lineNumber: number,
  arms: readonly BranchArmPosition[]
): void => {
  const existing = discoveredByPath.get(originalPath);
  if (existing === undefined) {
    discoveredByPath.set(originalPath, [{ line: lineNumber, arms }]);
    return;
  }

  existing.push({ line: lineNumber, arms });
};

export const discoverBranches = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): Map<string, readonly DiscoveredBranch[]> => {
  astCache.reset();

  const discoveredByPath = new Map<string, DiscoveredBranch[]>();
  const processedScriptUrls = new Set<string>();

  const jsonFiles = findV8JsonFiles(tempDir);
  if (jsonFiles.length === 0) return discoveredByPath;

  for (const jsonPath of jsonFiles) {
    let jsonContent: string;

    try {
      jsonContent = readFileSync(jsonPath, 'utf8');
    } catch {
      continue;
    }

    const document = parseV8Json(jsonContent);

    for (const script of document.scripts) {
      if (processedScriptUrls.has(script.url)) continue;

      const resolved = sourceCache.resolve({
        script,
        sourceMapCache: document.sourceMapCache,
        cwd,
      });
      if (resolved === undefined) continue;

      if (!passesPreRemapFilter(script, resolved, preRemapFilter, cwd))
        continue;

      processedScriptUrls.add(script.url);

      const programTree = astCache.parse(resolved.source);
      if (programTree === null) continue;

      const branchEntries = collectBranchEntries(programTree);
      if (branchEntries.length === 0) continue;

      const allScriptRanges: V8Range[] = script.functions.flatMap(
        (scriptFunction) => scriptFunction.ranges
      );

      if (resolved.sourceMapData !== undefined) {
        const traceMapInstance = traceMap.create(
          resolved.sourceMapData as SourceMapInput,
          resolved.sourceMapUrl
        );

        const transpiledLineStarts = offsets.lineStarts(resolved.source);

        for (const branchEntry of branchEntries) {
          const nodeResult = remapToOriginal(
            branchEntry.nodeStart,
            transpiledLineStarts,
            traceMapInstance,
            cwd
          );

          if (nodeResult === null) continue;

          const armPositions: BranchArmPosition[] = [];

          for (
            let armIndex = 0;
            armIndex < branchEntry.armStarts.length;
            armIndex++
          ) {
            const armStart = branchEntry.armStarts[armIndex];
            const armEnd = branchEntry.armEnds[armIndex];
            const armStartResult = remapToOriginal(
              armStart,
              transpiledLineStarts,
              traceMapInstance,
              cwd
            );

            if (armStartResult === null) continue;
            if (armStartResult.originalPath !== nodeResult.originalPath)
              continue;

            const armEndResult = remapToOriginal(
              armEnd,
              transpiledLineStarts,
              traceMapInstance,
              cwd
            );

            const endLine =
              armEndResult !== null &&
              armEndResult.originalPath === nodeResult.originalPath
                ? armEndResult.line
                : armStartResult.line;

            const endColumn =
              armEndResult !== null &&
              armEndResult.originalPath === nodeResult.originalPath
                ? armEndResult.column
                : armStartResult.column + 1;

            armPositions.push({
              line: armStartResult.line,
              column: armStartResult.column,
              endLine,
              endColumn,
              covered: armCoverage.isArmCovered(
                armStart,
                armEnd,
                allScriptRanges
              ),
            });
          }

          if (armPositions.length === 0) continue;

          appendDiscovery(
            discoveredByPath,
            nodeResult.originalPath,
            nodeResult.line,
            armPositions
          );
        }

        continue;
      }

      if (resolved.filePath === '') continue;

      const directLineStarts = offsets.lineStarts(resolved.source);

      for (const branchEntry of branchEntries) {
        const nodeLocation = offsets.toLocation(
          branchEntry.nodeStart,
          directLineStarts
        );

        const armPositions: BranchArmPosition[] = [];

        for (
          let armIndex = 0;
          armIndex < branchEntry.armStarts.length;
          armIndex++
        ) {
          const armStart = branchEntry.armStarts[armIndex];
          const armEnd = branchEntry.armEnds[armIndex];
          const startLocation = offsets.toLocation(armStart, directLineStarts);
          const endLocation = offsets.toLocation(armEnd, directLineStarts);

          armPositions.push({
            line: startLocation.line,
            column: startLocation.column + 1,
            endLine: endLocation.line,
            endColumn: endLocation.column + 1,
            covered: armCoverage.isArmCovered(
              armStart,
              armEnd,
              allScriptRanges
            ),
          });
        }

        if (armPositions.length === 0) continue;

        appendDiscovery(
          discoveredByPath,
          resolved.filePath,
          nodeLocation.line,
          armPositions
        );
      }
    }
  }

  return discoveredByPath;
};
