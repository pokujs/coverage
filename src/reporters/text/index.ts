import type { Report } from '../../@types/reporters.js';
import { resolveUrlBuilder } from '../../utils/ide.js';
import { lcovonly } from '../lcovonly/index.js';
import { applyIstanbulBranches } from '../shared/file-coverage.js';
import { renderTable } from './table.js';

const report: Report = (context) => {
  const lcovOutput = lcovonly.runtimes[context.runtime].produce(context);
  if (lcovOutput.length === 0) return;

  const model = lcovonly.parse(lcovOutput, context.cwd);
  if (model.length === 0) return;

  applyIstanbulBranches(
    model,
    context.produceCoverageMap(),
    context.produceBranchDiscoveries()
  );

  const urlBuilder = resolveUrlBuilder(context.options.hyperlinks);

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

  console.log('');
  console.log(table);
};

export const text = { report } as const;
