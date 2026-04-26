import type { Node, Program } from 'acorn';
import type { TypedNode } from '../@types/acorn-nodes.js';
import type {
  AppendDiscoveryInputs,
  AstArmRange,
  AstBranchEntry,
  BranchArmPosition,
  DiscoveredBranch,
  RangeProbe,
  ScriptCoverageData,
} from '../@types/branch-discovery.js';
import type { ResolvedFileFilter } from '../@types/file-filter.js';
import type { SourceMapInput, TraceMap } from '../@types/source-map.js';
import type {
  ResolvedScriptSource,
  V8Range,
  V8ScriptCoverage,
} from '../@types/v8.js';
import { readFileSync } from 'node:fs';
import { offsets } from '../utils/offsets.js';
import { traceMap } from '../utils/source-map/index.js';
import { armCoverage } from './shared/arm-coverage.js';
import { astCache } from './shared/ast-cache.js';
import { astWalk } from './shared/ast-walk.js';
import { passesPreRemapFilter } from './shared/pre-remap-filter.js';
import { sourceCache } from './shared/source-cache.js';
import { findV8JsonFiles, parseV8Json } from './shared/v8-discovery.js';

const TS_TYPE_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

const unwrapTypeAssertion = (node: Node): Node => {
  let current: Node = node;

  while (TS_TYPE_WRAPPER_TYPES.has(current.type)) {
    const inner = Reflect.get(current, 'expression');
    if (inner === null || inner === undefined) break;
    if (typeof inner !== 'object') break;
    current = inner as Node;
  }

  return current;
};

const armOf = (node: Node): AstArmRange => {
  const unwrapped = unwrapTypeAssertion(node);
  return { armStart: unwrapped.start, armEnd: unwrapped.end };
};

const computeArmRanges = (currentNode: Node): readonly AstArmRange[] => {
  const typed = currentNode as TypedNode;

  if (typed.type === 'LogicalExpression') {
    return [armOf(typed.left), armOf(typed.right)];
  }

  if (typed.type === 'ConditionalExpression') {
    return [armOf(typed.consequent), armOf(typed.alternate)];
  }

  if (typed.type === 'AssignmentPattern') {
    return [armOf(typed.right)];
  }

  if (typed.type === 'IfStatement') {
    if (typed.alternate !== null)
      return [armOf(typed.consequent), armOf(typed.alternate)];
    return [armOf(typed.consequent)];
  }

  if (typed.type === 'SwitchStatement') {
    if (typed.cases.length === 0) return [];

    return typed.cases.map((caseNode) => ({
      armStart: caseNode.start,
      armEnd: caseNode.end,
    }));
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
      nodeEnd: currentNode.end,
      armStarts: armRanges.map((range) => range.armStart),
      armEnds: armRanges.map((range) => range.armEnd),
    });
  });

  return entries;
};

const appendDiscovery = (inputs: AppendDiscoveryInputs): void => {
  const entry: DiscoveredBranch = {
    line: inputs.startLine,
    column: inputs.startColumn,
    endLine: inputs.endLine,
    endColumn: inputs.endColumn,
    arms: inputs.arms,
  };

  const existing = inputs.discoveredByPath.get(inputs.originalPath);
  if (existing === undefined) {
    inputs.discoveredByPath.set(inputs.originalPath, [entry]);
    return;
  }

  existing.push(entry);
};

const buildIdentityProbe = (): RangeProbe => (originalByteOffset) =>
  originalByteOffset;

const buildSourceMapProbe = (
  resolved: ResolvedScriptSource,
  originalLineStarts: number[]
): RangeProbe | null => {
  const traceMapInstance: TraceMap = traceMap.create(
    resolved.sourceMapData as SourceMapInput,
    resolved.sourceMapUrl
  );

  const sourceIndex = traceMapInstance.resolvedSources.indexOf(
    resolved.filePath
  );
  if (sourceIndex === -1) return null;

  const matchedSource = traceMapInstance.resolvedSources[sourceIndex];

  return (originalByteOffset: number): number => {
    const originalLocation = offsets.toLocation(
      originalByteOffset,
      originalLineStarts
    );

    const generated = traceMapInstance.generatedPositionFor({
      source: matchedSource,
      line: originalLocation.line,
      column: originalLocation.column,
    });

    if (generated.line === null || generated.column === null) return -1;

    return offsets.toOffset(
      { line: generated.line, column: generated.column },
      resolved.transpiledLineStarts
    );
  };
};

const collectScriptRanges = (script: V8ScriptCoverage): readonly V8Range[] =>
  script.functions.flatMap((scriptFunction) => scriptFunction.ranges);

const run = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): Map<string, readonly DiscoveredBranch[]> => {
  astCache.reset();

  const discoveredByPath = new Map<string, DiscoveredBranch[]>();
  const byUrl = new Map<string, ScriptCoverageData>();

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
      const resolved = sourceCache.resolve({
        script,
        sourceMapCache: document.sourceMapCache,
        cwd,
      });
      if (resolved === undefined) continue;
      if (resolved.filePath === '') continue;

      if (!passesPreRemapFilter(script, resolved, preRemapFilter, cwd))
        continue;

      let entry = byUrl.get(script.url);
      if (entry === undefined) {
        entry = { resolved, perProcessRanges: [] };
        byUrl.set(script.url, entry);
      }
      entry.perProcessRanges.push(collectScriptRanges(script).slice());
    }
  }

  for (const data of byUrl.values()) {
    const { resolved, perProcessRanges } = data;

    const programTree = astCache.parse(resolved.source);
    if (programTree === null) continue;

    const branchEntries = collectBranchEntries(programTree);
    if (branchEntries.length === 0) continue;

    const originalLineStarts = offsets.lineStarts(resolved.source);

    const probe =
      resolved.sourceMapData === undefined
        ? buildIdentityProbe()
        : buildSourceMapProbe(resolved, originalLineStarts);

    if (probe === null) continue;

    for (const branchEntry of branchEntries) {
      const nodeStartLocation = offsets.toLocation(
        branchEntry.nodeStart,
        originalLineStarts
      );
      const nodeEndLocation = offsets.toLocation(
        branchEntry.nodeEnd,
        originalLineStarts
      );

      const armPositions: BranchArmPosition[] = [];

      for (
        let armIndex = 0;
        armIndex < branchEntry.armStarts.length;
        armIndex++
      ) {
        const armStart = branchEntry.armStarts[armIndex];
        const armEnd = branchEntry.armEnds[armIndex];

        const startLocation = offsets.toLocation(armStart, originalLineStarts);
        const endLocation = offsets.toLocation(armEnd, originalLineStarts);

        const probedStart = probe(armStart);
        const probedEnd = probe(armEnd);

        const covered =
          probedStart === -1 || probedEnd === -1
            ? true
            : perProcessRanges.some((scriptRanges) =>
                armCoverage.isArmCovered(probedStart, probedEnd, scriptRanges)
              );

        armPositions.push({
          line: startLocation.line,
          column: startLocation.column + 1,
          endLine: endLocation.line,
          endColumn: endLocation.column + 1,
          covered,
        });
      }

      if (armPositions.length === 0) continue;

      appendDiscovery({
        discoveredByPath,
        originalPath: resolved.filePath,
        startLine: nodeStartLocation.line,
        startColumn: nodeStartLocation.column,
        endLine: nodeEndLocation.line,
        endColumn: nodeEndLocation.column,
        arms: armPositions,
      });
    }
  }

  return discoveredByPath;
};

export const discoverBranches = { run } as const;
