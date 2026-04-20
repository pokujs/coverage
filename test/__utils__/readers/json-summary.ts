import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { paths } from '../paths.ts';
import { jsonSummaryShared } from './shared/json-summary.ts';

const raw = (fixtureRoot: string): string =>
  readFileSync(`${fixtureRoot}/coverage/coverage-summary.json`, 'utf8');

const extract = (fixtureRoot: string): CoverageSnapshot =>
  jsonSummaryShared.parse(
    paths.normalizeJsonSummary(raw(fixtureRoot), fixtureRoot)
  );

export const jsonSummary = {
  raw,
  extract,
} as const;
