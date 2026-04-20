import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jscBlocks } from '../../utils/jsc-blocks.js';

export const copyJscBlocksTo = (tempDir: string, reportsDir: string): void => {
  const collected = jscBlocks.listFiles(tempDir);
  if (collected.length === 0) return;

  const targetDir = join(reportsDir, 'jsc');

  mkdirSync(targetDir, { recursive: true });

  for (const source of collected) {
    const fileName = source.split('/').pop() ?? 'unnamed.jsc.json';

    copyFileSync(source, join(targetDir, fileName));
  }
};
