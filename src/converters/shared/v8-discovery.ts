import type {
  SourceMapCache,
  V8CoverageDocument,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { existsSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../../utils/paths.js';

const findJsonFiles = (tempDir: string): string[] => {
  let entries: string[];

  try {
    entries = readdirSync(tempDir);
  } catch {
    return [];
  }

  return entries
    .filter((entryName) => entryName.endsWith('.json'))
    .map((entryName) => join(tempDir, entryName));
};

const isV8ScriptCoverage = (value: unknown): value is V8ScriptCoverage => {
  if (value === null || typeof value !== 'object') return false;

  const candidate = value as Partial<V8ScriptCoverage>;

  return (
    typeof candidate.url === 'string' && Array.isArray(candidate.functions)
  );
};

const EMPTY_DOCUMENT: V8CoverageDocument = {
  scripts: [],
  sourceMapCache: Object.create(null),
};

const extractSourceMapCache = (parsed: object): SourceMapCache => {
  const candidate = (parsed as { 'source-map-cache'?: unknown })[
    'source-map-cache'
  ];

  if (candidate === null || typeof candidate !== 'object')
    return Object.create(null);

  return candidate as SourceMapCache;
};

const parseJson = (content: string): V8CoverageDocument => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return EMPTY_DOCUMENT;
  }

  if (parsed === null || typeof parsed !== 'object') return EMPTY_DOCUMENT;

  const sourceMapCache = extractSourceMapCache(parsed);
  const wrapped = (parsed as { result?: unknown }).result;

  if (Array.isArray(wrapped)) {
    return { scripts: wrapped.filter(isV8ScriptCoverage), sourceMapCache };
  }

  if (isV8ScriptCoverage(parsed)) {
    return { scripts: [parsed], sourceMapCache };
  }

  return EMPTY_DOCUMENT;
};

const resolveFilePath = (url: string, cwd: string): string | undefined => {
  if (!url.startsWith('file://')) return undefined;

  let absolutePath: string;

  try {
    absolutePath = fileURLToPath(url);
  } catch {
    return undefined;
  }

  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  if (!absolutePath.startsWith(cwdPrefix)) return undefined;
  if (paths.isBanned(absolutePath)) return undefined;
  if (!existsSync(absolutePath)) return undefined;
  return absolutePath;
};

export const v8Discovery = {
  findJsonFiles,
  parseJson,
  resolveFilePath,
} as const;
