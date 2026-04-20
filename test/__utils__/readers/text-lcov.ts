import type {
  CoverageSnapshot,
  FixtureRun,
} from '../../../src/@types/tests.ts';
import { lcovShared } from './shared/lcov.ts';

const raw = (run: FixtureRun): string => run.stdout;

const extract = async (run: FixtureRun): Promise<CoverageSnapshot> => {
  const parsed = await lcovShared.parse(raw(run));
  return lcovShared.build(parsed, 'text-lcov', run.fixtureRoot);
};

export const textLcov = {
  raw,
  extract,
} as const;
