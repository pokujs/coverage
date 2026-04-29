import type { PokuPlugin } from 'poku/plugins';
import type { CoverageOptions } from '../@types/coverage.js';
import type { Runtime } from '../@types/reporters.js';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import { bun, config, deno, node, state } from '../core.js';

const runtimes = { node, deno, bun } as const;

export const coverage = (
  options: CoverageOptions = Object.create(null)
): PokuPlugin => {
  const coverageState = state.create();
  let runtime: Runtime | undefined;
  let resolvedOptions: CoverageOptions = options;

  return {
    name: '@pokujs/coverage',

    setup(context) {
      if (options.requireFlag && !process.argv.includes('--coverage')) return;

      runtime = context.runtime;
      coverageState.cwd = context.cwd;

      const cliConfig = process.argv
        .find((arg) => arg.startsWith('--coverageConfig'))
        ?.split('=')[1];

      const fileConfig = config.load(context.cwd, cliConfig ?? options.config);

      resolvedOptions = { ...fileConfig, ...options };

      runtimes[context.runtime].setup(resolvedOptions, coverageState);
    },

    runner(command, file) {
      if (!runtime) return command;

      const absoluteTestFile = isAbsolute(file)
        ? file
        : resolve(coverageState.cwd, file);

      coverageState.testFiles.add(absoluteTestFile);

      return runtimes[runtime].runner(command, file, coverageState);
    },

    onTestProcess(child, file) {
      if (!runtime) return;

      runtimes[runtime].onTestProcess?.(child, file, coverageState);
    },

    teardown(context) {
      runtimes[context.runtime].teardown(
        context,
        resolvedOptions,
        coverageState
      );
    },
  };
};
