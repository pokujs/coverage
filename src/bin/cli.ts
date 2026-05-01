import type { SpawnExitOutcome } from '../@types/cli.js';
import process from 'node:process';
import { bun, config, deno, node, state } from '../core.js';
import { runtime } from './runtime.js';

const runtimes = { node, deno, bun } as const;

const run = async (command: readonly string[]): Promise<void> => {
  if (command.length === 0) {
    process.stderr.write('coverage: missing command.\n');
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const detectedRuntime = runtime.get(command);

  const cliConfig = process.argv
    .find((argument) => argument.startsWith('--coverageConfig'))
    ?.split('=')[1];
  const options = config.load(cwd, cliConfig);

  const coverageState = state.create();
  coverageState.cwd = cwd;

  runtimes[detectedRuntime].setup(options, coverageState);

  let exitOutcome: SpawnExitOutcome = { code: 0, signal: null };

  try {
    exitOutcome = await runtime.run({
      runtime: detectedRuntime,
      command,
      cwd,
      options,
      state: coverageState,
    });
  } finally {
    runtimes[detectedRuntime].teardown(
      { cwd, runtime: detectedRuntime },
      options,
      coverageState
    );
  }

  if (exitOutcome.signal) {
    process.kill(process.pid, exitOutcome.signal);
    return;
  }

  if (exitOutcome.code !== null && exitOutcome.code !== 0) {
    process.exitCode = exitOutcome.code;
    return;
  }
};

void run(process.argv.slice(2));
