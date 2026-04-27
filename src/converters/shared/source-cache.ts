import type {
  V8NodefiedScript,
  V8NodefiedSourceMap,
  V8NodefyResolveInputs,
} from '../../@types/v8-nodefy.js';
import type {
  ResolvedScriptSource,
  SourceMapPayload,
} from '../../@types/v8.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { offsets } from '../../utils/offsets.js';
import { paths } from '../../utils/paths.js';
import { v8Discovery } from './v8-discovery.js';

const lineLengthsToLineStarts = (lineLengths: number[]): number[] => {
  const starts: number[] = [0];
  let cumulative = 0;

  for (const length of lineLengths) {
    cumulative += length + 1;
    starts.push(cumulative);
  }

  starts.push(cumulative);
  return starts;
};

const extractOriginalContents = (
  sourceMapData: object,
  cwd: string
): { filePath: string; source: string } | undefined => {
  const payload = sourceMapData as SourceMapPayload;

  if (!Array.isArray(payload.sources)) return undefined;
  if (!Array.isArray(payload.sourcesContent)) return undefined;
  if (payload.sources.length !== 1) return undefined;

  const rawSource = payload.sources[0];
  const rawContent = payload.sourcesContent[0];

  if (typeof rawSource !== 'string') return undefined;
  if (typeof rawContent !== 'string') return undefined;

  let absoluteSourcePath: string;

  if (rawSource.startsWith('file://')) {
    try {
      absoluteSourcePath = fileURLToPath(rawSource);
    } catch {
      return undefined;
    }
  } else if (rawSource.startsWith('/')) {
    absoluteSourcePath = rawSource;
  } else {
    return undefined;
  }

  const cwdPrefix = cwd.endsWith('/') ? cwd : `${cwd}/`;

  if (!absoluteSourcePath.startsWith(cwdPrefix)) return undefined;
  if (paths.isBanned(absoluteSourcePath)) return undefined;

  return { filePath: absoluteSourcePath, source: rawContent };
};

const resolveFromRemap = (
  nodefied: V8NodefiedScript,
  sourceMap: V8NodefiedSourceMap,
  cwd: string
): ResolvedScriptSource | undefined => {
  const original = extractOriginalContents(sourceMap.data, cwd);
  if (original === undefined) return undefined;

  return {
    filePath: original.filePath,
    source: original.source,
    sourceMapData: sourceMap.data,
    sourceMapUrl: nodefied.script.url,
    transpiledLineStarts: lineLengthsToLineStarts(sourceMap.lineLengths),
  };
};

const resolveFromDisk = (
  nodefied: V8NodefiedScript,
  cwd: string
): ResolvedScriptSource | undefined => {
  const filePath = v8Discovery.resolveFilePath(nodefied.script.url, cwd);
  if (filePath === undefined) return undefined;

  let source: string;

  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }

  return {
    filePath,
    source,
    sourceMapData: undefined,
    sourceMapUrl: nodefied.script.url,
    transpiledLineStarts: offsets.lineStarts(source),
  };
};

const resolve = (
  inputs: V8NodefyResolveInputs
): ResolvedScriptSource | undefined => {
  const { nodefied, cwd } = inputs;

  if (nodefied.mode === 'remap' && nodefied.sourceMap !== undefined) {
    const remapped = resolveFromRemap(nodefied, nodefied.sourceMap, cwd);
    if (remapped !== undefined) return remapped;
  }

  return resolveFromDisk(nodefied, cwd);
};

export const sourceCache = { resolve } as const;
