import type { CoverageOptions } from './coverage.js';

export type NycrcMap = {
  'reports-dir': CoverageOptions['reportsDirectory'];
  'report-dir': CoverageOptions['reportsDirectory'];
  'temp-directory': CoverageOptions['tempDirectory'];
  'check-coverage': CoverageOptions['checkCoverage'];
  'per-file': boolean;
  'skip-full': CoverageOptions['skipFull'];
  'exclude-after-remap': CoverageOptions['excludeAfterRemap'];
  '100': boolean;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
};

export type NycrcRaw = Partial<CoverageOptions> & Partial<NycrcMap>;
