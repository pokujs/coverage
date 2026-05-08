import type { ReporterContext } from '@jest/reporters';
import type {
  RuntimeTransformResult,
  Test,
  TestResult,
  V8CoverageResult,
} from '@jest/test-result';
import type { Config } from '@jest/types';

export type {
  ReporterContext as JestReporterContext,
  RuntimeTransformResult as JestRuntimeTransformResult,
  Test as JestTest,
  TestResult as JestTestResult,
  V8CoverageResult as JestV8CoverageResult,
};

export type JestGlobalConfig = Config.GlobalConfig;

export type JestReporterOptions = Record<string, unknown>;
