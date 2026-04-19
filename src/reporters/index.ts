import type {
  Reporter,
  ReporterName,
  ReportersHandler,
} from '../@types/reporters.js';
import { warnOnce } from '../utils/warn-once.js';
import { clover } from './clover/index.js';
import { cobertura } from './cobertura/index.js';
import { htmlSpa } from './html-spa/index.js';
import { html } from './html/index.js';
import { jsonSummary } from './json-summary/index.js';
import { json } from './json/index.js';
import { lcov } from './lcov/index.js';
import { lcovonly } from './lcovonly/index.js';
import { none } from './none/index.js';
import { teamcity } from './teamcity/index.js';
import { textLcov } from './text-lcov/index.js';
import { textSummary } from './text-summary/index.js';
import { text } from './text/index.js';
import { v8 } from './v8/index.js';

const registry = new Map<ReporterName, Reporter>([
  ['lcov', lcov.report],
  ['lcovonly', lcovonly.report],
  ['text-lcov', textLcov.report],
  ['v8', v8.report],
  ['text', text.report],
  ['text-summary', textSummary.report],
  ['teamcity', teamcity.report],
  ['json', json.report],
  ['json-summary', jsonSummary.report],
  ['cobertura', cobertura.report],
  ['clover', clover.report],
  ['html', html.report],
  ['html-spa', htmlSpa.report],
  ['none', none.report],
]);

const defaultReporter: ReporterName = 'text';

const BUN_UNSUPPORTED_REASONS: Record<string, string> = {
  v8: '[@pokujs/coverage] reporter "v8" is not supported on Bun (JavaScriptCore does not expose V8 coverage profiles). Falling back to "lcov" for a portable output.',
  json: '[@pokujs/coverage] reporter "json" is not supported on Bun (requires V8 coverage profiles, which JavaScriptCore does not expose). Falling back to "lcov" for a portable output.',
};

const isBunUnsupported = (reporterName: string): boolean =>
  Object.hasOwn(BUN_UNSUPPORTED_REASONS, reporterName);

export const reporters: ReportersHandler = {
  default: defaultReporter,
  normalize: (option, runtime) => {
    if (option === undefined) return [defaultReporter];

    const reporterList = Array.isArray(option) ? [...option] : [option];
    if (reporterList.length === 0) return [];

    if (runtime !== 'bun') return reporterList;

    const unsupportedFound = reporterList.filter(isBunUnsupported);
    if (unsupportedFound.length === 0) return reporterList;

    for (const unsupportedName of unsupportedFound)
      warnOnce(
        `bun-${unsupportedName}-fallback`,
        BUN_UNSUPPORTED_REASONS[unsupportedName]
      );

    const filtered = reporterList.filter(
      (reporterName) => !isBunUnsupported(reporterName)
    );
    if (!filtered.includes('lcov')) filtered.push('lcov');
    return filtered;
  },
  run: (reporterList, context) => {
    for (const reporterName of reporterList) {
      const reporter = registry.get(reporterName);

      if (!reporter) {
        warnOnce(
          `unknown-${reporterName}`,
          `[@pokujs/coverage] unknown reporter "${reporterName}" — skipping.`
        );
        continue;
      }

      reporter(context);
    }
  },
};
