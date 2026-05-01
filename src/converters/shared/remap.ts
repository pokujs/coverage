import type { LineColumn } from '../../@types/offsets.js';
import type {
  GeneratedNameHelper,
  OriginalFileState,
  RemapInputs,
  RemappedScriptEntry,
} from '../../@types/remap.js';
import type {
  InvalidOriginalMapping,
  OriginalMapping,
  TraceMap,
} from '../../@types/source-map.js';
import type { V8Range, V8ScriptCoverage } from '../../@types/v8.js';
import { isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { offsets } from '../../utils/offsets.js';
import { paths } from '../../utils/paths.js';
import { traceMap } from '../../utils/source-map/index.js';

const isValidMapping = (
  mapping: OriginalMapping | InvalidOriginalMapping
): mapping is OriginalMapping =>
  mapping.source !== null && mapping.line !== null && mapping.column !== null;

const lookupWithFallback = (
  traceMapInstance: TraceMap,
  location: LineColumn,
  totalLines: number,
  direction: 'forward' | 'backward'
): OriginalMapping | InvalidOriginalMapping => {
  const primary = traceMapInstance.originalPositionFor(location);

  if (isValidMapping(primary)) return primary;

  const sameLine = traceMapInstance.originalPositionFor({
    ...location,
    bias: traceMap.LEAST_UPPER_BOUND,
  });

  if (isValidMapping(sameLine)) return sameLine;

  if (direction === 'forward') {
    for (
      let probeLine = location.line + 1;
      probeLine <= totalLines;
      probeLine++
    ) {
      const probe = traceMapInstance.originalPositionFor({
        line: probeLine,
        column: 0,
        bias: traceMap.LEAST_UPPER_BOUND,
      });

      if (isValidMapping(probe)) return probe;
    }

    return sameLine;
  }

  for (let probeLine = location.line - 1; probeLine >= 1; probeLine--) {
    const probe = traceMapInstance.originalPositionFor({
      line: probeLine,
      column: 0,
    });

    if (isValidMapping(probe)) return probe;
  }

  return sameLine;
};

const pathFromResolvedSource = (
  resolvedSource: string,
  cwd: string
): string | undefined => {
  if (!isAbsolute(resolvedSource)) return undefined;

  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  if (!resolvedSource.startsWith(cwdPrefix)) return undefined;
  if (paths.isBanned(resolvedSource)) return undefined;

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
  stateMap: Map<string, OriginalFileState>,
  allowEndFallback: boolean
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

  const totalLines = Math.max(0, transpiledLineStarts.length - 1);
  const startMapping = lookupWithFallback(
    inputs.traceMapInstance,
    startLocation,
    totalLines,
    'backward'
  );
  const endMapping = lookupWithFallback(
    inputs.traceMapInstance,
    endLocation,
    totalLines,
    'forward'
  );

  if (!isValidMapping(startMapping)) return undefined;

  const originalPath = pathFromResolvedSource(startMapping.source, inputs.cwd);
  if (originalPath === undefined) return undefined;

  let state = stateMap.get(originalPath);
  if (state === undefined) {
    const originalSource = lookupOriginalSource(inputs, startMapping.source);
    if (originalSource === undefined) return undefined;

    state = ensureFileState(stateMap, originalPath, originalSource);
  }

  if (isValidMapping(endMapping) && startMapping.source !== endMapping.source)
    return undefined;
  if (!isValidMapping(endMapping) && !allowEndFallback) return undefined;

  const originalStart = offsets.toOffset(
    { line: startMapping.line, column: startMapping.column },
    state.lineStartTable
  );

  const originalEnd = isValidMapping(endMapping)
    ? offsets.toOffset(
        { line: endMapping.line, column: endMapping.column + 1 },
        state.lineStartTable
      )
    : state.originalSource.length;

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

const collectGeneratedNameHelper = (
  scriptFunction: V8ScriptCoverage['functions'][number],
  transpiledLineStarts: number[],
  inputs: RemapInputs,
  stateMap: Map<string, OriginalFileState>,
  generatedNameHelpers: Map<string, GeneratedNameHelper>
): void => {
  if (scriptFunction.functionName !== '') return;

  const outerRange = scriptFunction.ranges[0];

  if (outerRange === undefined) return;
  if (outerRange.startOffset === 0) return;

  const startLocation = offsets.toLocation(
    outerRange.startOffset,
    transpiledLineStarts
  );
  const startMapping = lookupWithFallback(
    inputs.traceMapInstance,
    startLocation,
    Math.max(0, transpiledLineStarts.length - 1),
    'backward'
  );

  if (isValidMapping(startMapping)) return;

  const inclusiveEndOffset = Math.max(
    outerRange.startOffset,
    outerRange.endOffset - 1
  );
  const endLocation = offsets.toLocation(
    inclusiveEndOffset,
    transpiledLineStarts
  );
  const endMapping = lookupWithFallback(
    inputs.traceMapInstance,
    endLocation,
    Math.max(0, transpiledLineStarts.length - 1),
    'forward'
  );

  if (!isValidMapping(endMapping)) return;

  const originalPath = pathFromResolvedSource(endMapping.source, inputs.cwd);
  if (originalPath === undefined) return;

  let state = stateMap.get(originalPath);
  if (state === undefined) {
    const originalSource = lookupOriginalSource(inputs, endMapping.source);
    if (originalSource === undefined) return;

    state = ensureFileState(stateMap, originalPath, originalSource);
  }

  const originalStart = offsets.toOffset(
    { line: endMapping.line, column: endMapping.column },
    state.lineStartTable
  );
  const originalEnd = Math.min(originalStart + 1, state.originalSource.length);
  if (originalEnd <= originalStart) return;

  const existing = generatedNameHelpers.get(originalPath);
  if (existing !== undefined) {
    existing.count++;
    return;
  }

  generatedNameHelpers.set(originalPath, {
    state,
    startOffset: originalStart,
    endOffset: originalEnd,
    count: 1,
  });
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
  const generatedNameHelpers = new Map<string, GeneratedNameHelper>();
  const baselineCount = baselineCountForScript(inputs.script);
  const hasNameHelper = inputs.script.functions.some(
    (scriptFunction) => scriptFunction.functionName === '__name'
  );

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
      const allowEndFallback = !(
        scriptFunction.functionName === '' &&
        rangeIndex === 0 &&
        range.startOffset === 0
      );

      const outcome = remapRange(
        range,
        transpiledLineStarts,
        inputs,
        stateMap,
        allowEndFallback
      );
      if (outcome === undefined) {
        if (!hasNameHelper && rangeIndex === 0)
          collectGeneratedNameHelper(
            scriptFunction,
            transpiledLineStarts,
            inputs,
            stateMap,
            generatedNameHelpers
          );
        continue;
      }

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

  for (const generatedNameHelper of generatedNameHelpers.values()) {
    generatedNameHelper.state.functions.push({
      functionName: '__name',
      isBlockCoverage: false,
      ranges: [
        {
          startOffset: generatedNameHelper.startOffset,
          endOffset: generatedNameHelper.endOffset,
          count: generatedNameHelper.count,
        },
      ],
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
