import type {
  FixtureRun,
  RuntimeSpec,
  TestCase,
} from '../../src/@types/tests.ts';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { isWindows, runtimeSpecs } from './runtime.ts';

const fixturesRoot = join(cwd(), 'test', '__fixtures__', 'e2e');

const baselineEnv: Record<string, string | undefined> = {
  NO_COLOR: '1',
  NO_HYPERLINKS: '1',
  FORCE_COLOR: undefined,
  FORCE_HYPERLINKS: undefined,
};

const resolveFixtureRoot = (testCase: TestCase): string =>
  join(fixturesRoot, testCase.reporter, testCase.runtime, testCase.name);

const runBinary = (
  spec: RuntimeSpec,
  fixtureRoot: string,
  extraEnv: Record<string, string | undefined>
): Promise<FixtureRun> =>
  new Promise((resolve, reject) => {
    const child = spawn(spec.command, [...spec.args], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ...spec.env,
        ...extraEnv,
      },
      shell: isWindows,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr, fixtureRoot });
    });
  });

const run = (
  testCase: TestCase,
  extraEnv: Record<string, string | undefined> = Object.create(null)
): Promise<FixtureRun> =>
  runBinary(runtimeSpecs[testCase.runtime], resolveFixtureRoot(testCase), {
    ...baselineEnv,
    ...extraEnv,
  });

export const fixture = {
  run,
} as const;
