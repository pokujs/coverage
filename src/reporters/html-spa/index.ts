import type { HtmlSpaMetricName } from '../../@types/html.js';
import type { Report, Runtime } from '../../@types/reporters.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDatetime } from '../../utils/datetime.js';
import { emitDetailPages } from '../shared/html/emit-details.js';
import { htmlRuntimes } from '../shared/html/runtimes/index.js';
import { buildTree } from '../shared/tree.js';
import { buildHtmlSpaNode } from './build-data.js';
import { copyAssets } from './copy-assets.js';
import { renderShell } from './render-shell.js';

const metricsFor = (runtime: Runtime): readonly HtmlSpaMetricName[] =>
  runtime === 'bun'
    ? ['lines', 'functions']
    : ['lines', 'branches', 'functions'];

const report: Report = (context) => {
  const projectedCoverage = htmlRuntimes[context.runtime].project(context);
  if (projectedCoverage === null) return;

  const { model, byPath } = projectedCoverage;
  if (model.length === 0) return;

  const tree = buildTree(model, context.cwd);
  if (tree.children.length === 0) return;

  mkdirSync(context.reportsDir, { recursive: true });
  copyAssets(context.reportsDir);

  const title = 'All files';
  const datetime = formatDatetime();
  const skipFull = context.options.skipFull === true;
  const skipEmpty = context.options.skipEmpty === true;

  emitDetailPages(tree, {
    reportsDir: context.reportsDir,
    title,
    rootLabel: 'All files',
    resolvedWatermarks: context.watermarks,
    istanbulByPath: byPath,
    skipFull,
    skipEmpty,
    datetime,
    backBreadcrumb: true,
    runtime: context.runtime,
  });

  const data = buildHtmlSpaNode(tree, {
    resolvedWatermarks: context.watermarks,
    skipFull,
    skipEmpty,
  });

  const shell = renderShell({
    data,
    datetime,
    metricsToShow: metricsFor(context.runtime),
  });

  writeFileSync(join(context.reportsDir, 'index.html'), shell);
};

export const htmlSpa = { runtimes: htmlRuntimes, report } as const;
