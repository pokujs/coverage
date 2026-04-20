import type { ReporterName } from '../../../src/@types/reporters.js';
import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { lcovShared } from './shared/lcov.ts';

const raw = (fixtureRoot: string): string =>
  readFileSync(`${fixtureRoot}/coverage/lcov.info`, 'utf8');

const extract = async (
  fixtureRoot: string,
  reporter: ReporterName = 'lcov'
): Promise<CoverageSnapshot> => {
  const parsed = await lcovShared.parse(raw(fixtureRoot));
  return lcovShared.build(parsed, reporter, fixtureRoot);
};

export const lcov = {
  raw,
  extract,
} as const;
