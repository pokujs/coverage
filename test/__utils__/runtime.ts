import type { Reporter, Runtime } from '../../src/@types/reporters.js';
import type { RuntimeSpec } from '../../src/@types/tests.ts';
import { platform as currentPlatform } from 'node:process';

const reset = {
  poku: {
    POKU_RUNTIME: undefined,
    POKU_REPORTER: undefined,
    POKU_TEST_NAME_PATTERN: undefined,
    POKU_TEST_SKIP_PATTERN: undefined,
  },
  engine: {
    NODE_V8_COVERAGE: undefined,
    DENO_COVERAGE_DIR: undefined,
  },
};

export const isWindows = currentPlatform === 'win32';

export const runtimeSpecs: Record<Runtime, RuntimeSpec> = {
  node: {
    command: isWindows ? 'npx.cmd' : 'poku',
    args: isWindows ? ['poku'] : [],
    env: { ...reset.poku, ...reset.engine },
  },
  deno: {
    command: 'deno',
    args: ['run', '-A', 'npm:poku'],
    env: { ...reset.poku, ...reset.engine },
  },
  bun: {
    command: 'bun',
    args: ['--bun', 'poku'],
    env: { ...reset.poku, ...reset.engine },
  },
};

export const runtimes: Runtime[] = ['node', 'bun', 'deno'] as const;

const bunSupports = new Set<Reporter>([
  'text',
  'lcov',
  'lcovonly',
  'text-lcov',
  'teamcity',
  'json-summary',
  'cobertura',
  'clover',
  'none',
  'html',
  'html-spa',
]);

export const runtimesFor = (reporter: Reporter): Runtime[] =>
  bunSupports.has(reporter)
    ? [...runtimes]
    : runtimes.filter((runtime) => runtime !== 'bun');
