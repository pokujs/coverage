import type {
  Reporter,
  ReporterContext,
  ReporterName,
  Runtime,
} from '../@types/reporters.js';
import { warnOnce } from '../utils/warn-once.js';
import { clover } from './clover/index.js';
import { cobertura } from './cobertura/index.js';
import { htmlSpa } from './html-spa/index.js';
import { html } from './html/index.js';
import { jsc } from './jsc/index.js';
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
  ['jsc', jsc.report],
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

const normalize = (
  option: ReporterName | ReporterName[] | undefined,
  runtime: Runtime
): ReporterName[] => {
  if (option === undefined) return [defaultReporter];

  const reporterList = Array.isArray(option) ? [...option] : [option];
  if (reporterList.length === 0) return [];

  const native: ReporterName = runtime === 'bun' ? 'jsc' : 'v8';
  const foreign: ReporterName = native === 'jsc' ? 'v8' : 'jsc';

  return reporterList.map((reporterName) =>
    reporterName === foreign ? native : reporterName
  );
};

const run = (reporterList: ReporterName[], context: ReporterContext): void => {
  for (const reporterName of reporterList) {
    const reporter = registry.get(reporterName);

    if (!reporter) {
      warnOnce(
        `unknown-${reporterName}`,
        `[@pokujs/coverage] unknown reporter "${reporterName}", skipping.`
      );
      continue;
    }

    reporter(context);
  }
};

export const reporters = {
  default: defaultReporter,
  normalize,
  run,
} as const;
