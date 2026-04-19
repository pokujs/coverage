import type { ReporterName, Runtime } from '../../src/@types/reporters.js';
import type { RuntimeSpec } from '../../src/@types/tests.ts';
import { platform as currentPlatform } from 'node:process';

const reset = {
  poku: {
    POKU_RUNTIME: undefined,
    POKU_REPORTER: undefined,
    POKU_TEST_NAME_PATTERN: undefined,
    POKU_TEST_SKIP_PATTERN: undefined,
  },
};

export const isWindows = currentPlatform === 'win32';

export const runtimeSpecs: Record<Runtime, RuntimeSpec> = {
  node: {
    command: isWindows ? 'npx.cmd' : 'poku',
    args: isWindows ? ['poku'] : [],
    env: { ...reset.poku, NODE_V8_COVERAGE: undefined },
  },
  deno: {
    command: 'deno',
    args: ['run', '-A', 'npm:poku'],
    env: { ...reset.poku, DENO_COVERAGE_DIR: undefined },
  },
  bun: {
    command: 'bun',
    args: ['--bun', 'poku'],
    env: reset.poku,
  },
};

export const runtimes: Runtime[] = ['node', 'bun', 'deno'] as const;

const bunSupports = new Set<ReporterName>([
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

export const runtimesFor = (reporter: ReporterName): Runtime[] =>
  bunSupports.has(reporter)
    ? [...runtimes]
    : runtimes.filter((runtime) => runtime !== 'bun');
