import type {
  ResolvedScriptSource,
  SourceCacheResolveInputs,
  SourceMapCacheEntry,
} from '../../@types/v8.js';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { offsets } from '../../utils/offsets.js';
import { isBannedPath } from '../../utils/paths.js';
import { sourceMapComment } from '../../utils/source-map-comment.js';
import { resolveFilePath } from './v8-discovery.js';

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

const hasSourceMapPayload = (
  entry: SourceMapCacheEntry | undefined
): entry is SourceMapCacheEntry & { data: object } => {
  if (entry === undefined) return false;
  return typeof entry.data === 'object' && entry.data !== null;
};

type SourceMapPayload = {
  sources?: unknown;
  sourcesContent?: unknown;
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
  if (isBannedPath(absoluteSourcePath)) return undefined;

  return { filePath: absoluteSourcePath, source: rawContent };
};

const resolveFromSourceMapCache = (
  inputs: SourceCacheResolveInputs
): ResolvedScriptSource | undefined => {
  const cacheEntry = inputs.sourceMapCache[inputs.script.url];

  if (!hasSourceMapPayload(cacheEntry)) return undefined;
  if (!Array.isArray(cacheEntry.lineLengths)) return undefined;

  const original = extractOriginalContents(cacheEntry.data, inputs.cwd);
  if (original === undefined) return undefined;

  return {
    filePath: original.filePath,
    source: original.source,
    sourceMapData: cacheEntry.data,
    sourceMapUrl: inputs.script.url,
    transpiledLineStarts: lineLengthsToLineStarts(cacheEntry.lineLengths),
  };
};

const defaultDenoDir = (): string => {
  const override = process.env.DENO_DIR;
  if (override !== undefined && override.length > 0) return override;

  const home = homedir();

  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Caches', 'deno');
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;

    if (localAppData !== undefined && localAppData.length > 0) {
      return join(localAppData, 'deno');
    }

    return join(home, 'AppData', 'Local', 'deno');
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;

  if (xdgCacheHome !== undefined && xdgCacheHome.length > 0) {
    return join(xdgCacheHome, 'deno');
  }

  return join(home, '.cache', 'deno');
};

const TS_EXTENSION_PATTERN = /\.(?:c|m)?tsx?$/;

const resolveFromDenoCache = (
  inputs: SourceCacheResolveInputs
): ResolvedScriptSource | undefined => {
  const scriptUrl = inputs.script.url;

  if (!scriptUrl.startsWith('file://')) return undefined;
  if (!TS_EXTENSION_PATTERN.test(scriptUrl)) return undefined;

  let absoluteSourcePath: string;
  try {
    absoluteSourcePath = fileURLToPath(scriptUrl);
  } catch {
    return undefined;
  }

  const relativeBelowRoot = absoluteSourcePath.startsWith('/')
    ? absoluteSourcePath.slice(1)
    : absoluteSourcePath;

  const cachedEmitPath = join(
    defaultDenoDir(),
    'gen',
    'file',
    `${relativeBelowRoot}.js`
  );

  if (!existsSync(cachedEmitPath)) return undefined;

  let cachedEmitSource: string;
  try {
    cachedEmitSource = readFileSync(cachedEmitPath, 'utf8');
  } catch {
    return undefined;
  }

  const parsedSourceMap = sourceMapComment.fromSource(cachedEmitSource);
  if (parsedSourceMap === null) return undefined;

  const original = extractOriginalContents(parsedSourceMap, inputs.cwd);
  if (original === undefined) return undefined;

  return {
    filePath: original.filePath,
    source: original.source,
    sourceMapData: parsedSourceMap,
    sourceMapUrl: scriptUrl,
    transpiledLineStarts: offsets.lineStarts(cachedEmitSource),
  };
};

const resolveFromDisk = (
  inputs: SourceCacheResolveInputs
): ResolvedScriptSource | undefined => {
  const filePath = resolveFilePath(inputs.script.url, inputs.cwd);
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
    sourceMapUrl: inputs.script.url,
    transpiledLineStarts: offsets.lineStarts(source),
  };
};

const resolve = (
  inputs: SourceCacheResolveInputs
): ResolvedScriptSource | undefined => {
  const fromNodeCache = resolveFromSourceMapCache(inputs);
  if (fromNodeCache !== undefined) return fromNodeCache;

  const fromDenoCache = resolveFromDenoCache(inputs);
  if (fromDenoCache !== undefined) return fromDenoCache;

  return resolveFromDisk(inputs);
};

export const sourceCache = { resolve } as const;
