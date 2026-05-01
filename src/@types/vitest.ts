import type {
  BaseCoverageProvider,
  CoverageProvider,
  CoverageProviderModule,
  ReportContext,
  ResolvedCoverageOptions,
  Vite,
  Vitest,
} from 'vitest/node';
import type { V8ScriptCoverage } from './v8.js';

export type {
  BaseCoverageProvider,
  CoverageProvider,
  CoverageProviderModule,
  ReportContext,
  ResolvedCoverageOptions,
  Vite,
  Vitest,
};

export type IstanbulCoverageMap = ReturnType<
  BaseCoverageProvider['createCoverageMap']
>;

export type VitestThresholds = {
  100?: boolean;
  perFile?: boolean;
  statements?: number;
  functions?: number;
  branches?: number;
  lines?: number;
};

export type VitestRuntimeOptions = {
  isolate: boolean;
};

export type VitestWorkerState = {
  session: import('node:inspector/promises').Session | null;
  enabled: boolean;
};

export type VitestModuleExecutionEntry = {
  startOffset: number;
};

export type VitestModuleExecutionInfo = Map<string, VitestModuleExecutionEntry>;

export type VitestTakeCoverageOptions = {
  moduleExecutionInfo?: VitestModuleExecutionInfo;
};

export type VitestScriptCoverageWithOffset = V8ScriptCoverage & {
  startOffset: number;
};

export type VitestRawCoverageWithOffsets = {
  result: VitestScriptCoverageWithOffset[];
};
