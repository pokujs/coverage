import type { Options, Program } from 'acorn';
// @ts-expect-error: ESM-only package
import { tsPlugin } from '@sveltejs/acorn-typescript';
import { Parser } from 'acorn';

const TypeScriptParser = Parser.extend(
  tsPlugin({
    dts: false,
    jsx: true,
  })
);

const ACORN_OPTIONS: Options = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
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
    program = TypeScriptParser.parse(source, ACORN_OPTIONS) as Program;
  } catch {
    program = null;
  }

  cachedPrograms.set(source, program);

  return program;
};

const reset = (): void => {
  cachedPrograms.clear();
};

export const astCache = {
  parse,
  reset,
} as const;
