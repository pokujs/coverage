import type { CoverageState } from './@types/coverage.js';

const create = (): CoverageState => ({
  enabled: false,
  tempDir: '',
  userProvidedTempDir: false,
  originalEnv: undefined,
  originalNodeOptions: undefined,
  nodeOptionsOverridden: false,
  cwd: '',
  testFiles: new Set(),
});

export const state = { create } as const;
