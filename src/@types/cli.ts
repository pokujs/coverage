import type { PokuPlugin } from 'poku/plugins';
import type { Runtime } from './reporters.js';

export type SpawnExitOutcome = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type SpawnRuntimeInputs = {
  runtime: Runtime;
  command: readonly string[];
  plugin: PokuPlugin;
};

export type PluginContextMockInputs = {
  runtime: Runtime;
  cwd: string;
};
