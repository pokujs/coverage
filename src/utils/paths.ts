import { isAbsolute, relative, sep } from 'node:path';

const BANNED_SEGMENTS = [`${sep}node_modules${sep}`, `${sep}.git${sep}`];

const isBanned = (absolutePath: string): boolean => {
  for (const segment of BANNED_SEGMENTS)
    if (absolutePath.includes(segment)) return true;

  return false;
};

const relativize = (file: string, cwd: string): string => {
  if (!isAbsolute(file)) return file;

  const relativePath = relative(cwd, file);

  if (relativePath.length === 0) return file;
  return relativePath.startsWith('..') ? file : relativePath;
};

const toPosix = (path: string): string =>
  sep === '/' ? path : path.split(sep).join('/');

export const paths = { isBanned, relativize, toPosix } as const;
