import type { CheckCoverageInput } from './check-coverage.js';
import type { IdeName } from './ide.js';
import type { ReporterName } from './reporters.js';
import type { Watermarks } from './watermarks.js';

export type CoverageState = {
  enabled: boolean;
  tempDir: string;
  userProvidedTempDir: boolean;
  originalEnv: string | undefined;
  originalNodeOptions: string | undefined;
  nodeOptionsOverridden: boolean;
  cwd: string;
  testFiles: Set<string>;
};

export type CoverageOptions = {
  /**
   * Path to a config file, or `false` to disable auto-discovery.
   *
   * @default undefined
   */
  config?: string | false;

  /**
   * Activate coverage only when `--coverage` is passed on the CLI.
   *
   * @default false
   */
  requireFlag?: boolean;

  /**
   * Directory where the runtime writes raw coverage data. Auto-generated
   * under `os.tmpdir()` when omitted.
   *
   * @default auto
   */
  tempDirectory?: string;

  /**
   * Override the temp-directory cleanup at teardown. Tri-state: `undefined`
   * cleans iff the directory was auto-generated; `true` always cleans;
   * `false` preserves the dir for debugging.
   *
   * @default undefined
   */
  clean?: boolean;

  /**
   * Directory where reports are written. Resolved relative to `cwd`.
   *
   * @default './coverage'
   */
  reportsDirectory?: string;

  /**
   * Reporter name, or list of reporters to run. Pass `[]` to opt out.
   *
   * @default 'text'
   */
  reporter?: ReporterName | ReporterName[];

  /**
   * Clickable OSC 8 hyperlinks on uncovered line ranges (text reporter).
   * `true` emits plain `file://` links; `false` disables; a string forces
   * a named IDE. Always no-op when the terminal cannot render OSC 8.
   *
   * @default true
   */
  hyperlinks?: boolean | IdeName;

  /**
   * `[lowMax, highMin]` thresholds per metric. Values `< lowMax` are
   * `low`, `>= highMin` are `high`.
   *
   * @default [50, 80] per metric
   */
  watermarks?: Partial<Watermarks>;

  /**
   * Fail the run when coverage drops below the given percentages. Pass a
   * bare number to apply to all four metrics, or an object with per-metric
   * values and optional `perFile: true`.
   *
   * @default undefined
   */
  checkCoverage?: CheckCoverageInput;

  /**
   * Hide fully-covered files from the `text`, `html` and `html-spa`
   * reporters. Directory and summary aggregates are unaffected.
   *
   * @default false
   */
  skipFull?: boolean;

  /**
   * Hide files with no executable code from the `text`, `html` and
   * `html-spa` reporters. Directory and summary aggregates are
   * unaffected.
   *
   * @default false
   */
  skipEmpty?: boolean;

  /**
   * Glob allowlist. When non-empty, only files whose POSIX path (relative
   * to `cwd`) matches at least one pattern are kept.
   *
   * @default []
   */
  include?: readonly string[];

  /**
   * Glob denylist. Replaces the default list when provided (nyc / c8
   * convention).
   *
   * @default fileFilter.getDefaultExclude()
   */
  exclude?: readonly string[];

  /**
   * When `true`, globs match original source paths (post source-map
   * remap). When `false`, they match transpiled paths (pre-remap, c8
   * default). Exclusive: the filter runs at exactly one point.
   *
   * @default true
   */
  excludeAfterRemap?: boolean;

  /**
   * Walk `cwd` and report every source file, including files the test
   * run never touched. Applies the same `include` / `exclude` globs.
   * Discovered but untouched files are injected as zero-hit entries.
   *
   * @default false
   */
  all?: boolean;
};
