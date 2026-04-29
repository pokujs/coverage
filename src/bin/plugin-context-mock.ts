import type { PluginContext, ReporterPlugin } from 'poku/plugins';
import type { PluginContextMockInputs } from '../@types/cli.js';

const create = ({ runtime, cwd }: PluginContextMockInputs): PluginContext => {
  const now = new Date();

  return {
    configs: Object.create(null),
    runtime,
    cwd,
    configFile: undefined,
    runAsOnly: false,
    results: { passed: 0, failed: 0, skipped: 0, todo: 0 },
    timespan: { started: now, finished: now, duration: 0 },
    reporter: Object.create(null) as ReturnType<ReporterPlugin>,
  };
};

export const pluginContextMock = { create } as const;
