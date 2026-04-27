import type { V8NodefiedScript } from '../../@types/v8-nodefy.js';
import type { V8ScriptCoverage } from '../../@types/v8.js';

const isV8ScriptCoverage = (value: unknown): value is V8ScriptCoverage => {
  if (value === null || typeof value !== 'object') return false;

  const candidate = value as Partial<V8ScriptCoverage>;

  return (
    typeof candidate.url === 'string' && Array.isArray(candidate.functions)
  );
};

const buildScript = (
  script: V8ScriptCoverage,
  sourceMapCache: Record<string, unknown>
): V8NodefiedScript => {
  const cacheEntry = sourceMapCache[script.url];

  if (
    cacheEntry !== undefined &&
    cacheEntry !== null &&
    typeof cacheEntry === 'object'
  ) {
    const entry = cacheEntry as { data?: unknown; lineLengths?: unknown };

    if (
      typeof entry.data === 'object' &&
      entry.data !== null &&
      Array.isArray(entry.lineLengths)
    ) {
      return {
        script,
        mode: 'remap',
        sourceMap: {
          data: entry.data,
          lineLengths: entry.lineLengths as number[],
        },
      };
    }
  }

  return { script, mode: 'direct' };
};

const parse = (content: string): V8NodefiedScript[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (parsed === null || typeof parsed !== 'object') return [];

  const envelope = parsed as {
    result?: unknown;
    'source-map-cache'?: unknown;
  };

  if (!Array.isArray(envelope.result)) return [];

  const sourceMapCache: Record<string, unknown> =
    envelope['source-map-cache'] !== undefined &&
    envelope['source-map-cache'] !== null &&
    typeof envelope['source-map-cache'] === 'object'
      ? (envelope['source-map-cache'] as Record<string, unknown>)
      : Object.create(null);

  const scripts: V8NodefiedScript[] = [];

  for (const candidate of envelope.result) {
    if (!isV8ScriptCoverage(candidate)) continue;
    scripts.push(buildScript(candidate, sourceMapCache));
  }

  return scripts;
};

export const nodefyNode = { parse } as const;
