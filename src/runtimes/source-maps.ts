import type { CoverageState } from '../@types/coverage.js';
import process from 'node:process';

const FLAG = '--enable-source-maps';

const enable = (state: CoverageState): void => {
  const existing = process.env.NODE_OPTIONS;

  state.originalNodeOptions = existing;
  state.nodeOptionsOverridden = true;

  if (existing === undefined || existing.length === 0) {
    process.env.NODE_OPTIONS = FLAG;
    return;
  }

  if (existing.includes(FLAG)) {
    state.nodeOptionsOverridden = false;
    return;
  }

  process.env.NODE_OPTIONS = `${existing} ${FLAG}`;
};

const restore = (state: CoverageState): void => {
  if (!state.nodeOptionsOverridden) return;

  if (state.originalNodeOptions === undefined) delete process.env.NODE_OPTIONS;
  else process.env.NODE_OPTIONS = state.originalNodeOptions;
};

export const sourceMaps = { enable, restore } as const;
