import type {
  HtmlRuntimeHandler,
  Runtime,
} from '../../../../@types/reporters.js';
import { bun } from './bun.js';
import { deno } from './deno.js';
import { node } from './node.js';

export const htmlRuntimes: Record<Runtime, HtmlRuntimeHandler> = {
  node,
  deno,
  bun,
};
