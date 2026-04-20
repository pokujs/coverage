import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const BLOCKS_FILE_SUFFIX = '.jsc.json';

const listFiles = (tempDir: string): string[] => {
  let directoryEntries: string[];
  try {
    directoryEntries = readdirSync(tempDir);
  } catch {
    return [];
  }

  const collected: string[] = [];

  for (const entryName of directoryEntries) {
    const entryPath = join(tempDir, entryName);

    let subEntries: string[];
    try {
      subEntries = readdirSync(entryPath);
    } catch {
      continue;
    }

    for (const subEntry of subEntries) {
      if (!subEntry.endsWith(BLOCKS_FILE_SUFFIX)) continue;

      collected.push(join(entryPath, subEntry));
    }
  }

  return collected;
};

export const jscBlocks = { listFiles } as const;
