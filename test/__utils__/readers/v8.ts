import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { paths } from '../paths.ts';
import { v8Shared } from './shared/v8.ts';

const raw = (fixtureRoot: string): Map<string, string> => {
  const coverageDir = `${fixtureRoot}/coverage/v8`;
  const accumulator = new Map<string, string>();

  let entries: string[];
  try {
    entries = readdirSync(coverageDir);
  } catch {
    return accumulator;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const rawContent = readFileSync(`${coverageDir}/${entry}`, 'utf8');

    const normalized = paths.normalizeV8(rawContent, fixtureRoot);
    if (normalized === null) continue;

    accumulator.set(entry, normalized);
  }

  return accumulator;
};

const extract = (fixtureRoot: string): CoverageSnapshot =>
  v8Shared.parse(raw(fixtureRoot));

export const v8 = {
  raw,
  extract,
} as const;
