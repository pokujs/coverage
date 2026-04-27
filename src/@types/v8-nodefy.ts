import type { V8ScriptCoverage } from './v8.js';

export type V8NodefyMode = 'direct' | 'remap';

export type V8NodefiedSourceMap = {
  data: object;
  lineLengths: number[];
};

export type V8NodefiedScript = {
  script: V8ScriptCoverage;
  mode: V8NodefyMode;
  sourceMap?: V8NodefiedSourceMap;
};

export type V8NodefiedDocument = {
  scripts: V8NodefiedScript[];
};

export type V8NodefyResolveInputs = {
  nodefied: V8NodefiedScript;
  cwd: string;
};
