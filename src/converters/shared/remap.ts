import type {
  OriginalFileState,
  RemapInputs,
  RemappedScriptEntry,
} from '../../@types/remap.js';
import type {
  InvalidOriginalMapping,
  OriginalMapping,
} from '../../@types/source-map.js';
import type { V8Range, V8ScriptCoverage } from '../../@types/v8.js';
import { isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { offsets } from '../../utils/offsets.js';
import { isBannedPath } from '../../utils/paths.js';

const isValidMapping = (
  mapping: OriginalMapping | InvalidOriginalMapping
): mapping is OriginalMapping =>
  mapping.source !== null && mapping.line !== null && mapping.column !== null;

const pathFromResolvedSource = (
  resolvedSource: string,
  cwd: string
): string | undefined => {
  if (!isAbsolute(resolvedSource)) return undefined;

  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  if (!resolvedSource.startsWith(cwdPrefix)) return undefined;
  if (isBannedPath(resolvedSource)) return undefined;

  return resolvedSource;
};

const lookupOriginalSource = (
  inputs: RemapInputs,
  resolvedSource: string
): string | undefined => {
  const sourceIndex =
    inputs.traceMapInstance.resolvedSources.indexOf(resolvedSource);
  if (sourceIndex === -1) return undefined;

  const sourcesContent = inputs.traceMapInstance.sourcesContent;
  if (!Array.isArray(sourcesContent)) return undefined;

  const sourceContent = sourcesContent[sourceIndex];
  if (typeof sourceContent !== 'string') return undefined;

  return sourceContent;
};

const ensureFileState = (
  stateMap: Map<string, OriginalFileState>,
  originalPath: string,
  originalSource: string
): OriginalFileState => {
  let state = stateMap.get(originalPath);
  if (state !== undefined) return state;

  state = {
    originalPath,
    originalSource,
    lineStartTable: offsets.lineStarts(originalSource),
    functions: [],
  };

  stateMap.set(originalPath, state);
  return state;
};

const remapRange = (
  range: V8Range,
  transpiledLineStarts: number[],
  inputs: RemapInputs,
  stateMap: Map<string, OriginalFileState>
): { state: OriginalFileState; range: V8Range } | undefined => {
  const inclusiveEndOffset = Math.max(range.startOffset, range.endOffset - 1);

  const startLocation = offsets.toLocation(
    range.startOffset,
    transpiledLineStarts
  );

  const endLocation = offsets.toLocation(
    inclusiveEndOffset,
    transpiledLineStarts
  );

  const startMapping =
    inputs.traceMapInstance.originalPositionFor(startLocation);

  const endMapping = inputs.traceMapInstance.originalPositionFor(endLocation);

  if (!isValidMapping(startMapping)) return undefined;
  if (!isValidMapping(endMapping)) return undefined;
  if (startMapping.source !== endMapping.source) return undefined;

  const originalPath = pathFromResolvedSource(startMapping.source, inputs.cwd);
  if (originalPath === undefined) return undefined;

  let state = stateMap.get(originalPath);
  if (state === undefined) {
    const originalSource = lookupOriginalSource(inputs, startMapping.source);
    if (originalSource === undefined) return undefined;

    state = ensureFileState(stateMap, originalPath, originalSource);
  }

  const originalStart = offsets.toOffset(
    { line: startMapping.line, column: startMapping.column },
    state.lineStartTable
  );

  const originalEnd = offsets.toOffset(
    { line: endMapping.line, column: endMapping.column + 1 },
    state.lineStartTable
  );

  if (originalEnd <= originalStart) return undefined;

  return {
    state,
    range: {
      startOffset: originalStart,
      endOffset: originalEnd,
      count: range.count,
    },
  };
};

const buildSyntheticScript = (
  sourceScript: V8ScriptCoverage,
  state: OriginalFileState
): V8ScriptCoverage => ({
  scriptId: sourceScript.scriptId,
  url: pathToFileURL(state.originalPath).href,
  functions: state.functions,
});

const baselineCountForScript = (script: V8ScriptCoverage): number => {
  const outerFunction = script.functions[0];
  if (outerFunction === undefined) return 0;

  const outerRange = outerFunction.ranges[0];
  if (outerRange === undefined) return 0;

  return outerRange.count;
};

const injectBaselineRanges = (
  stateMap: Map<string, OriginalFileState>,
  baselineCount: number
): void => {
  if (baselineCount <= 0) return;

  for (const state of stateMap.values()) {
    state.functions.push({
      functionName: '',
      isBlockCoverage: true,
      ranges: [
        {
          startOffset: 0,
          endOffset: state.originalSource.length,
          count: baselineCount,
        },
      ],
    });
  }
};

const project = (inputs: RemapInputs): RemappedScriptEntry[] => {
  const transpiledLineStarts = inputs.transpiledLineStarts;
  const stateMap = new Map<string, OriginalFileState>();
  const baselineCount = baselineCountForScript(inputs.script);

  for (const scriptFunction of inputs.script.functions) {
    const remappedRanges: V8Range[] = [];

    let targetState: OriginalFileState | undefined;
    let outerRemapped = false;

    for (
      let rangeIndex = 0;
      rangeIndex < scriptFunction.ranges.length;
      rangeIndex++
    ) {
      const range = scriptFunction.ranges[rangeIndex];

      const outcome = remapRange(range, transpiledLineStarts, inputs, stateMap);
      if (outcome === undefined) continue;

      if (targetState === undefined) {
        targetState = outcome.state;
      } else if (targetState !== outcome.state) {
        continue;
      }

      if (rangeIndex === 0) outerRemapped = true;

      remappedRanges.push(outcome.range);
    }

    if (remappedRanges.length === 0 || targetState === undefined) continue;

    if (
      remappedRanges.length === 1 &&
      remappedRanges[0].count === 0 &&
      remappedRanges[0].endOffset - remappedRanges[0].startOffset <= 1
    ) {
      continue;
    }

    if (!outerRemapped && scriptFunction.ranges.length > 0) {
      const firstRemapped = remappedRanges[0];

      remappedRanges.unshift({
        startOffset: firstRemapped.startOffset,
        endOffset: firstRemapped.startOffset,
        count: scriptFunction.ranges[0].count,
      });
    }

    targetState.functions.push({
      functionName: scriptFunction.functionName,
      isBlockCoverage: scriptFunction.isBlockCoverage,
      ranges: remappedRanges,
    });
  }

  injectBaselineRanges(stateMap, baselineCount);

  const entries: RemappedScriptEntry[] = [];

  for (const state of stateMap.values()) {
    if (state.functions.length === 0) continue;

    entries.push({
      originalPath: state.originalPath,
      originalSource: state.originalSource,
      syntheticScript: buildSyntheticScript(inputs.script, state),
    });
  }

  return entries;
};

export const sourceMapRemap = { project } as const;
