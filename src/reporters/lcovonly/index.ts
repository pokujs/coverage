import type { Report } from '../../@types/reporters.js';
import { filter } from './filter.js';
import { parse } from './parse.js';
import { bun } from './runtimes/bun.js';
import { deno } from './runtimes/deno.js';
import { node } from './runtimes/node.js';

const runtimes = { node, deno, bun } as const;

const report: Report = (context) => runtimes[context.runtime].run(context);

export const lcovonly = {
  parse,
  filter,
  runtimes,
  report,
} as const;
