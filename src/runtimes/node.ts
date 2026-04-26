import type { PluginContext } from 'poku/plugins';
import type { CoverageOptions, CoverageState } from '../@types/coverage.js';
import { lifecycle } from './lifecycle.js';

const ENV_VAR = 'NODE_V8_COVERAGE';

export const node = {
  setup: (
    _context: PluginContext,
    options: CoverageOptions,
    state: CoverageState
  ): void => lifecycle.setup(options, state, 'node', ENV_VAR),
  runner: (command: string[]): string[] => command,
  onTestProcess: undefined,
  teardown: (
    context: PluginContext,
    options: CoverageOptions,
    state: CoverageState
  ): void => lifecycle.teardown(context, options, state, 'node', ENV_VAR),
} as const;
