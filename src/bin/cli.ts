import type { SpawnExitOutcome } from '../@types/cli.js';
import process from 'node:process';
import { coverage } from '../index.js';
import { pluginContextMock } from './plugin-context-mock.js';
import { runtime } from './runtime.js';

const run = async (command: readonly string[]): Promise<void> => {
  if (command.length === 0) {
    process.stderr.write('coverage: missing command.\n');
    process.exitCode = 1;
    return;
  }

  let exitOutcome: SpawnExitOutcome = {
    code: 0,
    signal: null,
  };

  const cwd = process.cwd();
  const detectedRuntime = runtime.get(command);
  const plugin = coverage();
  const context = pluginContextMock.create({
    runtime: detectedRuntime,
    cwd,
  });

  await plugin.setup?.(context);

  try {
    exitOutcome = await runtime.run({
      runtime: detectedRuntime,
      command,
      plugin,
    });
  } finally {
    await plugin.teardown?.(context);
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
