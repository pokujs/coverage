import type { PluginContext } from 'poku/plugins';
import type { DiscoveredBranch } from '../@types/branch-discovery.js';
import type { CoverageOptions, CoverageState } from '../@types/coverage.js';
import type { CoverageMap } from '../@types/istanbul.js';
import type { ReporterContext, Runtime } from '../@types/reporters.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { checkCoverage } from '../check-coverage.js';
import { converters } from '../converters/index.js';
import { fileFilter } from '../file-filter.js';
import { reporters } from '../reporters/index.js';
import { prepareCoverageMap } from '../reporters/shared/file-coverage.js';
import { watermarks } from '../watermarks.js';

const ensureSourceMaps = (state: CoverageState): void => {
  const ENABLE_SOURCE_MAPS_FLAG = '--enable-source-maps';
  const existingNodeOptions = process.env.NODE_OPTIONS;

  state.originalNodeOptions = existingNodeOptions;
  state.nodeOptionsOverridden = true;

  if (existingNodeOptions === undefined || existingNodeOptions.length === 0) {
    process.env.NODE_OPTIONS = ENABLE_SOURCE_MAPS_FLAG;
    return;
  }

  if (existingNodeOptions.includes(ENABLE_SOURCE_MAPS_FLAG)) {
    state.nodeOptionsOverridden = false;
    return;
  }

  process.env.NODE_OPTIONS = `${existingNodeOptions} ${ENABLE_SOURCE_MAPS_FLAG}`;
};

export const setup = (
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

  if (runtime === 'node') ensureSourceMaps(state);

  state.enabled = true;
};

export const teardown = (
  context: PluginContext,
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

  if (state.nodeOptionsOverridden) {
    if (state.originalNodeOptions === undefined) {
      delete process.env.NODE_OPTIONS;
    } else {
      process.env.NODE_OPTIONS = state.originalNodeOptions;
    }
  }

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
    let cachedBranchDiscoveries:
      | ReadonlyMap<string, readonly DiscoveredBranch[]>
      | undefined;

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
      produceBranchDiscoveries: () => emptyDiscoveries,
    };

    reporterContext.produceCoverageMap = () => {
      if (cachedCoverageMap !== undefined) return cachedCoverageMap;

      const coverageMap =
        runtime === 'bun'
          ? converters.jscToIstanbul(
              state.tempDir,
              context.cwd,
              reporterContext.preRemapFilter
            )
          : converters.v8ToIstanbul(
              state.tempDir,
              context.cwd,
              reporterContext.preRemapFilter
            );

      prepareCoverageMap(coverageMap, reporterContext);

      cachedCoverageMap = coverageMap;

      return coverageMap;
    };

    reporterContext.produceBranchDiscoveries = () => {
      if (cachedBranchDiscoveries !== undefined) return cachedBranchDiscoveries;

      cachedBranchDiscoveries =
        runtime === 'bun'
          ? emptyDiscoveries
          : converters.discoverBranches(
              state.tempDir,
              context.cwd,
              reporterContext.preRemapFilter
            );

      return cachedBranchDiscoveries;
    };

    if (reporterList.length > 0) reporters.run(reporterList, reporterContext);
    checkCoverage.run(reporterContext);
  } finally {
    const shouldClean = options.clean ?? !state.userProvidedTempDir;
    if (shouldClean) rmSync(state.tempDir, { recursive: true, force: true });
  }
};
