import type { DiscoveredBranch } from '../@types/branch-discovery.js';
import type {
  CoverageContext,
  CoverageOptions,
  CoverageState,
} from '../@types/coverage.js';
import type { CoverageMap } from '../@types/istanbul.js';
import type { ReporterContext, Runtime } from '../@types/reporters.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { checkCoverage } from '../check-coverage.js';
import { converters } from '../converters/index.js';
import { discoveryMerge } from '../converters/shared/discovery-merge.js';
import { fileFilter } from '../file-filter.js';
import { reporters } from '../reporters/index.js';
import { fileCoverage } from '../reporters/shared/file-coverage.js';
import { watermarks } from '../watermarks.js';
import { sourceMaps } from './source-maps.js';

const setup = (
  options: CoverageOptions,
  state: CoverageState,
  runtime: Runtime,
  envVar?: string
): void => {
  if (options.requireFlag && !process.argv.includes('--coverage')) return;

  if (options.tempDirectory) {
    mkdirSync(options.tempDirectory, { recursive: true });
    state.tempDir = options.tempDirectory;
    state.userProvidedTempDir = true;
  } else {
    state.tempDir = mkdtempSync(join(tmpdir(), `poku-coverage-${runtime}-`));
    state.userProvidedTempDir = false;
  }

  if (envVar) {
    state.originalEnv = process.env[envVar];
    process.env[envVar] = state.tempDir;
  }

  if (runtime === 'node') sourceMaps.enable(state);

  state.enabled = true;
};

const teardown = (
  context: CoverageContext,
  options: CoverageOptions,
  state: CoverageState,
  runtime: Runtime,
  envVar?: string
): void => {
  if (!state.enabled) return;

  if (envVar) {
    if (state.originalEnv === undefined) delete process.env[envVar];
    else process.env[envVar] = state.originalEnv;
  }

  if (runtime === 'node') sourceMaps.restore(state);

  try {
    const reporterList = reporters.normalize(options.reporter, runtime);

    const reportsDir = resolve(
      context.cwd,
      options.reportsDirectory ?? 'coverage'
    );

    const userFilter = fileFilter.resolve({
      include: options.include,
      exclude: options.exclude,
    });

    const emptyFilter = fileFilter.resolve({ include: [], exclude: [] });
    const excludeAfterRemap = options.excludeAfterRemap ?? true;
    const runtimeAppliesRemap = runtime !== 'bun';
    const shouldFilterBeforeRemap = runtimeAppliesRemap && !excludeAfterRemap;
    const emptyDiscoveries: ReadonlyMap<string, readonly DiscoveredBranch[]> =
      new Map();

    let cachedCoverageMap: CoverageMap | null | undefined;

    const reporterContext: ReporterContext = {
      runtime,
      tempDir: state.tempDir,
      cwd: context.cwd,
      reportsDir,
      testFiles: state.testFiles,
      options,
      watermarks: watermarks.normalize(options.watermarks),
      fileFilter: shouldFilterBeforeRemap ? emptyFilter : userFilter,
      preRemapFilter: shouldFilterBeforeRemap ? userFilter : emptyFilter,
      userFilter,
      produceCoverageMap: () => null,
    };

    reporterContext.produceCoverageMap = () => {
      if (cachedCoverageMap !== undefined) return cachedCoverageMap;

      const coverageMap =
        runtime === 'bun'
          ? converters.jscToIstanbul.convert(
              state.tempDir,
              context.cwd,
              reporterContext.preRemapFilter
            )
          : converters.v8ToIstanbul.convert(
              state.tempDir,
              context.cwd,
              runtime,
              reporterContext.preRemapFilter
            );

      fileCoverage.prepareCoverageMap(coverageMap, reporterContext);

      const discoveries =
        runtime === 'bun'
          ? emptyDiscoveries
          : converters.discoverBranches.run(
              state.tempDir,
              context.cwd,
              runtime,
              reporterContext.preRemapFilter
            );
      discoveryMerge.apply(coverageMap, discoveries);

      cachedCoverageMap = coverageMap;

      return coverageMap;
    };

    if (reporterList.length > 0) reporters.run(reporterList, reporterContext);
    checkCoverage.run(reporterContext);
  } finally {
    const shouldClean = options.clean ?? !state.userProvidedTempDir;
    if (shouldClean) rmSync(state.tempDir, { recursive: true, force: true });
  }
};

export const lifecycle = { setup, teardown } as const;
