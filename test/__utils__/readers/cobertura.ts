import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { readFileSync } from 'node:fs';
import { coberturaShared } from './shared/cobertura.ts';

const raw = (fixtureRoot: string): string =>
  readFileSync(`${fixtureRoot}/coverage/cobertura-coverage.xml`, 'utf8');

const extract = (fixtureRoot: string): CoverageSnapshot =>
  coberturaShared.parse(raw(fixtureRoot));

export const cobertura = {
  raw,
  extract,
} as const;
