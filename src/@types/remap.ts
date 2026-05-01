import type { TraceMap } from './source-map.js';
import type { V8Function, V8ScriptCoverage } from './v8.js';

export type RemapInputs = {
  script: V8ScriptCoverage;
  transpiledLineStarts: number[];
  traceMapInstance: TraceMap;
  cwd: string;
};

export type RemappedScriptEntry = {
  originalPath: string;
  originalSource: string;
  syntheticScript: V8ScriptCoverage;
};

export type OriginalFileState = {
  originalPath: string;
  originalSource: string;
  lineStartTable: number[];
  functions: V8Function[];
};

export type GeneratedNameHelper = {
  state: OriginalFileState;
  startOffset: number;
  endOffset: number;
  count: number;
};
