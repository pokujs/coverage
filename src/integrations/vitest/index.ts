import type {
  CoverageContext,
  CoverageOptions,
} from '../../@types/coverage.js';
import type { Reporter } from '../../@types/reporters.js';
import type { EncodedSourceMap } from '../../@types/source-map.js';
import type { V8Function, V8Range, V8ScriptCoverage } from '../../@types/v8.js';
import type {
  CoverageProvider,
  CoverageProviderModule,
  IstanbulCoverageMap,
  ReportContext,
  ResolvedCoverageOptions,
  Vite,
  Vitest,
  VitestRawCoverageWithOffsets,
  VitestRuntimeOptions,
  VitestScriptCoverageWithOffset,
  VitestTakeCoverageOptions,
  VitestWorkerState,
} from '../../@types/vitest.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import inspector from 'node:inspector/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { BaseCoverageProvider as BaseProvider } from 'vitest/node';
import { config, lifecycle, state, vitestrc } from '../../core.js';
import { traceMap } from '../../utils/source-map/index.js';
import { sourceMapTrim } from '../../utils/source-map/trim.js';

const WORKER_STATE_KEY = '__pokujsCoverageVitestWorker__';
const NO_OP_DEBUG: ((..._logs: unknown[]) => void) & { enabled: false } =
  Object.assign((..._logs: unknown[]) => undefined, {
    enabled: false as const,
  });

const getWorkerState = (): VitestWorkerState => {
  const root = globalThis as Record<string, unknown>;
  let container = root[WORKER_STATE_KEY] as VitestWorkerState | undefined;

  if (!container) {
    container = { session: null, enabled: false };
    root[WORKER_STATE_KEY] = container;
  }

  return container;
};

const workerOnly = (entry: V8ScriptCoverage): boolean => {
  if (!entry.url.startsWith('file://')) return false;
  if (entry.url.includes('/node_modules/')) return false;
  if (entry.url.includes('/@id/@vitest/')) return false;
  if (entry.url.includes('/@vite/client')) return false;
  if (entry.url.includes('__vitest__')) return false;
  return true;
};

const stripQuery = (url: string): string => {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
};

const computeLineLengths = (code: string): number[] => {
  const lengths: number[] = [];
  let lineStart = 0;

  for (let charIndex = 0; charIndex < code.length; charIndex++) {
    if (code.charCodeAt(charIndex) === 10) {
      lengths.push(charIndex - lineStart);

      lineStart = charIndex + 1;
    }
  }

  lengths.push(code.length - lineStart);
  return lengths;
};

const shiftFunctions = (
  functions: V8Function[],
  wrapperLength: number
): V8Function[] => {
  const adjustedFunctions: V8Function[] = [];

  for (const scriptFunction of functions) {
    const adjustedRanges: V8Range[] = [];

    for (const functionRange of scriptFunction.ranges) {
      const adjustedStart = Math.max(
        0,
        functionRange.startOffset - wrapperLength
      );
      const adjustedEnd = Math.max(0, functionRange.endOffset - wrapperLength);

      if (adjustedEnd <= adjustedStart) continue;

      adjustedRanges.push({
        startOffset: adjustedStart,
        endOffset: adjustedEnd,
        count: functionRange.count,
      });
    }

    if (adjustedRanges.length === 0) continue;

    adjustedFunctions.push({
      functionName: scriptFunction.functionName,
      isBlockCoverage: scriptFunction.isBlockCoverage,
      ranges: adjustedRanges,
    });
  }

  return adjustedFunctions;
};

const findTargetSourceIndex = (
  map: EncodedSourceMap,
  filePath: string,
  mapUrl: string
): number => {
  const resolver = traceMap.create(map, mapUrl);
  const fileUrl = mapUrl.startsWith('file://') ? fileURLToPath(mapUrl) : mapUrl;

  for (
    let sourceIndex = 0;
    sourceIndex < resolver.resolvedSources.length;
    sourceIndex++
  ) {
    const resolvedSource = resolver.resolvedSources[sourceIndex];

    if (resolvedSource === filePath) return sourceIndex;
    if (resolvedSource === fileUrl) return sourceIndex;
  }

  return -1;
};

class PokuCoverageProvider extends BaseProvider implements CoverageProvider {
  readonly name = 'v8' as const;
  private coverageState = state.create();
  private envelopeCounter = 0;
  private resolvedOptions: CoverageOptions = Object.create(null);

  version = '';

  initialize(ctx: Vitest): void {
    this.version = ctx.version;

    // Overrides `'v8' | 'istanbul'`;
    Object.defineProperty(this, 'name', {
      value: '@pokujs/coverage',
      enumerable: true,
      configurable: true,
      writable: false,
    });

    this._initialize(ctx);

    this.coverageState.cwd = ctx.config.root;
    this.coverageState.enabled = true;

    const cliConfig = process.argv
      .find((arg) => arg.startsWith('--coverageConfig'))
      ?.split('=')[1];
    const vitestOptions = vitestrc.extract(this.options);
    const fileConfig = config.load(ctx.config.root, cliConfig);
    const merged: CoverageOptions = { ...vitestOptions, ...fileConfig };
    const reporterList: Reporter[] = Array.isArray(merged.reporter)
      ? merged.reporter
      : merged.reporter !== undefined
        ? [merged.reporter]
        : [];
    const keptReporters = reporterList.filter(
      (reporter) => reporter !== 'v8' && reporter !== 'jsc'
    );

    this.resolvedOptions = { ...merged, reporter: keptReporters };
  }

  resolveOptions(): ResolvedCoverageOptions {
    return { ...this.options, provider: 'custom' };
  }

  createCoverageMap(): IstanbulCoverageMap {
    return Object.create(null);
  }

  async generateCoverage(_reportContext: ReportContext): Promise<unknown> {
    const envelopeDir = join(this.coverageFilesDirectory, 'pokujs');
    const collected: VitestScriptCoverageWithOffset[] = [];
    let resolvedProject: BaseProvider['ctx']['projects'][number] | undefined;

    mkdirSync(envelopeDir, { recursive: true });

    this.coverageState.tempDir = envelopeDir;
    this.coverageState.userProvidedTempDir = false;

    await this.readCoverageFiles<VitestRawCoverageWithOffsets>({
      onFileRead: (rawCoverage) => {
        if (!Array.isArray(rawCoverage?.result)) return;

        for (const entry of rawCoverage.result) collected.push(entry);
      },
      onFinished: async (project, environment) => {
        if (resolvedProject === undefined || environment === 'ssr')
          resolvedProject = project;
      },
      onDebug: NO_OP_DEBUG,
    });

    const project = resolvedProject ?? this.ctx.getRootProject();
    const viteEnvironment = project.vite.environments.ssr;
    if (!viteEnvironment)
      throw new Error(
        '@pokujs/coverage: SSR environment not available on the resolved Vite project'
      );

    for (const entry of collected) {
      const cleanUrl = stripQuery(entry.url);
      if (!cleanUrl.startsWith('file://')) continue;

      const filePath = fileURLToPath(cleanUrl);
      let transform: Vite.TransformResult | null = null;

      try {
        transform = await viteEnvironment.transformRequest(filePath);
      } catch {
        transform = null;
      }

      if (!transform?.code) continue;
      if (!transform.map || typeof transform.map !== 'object') continue;

      const rawMap = transform.map as Partial<EncodedSourceMap>;
      if (typeof rawMap.mappings !== 'string') continue;
      if (!Array.isArray(rawMap.sources)) continue;

      const fullMap: EncodedSourceMap = {
        version: 3,
        names: rawMap.names ?? [],
        sources: rawMap.sources,
        sourcesContent: rawMap.sourcesContent,
        mappings: rawMap.mappings,
        ...(rawMap.file !== undefined
          ? { file: rawMap.file }
          : Object.create(null)),
        ...(rawMap.sourceRoot !== undefined
          ? { sourceRoot: rawMap.sourceRoot }
          : Object.create(null)),
        ...(rawMap.ignoreList !== undefined
          ? { ignoreList: rawMap.ignoreList }
          : Object.create(null)),
      };

      const targetIndex = findTargetSourceIndex(fullMap, filePath, entry.url);
      if (targetIndex === -1) continue;

      const trimmedMap = sourceMapTrim.keepOnly(fullMap, targetIndex);

      trimmedMap.sources = [filePath];

      if (
        !Array.isArray(trimmedMap.sourcesContent) ||
        typeof trimmedMap.sourcesContent[0] !== 'string'
      ) {
        try {
          trimmedMap.sourcesContent = [readFileSync(filePath, 'utf8')];
        } catch {
          continue;
        }
      }

      const lineLengths = computeLineLengths(transform.code);

      const adjustedScript: V8ScriptCoverage = {
        scriptId: entry.scriptId,
        url: entry.url,
        functions:
          entry.startOffset > 0
            ? shiftFunctions(entry.functions, entry.startOffset)
            : entry.functions,
      };

      const envelope = {
        result: [adjustedScript],
        'source-map-cache': {
          [entry.url]: { data: trimmedMap, lineLengths },
        },
      };

      const envelopePath = join(
        envelopeDir,
        `pokujs-envelope-${this.envelopeCounter++}.json`
      );

      writeFileSync(envelopePath, JSON.stringify(envelope));
    }

    return Object.create(null);
  }

  async generateReports(_coverageMap: unknown): Promise<void> {
    const optionsForTeardown: CoverageOptions = {
      ...this.resolvedOptions,
      clean: false,
      tempDirectory: undefined,
    };

    const context: CoverageContext = {
      cwd: this.ctx.config.root,
      runtime: 'node',
    };

    lifecycle.teardown(context, optionsForTeardown, this.coverageState, 'node');
  }
}

const startCoverage = async (
  runtimeOptions: VitestRuntimeOptions
): Promise<void> => {
  const workerState = getWorkerState();

  if (runtimeOptions.isolate === false && workerState.enabled) return;

  workerState.enabled = true;
  workerState.session ||= new inspector.Session();

  workerState.session.connect();
  await workerState.session.post('Profiler.enable');
  await workerState.session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  });
};

const takeCoverage = async (
  options?: VitestTakeCoverageOptions
): Promise<VitestRawCoverageWithOffsets> => {
  const workerState = getWorkerState();
  if (!workerState.session) return { result: [] };

  const response = await workerState.session.post(
    'Profiler.takePreciseCoverage'
  );
  const scripts = response.result as V8ScriptCoverage[];
  const filtered: VitestScriptCoverageWithOffset[] = [];

  for (const entry of scripts) {
    if (!workerOnly(entry)) continue;

    let startOffset = 0;

    if (options?.moduleExecutionInfo && entry.url.startsWith('file://')) {
      try {
        const filePath = fileURLToPath(stripQuery(entry.url));
        const executionEntry = options.moduleExecutionInfo.get(filePath);

        if (executionEntry) startOffset = executionEntry.startOffset;
      } catch {
        startOffset = 0;
      }
    }

    filtered.push({ ...entry, startOffset });
  }

  return { result: filtered };
};

const stopCoverage = async (
  runtimeOptions: VitestRuntimeOptions
): Promise<void> => {
  if (runtimeOptions.isolate === false) return;

  const workerState = getWorkerState();
  if (!workerState.session) return;

  await workerState.session.post('Profiler.stopPreciseCoverage');
  await workerState.session.post('Profiler.disable');
  workerState.session.disconnect();

  workerState.session = null;
  workerState.enabled = false;
};

const getProvider = (): CoverageProvider => new PokuCoverageProvider();

const vitestModule: CoverageProviderModule = {
  startCoverage,
  takeCoverage,
  stopCoverage,
  getProvider,
};

export default vitestModule;
