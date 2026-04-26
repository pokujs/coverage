import type {
  FileFilterOptions,
  ResolvedFileFilter,
} from './@types/file-filter.js';
import { globs } from './utils/globs.js';
import { paths } from './utils/paths.js';

/*
 * Extends exclude list adapted from @istanbuljs/schema.
 * MIT License
 * Copyright (c) 2019 CFWare, LLC
 */
const DEFAULT_EXCLUDE: readonly string[] = [
  '**/.git/**',
  '**/node_modules/**',
  'coverage/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'test{,s}/**',
  '**/test{,-*}.{js,cjs,mjs,ts,cts,mts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,cts,mts,tsx,jsx}',
  '**/__tests__/**',
  '**/{babel,nyc}.config.{js,cjs,mjs}',
  '**/{rollup,webpack}.config.{js,cjs,mjs}',
  '**/poku.config.{js,cjs,mjs,ts,cts,mts}',
  '**/.eslintrc.{js,cjs,mjs}',
];

const getDefaultExclude = (): readonly string[] => DEFAULT_EXCLUDE;

const normalizePattern = (pattern: string): string => {
  let normalized = pattern.replace(/\\/g, '/');

  while (normalized.startsWith('./')) normalized = normalized.slice(2);

  normalized = normalized.replace(/\/+/g, '/');

  if (normalized.length > 1 && normalized.endsWith('/'))
    normalized = normalized.slice(0, -1);

  return normalized;
};

const normalizePatternList = (patterns: readonly string[]): string[] => {
  const result: string[] = [];

  for (const pattern of patterns) {
    const normalized = normalizePattern(pattern);
    if (normalized.length > 0) result.push(normalized);
  }

  return result;
};

const resolve = (options: FileFilterOptions): ResolvedFileFilter => {
  const excludeList = normalizePatternList(options.exclude ?? DEFAULT_EXCLUDE);
  const includeList = normalizePatternList(options.include ?? []);

  return {
    includeRegexes: globs.compile(includeList),
    excludeRegexes: globs.compile(excludeList),
  };
};

const matches = (
  resolved: ResolvedFileFilter,
  absolutePath: string,
  cwd: string
): boolean => {
  const relativePath = paths.toPosix(paths.relativize(absolutePath, cwd));

  if (
    resolved.includeRegexes.length > 0 &&
    !globs.matchesAny(resolved.includeRegexes, relativePath)
  )
    return false;

  if (globs.matchesAny(resolved.excludeRegexes, relativePath)) return false;

  return true;
};

export const fileFilter = {
  getDefaultExclude,
  resolve,
  matches,
} as const;
