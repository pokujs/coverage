import type { Runtime } from '../../@types/reporters.js';
import type {
  V8NodefiedDocument,
  V8NodefiedScript,
} from '../../@types/v8-nodefy.js';
import { readFileSync } from 'node:fs';
import { v8Discovery } from '../shared/v8-discovery.js';
import { nodefyDeno } from './deno.js';
import { nodefyNode } from './node.js';

const parserFor = (
  runtime: Runtime
): ((content: string) => V8NodefiedScript[]) => {
  if (runtime === 'deno') return nodefyDeno.parse;
  return nodefyNode.parse;
};

const load = (tempDir: string, runtime: Runtime): V8NodefiedDocument => {
  const jsonFiles = v8Discovery.findJsonFiles(tempDir);
  const parse = parserFor(runtime);
  const scripts: V8NodefiedScript[] = [];

  for (const jsonPath of jsonFiles) {
    let content: string;

    try {
      content = readFileSync(jsonPath, 'utf8');
    } catch {
      continue;
    }

    for (const nodefied of parse(content)) scripts.push(nodefied);
  }

  return { scripts };
};

export const nodefy = { load } as const;
