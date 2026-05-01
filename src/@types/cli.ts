import type { CoverageOptions, CoverageState } from './coverage.js';
import type { Runtime } from './reporters.js';

export type SpawnExitOutcome = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type SpawnRuntimeInputs = {
  runtime: Runtime;
  command: readonly string[];
  cwd: string;
  options: CoverageOptions;
  state: CoverageState;
};
