import { existsSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../../utils/paths.js';

const findJsonFiles = (tempDir: string): string[] => {
  let entries: string[];

  try {
    entries = readdirSync(tempDir);
  } catch {
    return [];
  }

  return entries
    .filter((entryName) => entryName.endsWith('.json'))
    .map((entryName) => join(tempDir, entryName));
};

const resolveFilePath = (url: string, cwd: string): string | undefined => {
  if (!url.startsWith('file://')) return undefined;

  let absolutePath: string;

  try {
    absolutePath = fileURLToPath(url);
  } catch {
    return undefined;
  }

  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;

  if (!absolutePath.startsWith(cwdPrefix)) return undefined;
  if (paths.isBanned(absolutePath)) return undefined;
  if (!existsSync(absolutePath)) return undefined;
  return absolutePath;
};

export const v8Discovery = {
  findJsonFiles,
  resolveFilePath,
} as const;
