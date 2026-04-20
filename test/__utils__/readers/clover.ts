import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { cloverShared } from './shared/clover.ts';

const raw = (fixtureRoot: string): string =>
  readFileSync(`${fixtureRoot}/coverage/clover.xml`, 'utf8');

const extract = (fixtureRoot: string): CoverageSnapshot =>
  cloverShared.parse(raw(fixtureRoot));

export const clover = {
  raw,
  extract,
} as const;
