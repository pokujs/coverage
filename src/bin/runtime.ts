import type { SpawnExitOutcome, SpawnRuntimeInputs } from '../@types/cli.js';
import type { Runtime } from '../@types/reporters.js';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { bun, deno, node } from '../core.js';

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

const runtimes = { node, deno, bun } as const;

const get = (command: readonly string[]): Runtime => {
  const firstToken = command[0] ?? '';
  const baseName =
    firstToken
      .replace(/\.exe$/i, '')
      .split(/[\\/]/)
      .pop() ?? '';

  if (baseName === 'bun' || baseName === 'bunx') return 'bun';
  if (baseName === 'deno') return 'deno';

  return 'node';
};

const run = (inputs: SpawnRuntimeInputs): Promise<SpawnExitOutcome> =>
  new Promise((resolveOutcome) => {
    const userCommand = inputs.command.slice();
    const runtimeAdapter = runtimes[inputs.runtime];
    const finalCommand = runtimeAdapter.runner(userCommand, '', inputs.state);

    if (finalCommand.length === 0) {
      process.stderr.write(
        `coverage: missing command for runtime "${inputs.runtime}"\n`
      );
      resolveOutcome({ code: 1, signal: null });
      return;
    }

    const [binary, ...args] = finalCommand;
    const needsPipedStderr = runtimeAdapter.onTestProcess !== undefined;
    const child = spawn(binary, args, {
      stdio: needsPipedStderr ? ['inherit', 'inherit', 'pipe'] : 'inherit',
      shell: false,
    });

    if (needsPipedStderr && child.stderr) {
      child.stderr.pipe(process.stderr);
    }

    runtimeAdapter.onTestProcess?.(child, '', inputs.state);

    const forwardSignal = (signal: NodeJS.Signals): void => {
      if (!child.killed) child.kill(signal);
    };

    for (const signal of FORWARDED_SIGNALS) process.on(signal, forwardSignal);

    const detachSignals = (): void => {
      for (const signal of FORWARDED_SIGNALS)
        process.off(signal, forwardSignal);
    };

    child.on('error', (error: NodeJS.ErrnoException) => {
      detachSignals();

      if (error.code === 'ENOENT') {
        process.stderr.write(`coverage: command not found: ${binary}\n`);
        resolveOutcome({ code: 127, signal: null });
        return;
      }

      process.stderr.write(
        `coverage: failed to spawn ${binary}: ${error.message}\n`
      );

      resolveOutcome({ code: 1, signal: null });
    });

    child.on('exit', (exitCode, exitSignal) => {
      detachSignals();
      resolveOutcome({ code: exitCode, signal: exitSignal });
    });
  });

export const runtime = { get, run } as const;
