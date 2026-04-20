import type { CoverageSnapshot } from '../../../src/@types/tests.ts';
import { html } from './html.ts';
import { htmlSpaShared } from './shared/html-spa.ts';

const extract = (fixtureRoot: string): CoverageSnapshot =>
  htmlSpaShared.parse(html.raw(fixtureRoot));

export const htmlSpa = {
  extract,
} as const;
