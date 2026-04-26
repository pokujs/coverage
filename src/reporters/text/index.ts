import type { Report } from '../../@types/reporters.js';
import { ide } from '../../utils/ide.js';
import {
  applyIstanbulBranches,
  applyIstanbulFunctions,
} from '../shared/file-coverage.js';
import { lcov } from '../shared/lcov/index.js';
import { renderTable } from './table.js';

const report: Report = (context) => {
  const lcovOutput = lcov.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcov.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  const coverageMap = context.produceCoverageMap();

  applyIstanbulBranches(model, coverageMap);
  applyIstanbulFunctions(model, coverageMap);

  const urlBuilder = ide.resolveUrlBuilder(context.options.hyperlinks);

  const table = renderTable(
    model,
    context.cwd,
    urlBuilder,
    context.watermarks,
    context.runtime,
    context.options.skipFull === true,
    context.options.skipEmpty === true
  );

  if (table.length === 0) return;

  console.log(table);
};

export const text = { report } as const;
