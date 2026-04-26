import { discoverBranches } from './discover-branches.js';
import { jscToIstanbul } from './jsc-to-istanbul.js';
import { v8ToIstanbul } from './v8-to-istanbul/index.js';

export const converters = {
  v8ToIstanbul,
  discoverBranches,
  jscToIstanbul,
} as const;
