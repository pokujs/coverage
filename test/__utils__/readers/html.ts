import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { posix, relative, sep } from 'node:path';
import { paths } from '../paths.ts';
import { htmlShared } from './shared/html.ts';

const collectHtmlFiles = (
  directory: string,
  coverageRoot: string,
  accumulator: Map<string, string>,
  normalize: (content: string) => string
): void => {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      collectHtmlFiles(absolutePath, coverageRoot, accumulator, normalize);
      continue;
    }

    if (!entry.name.endsWith('.html')) continue;

    const relativePath = relative(coverageRoot, absolutePath)
      .split(sep)
      .join(posix.sep);

    accumulator.set(
      relativePath,
      normalize(readFileSync(absolutePath, 'utf8'))
    );
  }
};

const resolveCoverageRoot = (fixtureRoot: string, subdir: string): string =>
  subdir === ''
    ? `${fixtureRoot}/coverage`
    : `${fixtureRoot}/coverage/${subdir}`;

const passthrough = (content: string): string => content;

const raw = (fixtureRoot: string, subdir = ''): Map<string, string> => {
  const coverageRoot = resolveCoverageRoot(fixtureRoot, subdir);
  const accumulator = new Map<string, string>();

  collectHtmlFiles(coverageRoot, coverageRoot, accumulator, passthrough);

  return accumulator;
};

const read = (fixtureRoot: string, subdir = ''): Map<string, string> => {
  const coverageRoot = resolveCoverageRoot(fixtureRoot, subdir);
  const accumulator = new Map<string, string>();

  collectHtmlFiles(
    coverageRoot,
    coverageRoot,
    accumulator,
    paths.normalizeHtml
  );

  return accumulator;
};

const extract = (fixtureRoot: string, subdir = ''): CoverageSnapshot =>
  htmlShared.parse(raw(fixtureRoot, subdir));

export const html = {
  raw,
  read,
  extract,
} as const;
