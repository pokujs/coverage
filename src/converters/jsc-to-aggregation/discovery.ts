import type { JscScriptBlocks } from '../../@types/jsc.js';
import { readFileSync } from 'node:fs';
import { jscBlocks } from '../../utils/jsc-blocks.js';

const parseBlocksFile = (filePath: string): JscScriptBlocks | undefined => {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }

  if (parsed === null || typeof parsed !== 'object') return undefined;

  const candidate = parsed as Partial<JscScriptBlocks>;

  if (typeof candidate.url !== 'string') return undefined;
  if (typeof candidate.scriptId !== 'string') return undefined;
  if (typeof candidate.source !== 'string') return undefined;
  if (!Array.isArray(candidate.blocks)) return undefined;

  return parsed as JscScriptBlocks;
};

export const jscDiscovery = {
  findBlocksFiles: jscBlocks.listFiles,
  parseBlocksFile,
} as const;
