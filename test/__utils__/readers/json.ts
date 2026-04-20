import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { paths } from '../paths.ts';
import { jsonShared } from './shared/json.ts';

const raw = (fixtureRoot: string): string =>
  readFileSync(`${fixtureRoot}/coverage/coverage-final.json`, 'utf8');

const extract = (fixtureRoot: string): CoverageSnapshot =>
  jsonShared.parse(paths.normalizeJson(raw(fixtureRoot), fixtureRoot));

export const json = {
  raw,
  extract,
} as const;
