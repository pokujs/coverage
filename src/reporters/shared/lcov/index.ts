import { filter } from './filter.js';
import { parse } from './parse.js';
import { bun } from './runtimes/bun.js';
import { deno } from './runtimes/deno.js';
import { node } from './runtimes/node.js';

const runtimes = { node, deno, bun } as const;

export const lcov = {
  parse,
  filter,
  runtimes,
} as const;
