import type { Report } from '../../@types/reporters.js';
import { lcov } from '../shared/lcov/index.js';
import { writeLcovFile } from './writer.js';

const report: Report = (context) => {
  writeLcovFile(
    context.reportsDir,
    lcov.runtimes[context.runtime].produce(context)
  );
};

export const lcovonly = { report } as const;
