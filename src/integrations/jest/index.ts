import type {
  CoverageContext,
  CoverageOptions,
  CoverageState,
} from '../../@types/coverage.js';
import type {
  JestGlobalConfig,
  JestReporterContext,
  JestReporterOptions,
  JestTest,
  JestTestResult,
} from '../../@types/jest.js';
import type { V8ScriptCoverage } from '../../@types/v8.js';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { config, lifecycle, state } from '../../core.js';
import { lineLengths } from '../shared/line-lengths.js';
import { tsCompilerSourceMapPatch } from './patch-source-map.js';

const ENVELOPE_PREFIX = 'pokujs-jest-envelope';

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);

const toFileUrl = (filePath: string): string =>
  isAbsolutePath(filePath) ? pathToFileURL(filePath).href : filePath;

class PokujsJestReporter {
  private readonly coverageState: CoverageState;
  private readonly resolvedOptions: CoverageOptions;
  private envelopeCounter = 0;

  constructor(
    globalConfig: JestGlobalConfig,
    _options?: JestReporterOptions,
    _context?: JestReporterContext
  ) {
    this.coverageState = state.create();
    this.coverageState.cwd = globalConfig.rootDir;

    const cliConfig = process.argv
      .find((arg) => arg.startsWith('--coverageConfig'))
      ?.split('=')[1];
    this.resolvedOptions = config.load(globalConfig.rootDir, cliConfig);
  }

  onRunStart(): void {
    if (this.resolvedOptions.tempDirectory) {
      mkdirSync(this.resolvedOptions.tempDirectory, { recursive: true });
      this.coverageState.tempDir = this.resolvedOptions.tempDirectory;
      this.coverageState.userProvidedTempDir = true;
    } else {
      this.coverageState.tempDir = mkdtempSync(
        join(tmpdir(), 'poku-coverage-jest-')
      );
      this.coverageState.userProvidedTempDir = false;
    }

    this.coverageState.enabled = true;
  }

  onTestResult(_test: JestTest, testResult: JestTestResult): void {
    if (!Array.isArray(testResult.v8Coverage)) return;

    for (const entry of testResult.v8Coverage) {
      const transformResult = entry.codeTransformResult;
      if (!transformResult) continue;
      if (!transformResult.sourceMapPath) continue;

      let sourceMapData: unknown;
      try {
        sourceMapData = JSON.parse(
          readFileSync(transformResult.sourceMapPath, 'utf8')
        );
      } catch {
        continue;
      }

      const fileUrl = toFileUrl(entry.result.url);
      const transpiledLineLengths = lineLengths.compute(transformResult.code);

      if (
        sourceMapData !== null &&
        typeof sourceMapData === 'object' &&
        typeof (sourceMapData as { mappings?: unknown }).mappings === 'string'
      ) {
        tsCompilerSourceMapPatch.apply(
          sourceMapData as { mappings: string },
          transformResult.code,
          transpiledLineLengths,
          entry.result.functions
        );
      }

      const adjustedScript: V8ScriptCoverage = {
        scriptId: entry.result.scriptId,
        url: fileUrl,
        functions: entry.result.functions,
      };

      const envelope = {
        result: [adjustedScript],
        'source-map-cache': {
          [fileUrl]: {
            data: sourceMapData,
            lineLengths: transpiledLineLengths,
          },
        },
      };

      const envelopePath = join(
        this.coverageState.tempDir,
        `${ENVELOPE_PREFIX}-${this.envelopeCounter++}.json`
      );

      writeFileSync(envelopePath, JSON.stringify(envelope));
    }
  }

  onRunComplete(): void {
    if (!this.coverageState.enabled) return;

    const teardownOptions: CoverageOptions = {
      ...this.resolvedOptions,
      clean:
        this.resolvedOptions.clean ?? !this.coverageState.userProvidedTempDir,
    };

    const context: CoverageContext = {
      cwd: this.coverageState.cwd,
      runtime: 'node',
    };

    lifecycle.teardown(context, teardownOptions, this.coverageState, 'node');
  }
}

export default PokujsJestReporter;
