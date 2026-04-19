import type { Program } from 'acorn';
import type { AstCacheHandler } from '../../@types/ast-cache.js';
import { parse as acornParse } from 'acorn';

const ACORN_OPTIONS = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  allowHashBang: true,
  allowAwaitOutsideFunction: true,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  allowSuperOutsideMethod: true,
} as const;

const cachedPrograms = new Map<string, Program | null>();

const parse = (source: string): Program | null => {
  const cached = cachedPrograms.get(source);
  if (cached !== undefined || cachedPrograms.has(source)) return cached ?? null;

  let program: Program | null;
  try {
    program = acornParse(source, ACORN_OPTIONS);
  } catch {
    program = null;
  }

  cachedPrograms.set(source, program);

  return program;
};

const reset = (): void => {
  cachedPrograms.clear();
};

export const astCache: AstCacheHandler = {
  parse,
  reset,
};
