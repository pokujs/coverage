import type { V8NodefiedScript } from '../../@types/v8-nodefy.js';
import type { V8ScriptCoverage } from '../../@types/v8.js';

const isV8ScriptCoverage = (value: unknown): value is V8ScriptCoverage => {
  if (value === null || typeof value !== 'object') return false;

  const candidate = value as Partial<V8ScriptCoverage>;

  return (
    typeof candidate.url === 'string' && Array.isArray(candidate.functions)
  );
};

const parse = (content: string): V8NodefiedScript[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!isV8ScriptCoverage(parsed)) return [];

  return [{ script: parsed, mode: 'direct' }];
};

export const nodefyDeno = { parse } as const;
