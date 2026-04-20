import type { ChildProcess } from 'node:child_process';
import type { PluginContext } from 'poku/plugins';
import type { CoverageOptions, CoverageState } from '../@types/coverage.js';
import type { JscInspectorHandle } from '../@types/jsc.js';
import type { DataListener } from '../@types/runtimes.js';
import { escapeRegex } from '../utils/strings.js';
import { jscInspector } from './bun/inspector.js';
import { setup, teardown } from './lifecycle.js';

const INSPECTOR_URL_PATTERN = /ws:\/\/[A-Za-z0-9.:_/-]+/;

const makeLineFilter = (
  file: string,
  downstream: DataListener[]
): DataListener => {
  const fileHeader = new RegExp(`^${escapeRegex(file)}:$`);
  let buffer = '';

  const emit = (text: string): void => {
    for (const listener of downstream) listener(text);
  };

  return (chunk: Buffer | string): void => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');

    let newlineIndex: number;
    let flushed = '';

    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      const trimmed = line.trim();
      const isNoise = fileHeader.test(trimmed);

      if (!isNoise) flushed += `${line}\n`;
    }

    if (flushed.length > 0) emit(flushed);
  };
};

const makeInspectorAttacher = (
  file: string,
  state: CoverageState,
  onAttached: (handle: JscInspectorHandle) => void
): DataListener => {
  let buffer = '';
  let attached = false;

  return (chunk: Buffer | string): void => {
    if (attached) return;

    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');

    const match = buffer.match(INSPECTOR_URL_PATTERN);
    if (!match) return;

    attached = true;

    const handle = jscInspector.attach({
      inspectorUrl: match[0],
      tempDir: state.tempDir,
      testFile: file,
      cwd: state.cwd,
    });

    onAttached(handle);
  };
};

const onTestProcess = (
  child: ChildProcess,
  file: string,
  state: CoverageState
): void => {
  if (!state.enabled) return;

  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;

    const originals = stream.listeners('data') as DataListener[];
    if (originals.length === 0) continue;

    stream.removeAllListeners('data');
    stream.on('data', makeLineFilter(file, originals));
  }

  if (!child.stderr) return;

  let inspectorHandle: JscInspectorHandle | null = null;

  child.stderr.on(
    'data',
    makeInspectorAttacher(file, state, (handle) => {
      inspectorHandle = handle;
    })
  );

  child.on('exit', () => {
    if (inspectorHandle) inspectorHandle.close();
  });
};

const runner = (
  command: string[],
  file: string,
  state: CoverageState
): string[] => {
  if (!state.enabled) return command;

  const [binary, ...rest] = command;
  const passthrough = rest.filter((arg) => arg !== file);
  const resolvedBinary = binary ?? 'bun';

  return [resolvedBinary, '--inspect-wait=127.0.0.1:0', ...passthrough, file];
};

export const bun = {
  setup: (
    _context: PluginContext,
    options: CoverageOptions,
    state: CoverageState
  ): void => {
    setup(options, state, 'bun');
  },
  runner,
  onTestProcess,
  teardown: (
    context: PluginContext,
    options: CoverageOptions,
    state: CoverageState
  ): void => teardown(context, options, state, 'bun'),
} as const;
